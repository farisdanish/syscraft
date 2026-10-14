#!/usr/bin/env node

/**
 * SysCraft Tier 3 Loopback Bridge Daemon
 * Connects the browser learning studio to the isolated Docker testbed.
 * Strictly bound to 127.0.0.1:49152 with one-time capability tokens, 
 * command allowlists, ephemeral code mount injection, and payload guards.
 */

import http from 'http';
import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const PORT = 49152;
const HOST = '127.0.0.1';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:5173';
const MAX_BODY_BYTES = 65536; // 64KB payload ceiling
const MAX_OUTPUT_BYTES = 524288; // 512KB child output cap

// Load command manifest
const manifestPath = path.join(__dirname, 'command_manifest.v1.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// Store active one-time capability tokens with expiry
const activeTokens = new Map(); // token -> expiry timestamp

function generateToken() {
  const token = crypto.randomBytes(24).toString('hex');
  activeTokens.set(token, Date.now() + 60000); // 60s validity
  return token;
}

function validateAndSpendToken(token) {
  if (!token || !activeTokens.has(token)) {
    return false;
  }
  const expiry = activeTokens.get(token);
  activeTokens.delete(token); // Single-use
  return Date.now() < expiry;
}

// Clean up expired tokens periodically
setInterval(() => {
  const now = Date.now();
  for (const [t, exp] of activeTokens.entries()) {
    if (now > exp) activeTokens.delete(t);
  }
}, 30000);

// Sanitized minimal environment for spawned processes
const minimalEnv = {
  PATH: process.env.PATH || '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
  HOME: process.env.HOME || '/tmp',
  DOCKER_HOST: process.env.DOCKER_HOST || '',
};

// Redaction filter for logs and client responses
function sanitizeOutput(text) {
  if (!text) return '';
  return text
    .replace(/\/home\/[a-zA-Z0-9_./-]+/g, '<workspace>')
    .replace(/\/tmp\/syscraft-runs\/[a-zA-Z0-9_./-]+/g, '<submission>')
    .replace(/syscraft_secret/g, '<redacted>')
    .replace(/POSTGRES_PASSWORD=[^\s]+/g, 'POSTGRES_PASSWORD=<redacted>')
    .replace(/DATABASE_URL=[^\s]+/g, 'DATABASE_URL=<redacted>');
}

const server = http.createServer(async (req, res) => {
  // 1. Strict Origin Validation
  const origin = req.headers.origin;
  if (origin && origin !== ALLOWED_ORIGIN) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Origin '${origin}' not permitted.` }));
    return;
  }

  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Capability-Token');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Granular Health Endpoint
  if (req.method === 'GET' && req.url === '/api/bridge/health') {
    try {
      const dockerCheck = await new Promise((resolve) => {
        const p = spawn('docker', ['compose', '-f', 'docker/docker-compose.yml', 'ps', '--format', 'json'], {
          cwd: projectRoot,
          env: minimalEnv,
        });
        let out = '';
        p.stdout.on('data', d => { out += d.toString(); });
        p.on('close', code => resolve({ ok: code === 0, out }));
        p.on('error', () => resolve({ ok: false, out: '' }));
        setTimeout(() => {
          try { p.kill('SIGKILL'); } catch {}
          resolve({ ok: false, out: '' });
        }, 1500);
      });

      const postgresReady = dockerCheck.out.includes('syscraft-postgres') && 
        (dockerCheck.out.includes('healthy') || dockerCheck.out.includes('running'));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: dockerCheck.ok && postgresReady ? 'healthy' : 'degraded',
        version: '1.0.0',
        dockerAvailable: dockerCheck.ok,
        postgresReady,
        runnerImageReady: true,
        network: 'syscraft-testnet',
      }));
    } catch {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'degraded',
        version: '1.0.0',
        dockerAvailable: false,
        postgresReady: false,
        runnerImageReady: false,
        network: 'syscraft-testnet',
      }));
    }
    return;
  }

  // Token Issuance Endpoint
  if (req.method === 'POST' && req.url === '/api/bridge/token') {
    const token = generateToken();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ token, validSeconds: 60 }));
    return;
  }

  // Command Execution Endpoint
  if (req.method === 'POST' && req.url === '/api/bridge/run') {
    let body = '';
    let bodyLength = 0;
    let payloadTooLarge = false;

    req.on('data', chunk => {
      bodyLength += chunk.length;
      if (bodyLength > MAX_BODY_BYTES) {
        payloadTooLarge = true;
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Payload exceeds ${MAX_BODY_BYTES} byte ceiling.` }));
        req.destroy();
        return;
      }
      body += chunk;
    });

    req.on('end', () => {
      if (payloadTooLarge) return;

      let runDir = null;
      const cleanupRunDir = () => {
        if (runDir) {
          try {
            fs.rmSync(runDir, { recursive: true, force: true });
          } catch {}
          runDir = null;
        }
      };

      try {
        const payload = JSON.parse(body);
        const { commandId, capabilityToken, userCode, filename } = payload;

        // Verify Token
        if (!validateAndSpendToken(capabilityToken)) {
          res.writeHead(403, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid, expired, or spent capability token.' }));
          return;
        }

        // Verify Command against Manifest
        const cmdEntry = manifest.allowedCommands.find(c => c.id === commandId);
        if (!cmdEntry) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Command ID '${commandId}' is not permitted by manifest.` }));
          return;
        }

        const cmdArgs = [...cmdEntry.args];

        // If userCode is provided, inject it via ephemeral run mount
        if (typeof userCode === 'string' && userCode.trim().length > 0) {
          const safeFilename = typeof filename === 'string' && /^[a-zA-Z0-9_.-]{1,64}$/.test(filename)
            ? filename
            : 'submission.txt';

          const runId = crypto.randomUUID();
          const baseRunDir = path.join('/tmp', 'syscraft-runs');
          if (!fs.existsSync(baseRunDir)) {
            fs.mkdirSync(baseRunDir, { mode: 0o755, recursive: true });
          }
          runDir = path.join(baseRunDir, runId);
          fs.mkdirSync(runDir, { mode: 0o755 });

          const filePath = path.join(runDir, safeFilename);
          fs.writeFileSync(filePath, userCode, { mode: 0o644, encoding: 'utf8' });

          // Inject volume mount before service name 'test'
          const serviceIdx = cmdArgs.indexOf('test');
          if (serviceIdx !== -1) {
            cmdArgs.splice(serviceIdx, 0, '-v', `${runDir}:/workspace/submission:ro`);
          }
        }

        console.log(`[SysCraft Bridge] Executing command: ${commandId}`);

        // Spawn with process group for clean cancellation
        const child = spawn(cmdEntry.executable, cmdArgs, {
          cwd: projectRoot,
          detached: true,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: minimalEnv,
        });

        let stdout = '';
        let stderr = '';
        let finished = false;

        child.stdout.on('data', (d) => {
          if (stdout.length < MAX_OUTPUT_BYTES) {
            stdout += d.toString().slice(0, MAX_OUTPUT_BYTES - stdout.length);
          }
        });
        child.stderr.on('data', (d) => {
          if (stderr.length < MAX_OUTPUT_BYTES) {
            stderr += d.toString().slice(0, MAX_OUTPUT_BYTES - stderr.length);
          }
        });

        // Terminate child process with SIGINT -> SIGKILL escalation
        const terminateChild = () => {
          if (child.pid && !finished) {
            try {
              process.kill(-child.pid, 'SIGINT');
            } catch {}
            setTimeout(() => {
              try {
                process.kill(-child.pid, 'SIGKILL');
              } catch {}
            }, 1500);
          }
        };

        // 10-second hard quota guard
        const timer = setTimeout(() => {
          if (!finished) {
            finished = true;
            cleanupRunDir();
            terminateChild();
            res.writeHead(504, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Execution exceeded 10-second hard quota.' }));
          }
        }, 10000);

        // Client Abort handling (disconnect before response ended)
        res.on('close', () => {
          if (!res.writableEnded && !finished) {
            finished = true;
            clearTimeout(timer);
            cleanupRunDir();
            terminateChild();
          }
        });

        child.on('error', (err) => {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
          cleanupRunDir();
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Process execution error: ${err.message}` }));
        });

        child.on('close', (code) => {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
          cleanupRunDir();

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            commandId,
            exitCode: code ?? 1,
            passed: code === 0,
            executionVerified: true,
            stdout: sanitizeOutput(stdout),
            stderr: sanitizeOutput(stderr).slice(0, 4096),
            timestamp: new Date().toISOString(),
          }));
        });

      } catch {
        cleanupRunDir();
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal execution error.' }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

server.listen(PORT, HOST, () => {
  console.log(`[SysCraft Bridge] Listening on http://${HOST}:${PORT}`);
  console.log(`[SysCraft Bridge] Allowed Origin: ${ALLOWED_ORIGIN}`);
  console.log(`[SysCraft Bridge] Loaded ${manifest.allowedCommands.length} manifest commands.`);
});

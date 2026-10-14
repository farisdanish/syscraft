#!/usr/bin/env node

/**
 * SysCraft Tier 3 Loopback Bridge Daemon
 * Connects the browser learning studio to the isolated Docker testbed.
 * Strictly bound to 127.0.0.1:49152 with one-time capability tokens and command allowlists.
 */

import http from 'http';
import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 49152;
const HOST = '127.0.0.1';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'http://localhost:5173';

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

const server = http.createServer(async (req, res) => {
  // 1. Strict Origin Validation
  const origin = req.headers.origin;
  if (origin && origin !== ALLOWED_ORIGIN) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Origin '${origin}' not allowed.` }));
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

  // Health Endpoint
  if (req.method === 'GET' && req.url === '/api/bridge/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', version: '1.0.0', network: 'syscraft-testnet' }));
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
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const { commandId, capabilityToken } = payload;

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

        // Spawn with distinct process group for clean cancellation
        const projectRoot = path.resolve(__dirname, '..');
        const child = spawn(cmdEntry.executable, cmdEntry.args, {
          cwd: projectRoot,
          detached: true,
          env: {
            PATH: process.env.PATH,
            HOME: process.env.HOME,
          },
        });

        let stdout = '';
        let stderr = '';
        let finished = false;

        child.stdout.on('data', (d) => { stdout += d.toString(); });
        child.stderr.on('data', (d) => { stderr += d.toString(); });

        // 10-second timeout guard
        const timer = setTimeout(() => {
          if (!finished) {
            finished = true;
            try {
              process.kill(-child.pid, 'SIGKILL');
            } catch (e) {}
            res.writeHead(504, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Execution exceeded 10-second hard quota.' }));
          }
        }, 10000);

        // Client Disconnect / Abort handling
        req.on('close', () => {
          if (!finished) {
            finished = true;
            clearTimeout(timer);
            try {
              process.kill(-child.pid, 'SIGINT');
            } catch (e) {}
          }
        });

        child.on('close', (code) => {
          if (finished) return;
          finished = true;
          clearTimeout(timer);

          // Secret Redaction filter
          const sanitizedStdout = stdout.replace(/\/home\/[a-zA-Z0-9_\-\.\/]+/g, '<workspace>');

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            commandId,
            exitCode: code,
            stdout: sanitizedStdout,
            stderr: stderr.slice(0, 4096),
            verified: true,
            timestamp: new Date().toISOString(),
          }));
        });

      } catch (err) {
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

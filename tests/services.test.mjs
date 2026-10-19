import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';

const source = new URL('../', import.meta.url);
function command(root, action, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/services.mjs', action], {
      cwd: root, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', d => { output += d; });
    child.stderr.on('data', d => { output += d; });
    child.once('error', reject);
    child.once('close', code => resolve({ code, output }));
  });
}
test('service lifecycle preserves data, avoids duplicates and rolls back failed startup', { timeout: 120000 }, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'syscraft-lifecycle-'));
  const bin = path.join(root, 'bin');
  for (const dir of ['scripts', 'bridge', 'node_modules/vite/bin', 'bin']) fs.mkdirSync(path.join(root, dir), { recursive: true });
  for (const file of ['scripts/services.mjs', 'bridge/bridge-daemon.mjs', 'bridge/command_manifest.v1.json']) {
    fs.copyFileSync(new URL(file, source), path.join(root, file));
  }
  fs.writeFileSync(path.join(root, 'package.json'), '{"type":"module"}');
  // Docker is an external boundary. All process management and HTTP readiness use real processes.
  fs.writeFileSync(path.join(bin, 'docker'), '#!' + process.execPath + '\n' + `
import fs from 'node:fs';
const args = process.argv.slice(2);
const state = '.docker-running';
if (process.env.FAIL_DOCKER === '1') process.exit(1);
fs.appendFileSync('.docker-commands', JSON.stringify(args) + '\\n');
if (args.includes('up')) fs.writeFileSync(state, 'running');
if (args.includes('down') || args.includes('rm')) { try { fs.unlinkSync('database-marker'); } catch {} }
if (args[0] === 'stop' && args.includes('fixture-runner')) { try { fs.unlinkSync('.runner-running'); } catch {} }
if (args.includes('ps') && args.includes('--quiet')) {
  if (fs.existsSync('.runner-running')) console.log('fixture-runner');
  process.exit(0);
}
if (args.includes('stop')) { try { fs.unlinkSync(state); } catch {} }
if (args.includes('ps') && fs.existsSync(state)) console.log(args.includes('--services') ? 'postgres' : '{"Name":"syscraft-postgres","Health":"healthy"}');
if (args.includes('inspect')) console.log('sha256:fixture');
`, { mode: 0o755 });
  fs.writeFileSync(path.join(root, 'node_modules/vite/bin/vite.js'), `
import http from 'node:http';
if (process.env.FAIL_VITE === '1') process.exit(1);
http.createServer((req, res) => res.end('studio')).listen(5173, '127.0.0.1');
`);
  const env = { PATH: bin + ':' + process.env.PATH };
  try {
    let result = await command(root, 'start', env);
    assert.equal(result.code, 0, result.output);
    const first = JSON.parse(fs.readFileSync(path.join(root, '.syscraft/state.json')));
    assert.equal(first.processes.length, 2);
    fs.writeFileSync(path.join(root, 'database-marker'), 'keep');
    result = await command(root, 'start', env);
    assert.equal(result.code, 0, result.output);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, '.syscraft/state.json'))), first);
    fs.writeFileSync(path.join(root, '.runner-running'), 'running');
    result = await command(root, 'stop', env);
    assert.equal(result.code, 0, result.output);
    assert.equal(fs.existsSync(path.join(root, '.runner-running')), false);
    assert.equal(fs.existsSync(path.join(root, '.docker-running')), false);
    assert.equal(fs.existsSync(path.join(root, '.syscraft/state.json')), false);
    result = await command(root, 'stop', env);
    assert.equal(result.code, 0, result.output);
    result = await command(root, 'start', env);
    assert.equal(result.code, 0, result.output);
    assert.equal(fs.readFileSync(path.join(root, 'database-marker'), 'utf8'), 'keep');
    assert.equal((await command(root, 'stop', env)).code, 0);
    result = await command(root, 'start', { ...env, FAIL_DOCKER: '1' });
    assert.notEqual(result.code, 0);
    assert.equal(fs.existsSync(path.join(root, '.syscraft/state.json')), false);
    result = await command(root, 'start', { ...env, FAIL_VITE: '1' });
    assert.notEqual(result.code, 0);
    assert.equal(fs.existsSync(path.join(root, '.docker-running')), false);
    assert.equal(fs.existsSync(path.join(root, '.syscraft/state.json')), false);
    const unrelated = net.createServer();
    await new Promise(resolve => unrelated.listen(5173, resolve));
    try {
      result = await command(root, 'start', env);
      assert.notEqual(result.code, 0);
      assert.match(result.output, /occupied/);
      assert.equal(unrelated.listening, true);
    } finally { await new Promise(resolve => unrelated.close(resolve)); }
  } finally {
    await command(root, 'stop', env);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

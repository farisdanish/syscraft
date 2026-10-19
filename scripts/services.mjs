import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, '.syscraft');
const stateFile = path.join(dir, 'state.json');
const lock = path.join(dir, 'lock');
const compose = ['compose', '-f', 'docker/docker-compose.yml'];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const readState = () => { try { return JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return { processes: [] }; throw e; } };
const save = state => fs.writeFileSync(stateFile, JSON.stringify(state), { mode: 0o600 });
function identity(pid) {
  try { return fs.readFileSync('/proc/' + pid + '/stat', 'utf8').split(') ')[1].split(' ')[19]; }
  catch { return null; }
}
function alive(p) { return identity(p.pid) === p.identity && p.identity !== null; }
function run(command, args, timeout = 60000) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    let out = '', err = '', timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try { process.kill(-child.pid, 'SIGKILL'); } catch {}
    }, timeout);
    child.stdout.on('data', d => { out = (out + d).slice(-65536); });
    child.stderr.on('data', d => { err = (err + d).slice(-65536); });
    child.once('error', e => { clearTimeout(timer); reject(e); });
    child.once('close', code => {
      clearTimeout(timer);
      if (timedOut || code !== 0) reject(new Error(command + ' failed' + (timedOut ? ' (timeout)' : '') + ': ' + (err || out)));
      else resolve(out.trim());
    });
  });
}
async function free(port) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', () => reject(new Error('Port ' + port + ' is occupied; stop its owner before starting SysCraft.')));
    server.listen(port, () => server.close(resolve));
  });
}
function get(port, url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path: url, headers, timeout: 3000 }, res => {
      let data = '';
      res.on('data', d => { data += d; });
      res.on('end', () => res.statusCode === 200 ? resolve(data) : reject(new Error('HTTP ' + res.statusCode)));
    });
    req.on('timeout', () => req.destroy(new Error('HTTP timeout')));
    req.on('error', reject);
  });
}
async function ready(state) {
  const until = Date.now() + 60000;
  let last;
  while (Date.now() < until) {
    if (state.processes.some(p => !alive(p))) throw new Error('A managed service exited; inspect .syscraft/*.log.');
    try {
      await get(5173, '/');
      const health = JSON.parse(await get(49152, '/api/bridge/health', { Origin: 'http://localhost:5173' }));
      if (health.status === 'healthy') return;
      last = 'Bridge reports degraded Docker readiness';
    } catch (e) { last = e.message; }
    await sleep(500);
  }
  throw new Error('Readiness timed out: ' + last);
}
async function terminate(state) {
  for (const p of state.processes.filter(alive)) {
    try { process.kill(-p.pid, 'SIGTERM'); } catch (e) { if (e.code !== 'ESRCH') throw e; }
  }
  const until = Date.now() + 15000;
  while (state.processes.some(alive) && Date.now() < until) await sleep(100);
  for (const p of state.processes.filter(alive)) {
    try { process.kill(-p.pid, 'SIGKILL'); } catch (e) { if (e.code !== 'ESRCH') throw e; }
  }
}
async function launch(state, name, args) {
  const fd = fs.openSync(path.join(dir, name + '.log'), 'a', 0o600);
  const child = spawn(process.execPath, args, {
    cwd: root, detached: true, stdio: ['ignore', fd, fd],
    env: { ...process.env, ALLOWED_ORIGIN: 'http://localhost:5173' },
  });
  fs.closeSync(fd);
  await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
  const record = { name, pid: child.pid, identity: identity(child.pid) };
  state.processes.push(record);
  save(state);
  child.unref();
}
async function main() {
  const action = process.argv[2];
  if (!['start', 'stop'].includes(action)) throw new Error('Usage: node scripts/services.mjs start|stop');
  if (process.platform !== 'linux') throw new Error('Run this command inside WSL or Linux.');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  // flock releases the lock automatically even when this process is interrupted.
  if (process.env.SYSCRAFT_LOCKED !== '1') {
    const child = spawn('flock', ['-n', '-E', '73', lock, process.execPath, fileURLToPath(import.meta.url), action], {
      stdio: 'inherit', env: { ...process.env, SYSCRAFT_LOCKED: '1' },
    });
    await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', code => { if (code === 73) console.error('Another SysCraft lifecycle command is running. Try again after it finishes.'); process.exitCode = code ?? 1; resolve(); });
    });
    return;
  }
  const state = readState();
  if (action === 'stop') {
    await terminate(state);
    if (state.postgres) {
      const runners = await run('docker', [...compose, 'ps', '--all', '--quiet', 'test']);
      if (runners) await run('docker', ['stop', '-t', '15', ...runners.split(/\s+/)]);
      await run('docker', [...compose, 'stop', '-t', '15', 'postgres']);
    }
    fs.rmSync(stateFile, { force: true });
    console.log('SysCraft stopped. PostgreSQL data preserved.');
    return;
  }
  if (state.processes.some(alive)) {
    await ready(state);
    console.log('SysCraft is already running: http://localhost:5173');
    return;
  }
  if (state.postgres) throw new Error('Previous service state exists. Run npm run stop:all before starting again.');
  await free(5173);
  await free(49152);
  if (!fs.existsSync(path.join(root, 'node_modules/vite/bin/vite.js'))) throw new Error('Dependencies missing. Run npm ci first.');
  try { await run('docker', ['info']); }
  catch (e) { throw new Error('Docker is unavailable. Start Docker Engine or enable Docker Desktop WSL integration for this distribution.\n' + e.message); }
  await run('docker', [...compose, 'version']);
  const running = await run('docker', [...compose, 'ps', '--status', 'running', '--services']);
  if (running.split('\n').includes('postgres')) throw new Error('PostgreSQL is already running outside this supervisor. Stop it explicitly before start:all.');
  try {
    await run('docker', ['image', 'inspect', 'syscraft-runner:1.0.0']);
  } catch {
    console.log('Building the PHP runner image...');
    await run('docker', [...compose, 'build', 'test'], 600000);
  }
  const fresh = { processes: [], postgres: true };
  save(fresh);
  try {
    await run('docker', [...compose, 'up', '-d', '--wait', '--wait-timeout', '60', 'postgres'], 90000);
    await launch(fresh, 'bridge', ['bridge/bridge-daemon.mjs']);
    await launch(fresh, 'vite', ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5173', '--strictPort']);
    await ready(fresh);
    console.log('SysCraft ready: http://localhost:5173\nLogs: .syscraft/bridge.log and .syscraft/vite.log\nStop: npm run stop:all');
  } catch (e) {
    await terminate(fresh);
    try {
      await run('docker', [...compose, 'stop', '-t', '15', 'postgres']);
      fs.rmSync(stateFile, { force: true });
    } catch (cleanup) { console.error('Cleanup incomplete; retry npm run stop:all. ' + cleanup.message); }
    throw e;
  }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });

#!/usr/bin/env node
/**
 * Root dev runner:
 * - starts API and web together
 * - wires web proxy target to the API port automatically
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const idx = trimmed.indexOf('=');
  if (idx <= 0) return null;
  const key = trimmed.slice(0, idx).trim();
  let value = trimmed.slice(idx + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }
  return [key, value];
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;
    const [key, value] = parsed;
    if (process.env[key] == null || process.env[key] === '') {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.resolve(process.cwd(), '.env'));
loadEnvFile(path.resolve(process.cwd(), '.env.local'));

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const apiPort = String(process.env.API_PORT || process.env.PORT || '4000');
const webPort = process.env.WEB_PORT || process.env.VITE_PORT || '';
const apiTarget = process.env.VITE_API_TARGET || `http://localhost:${apiPort}`;

function start(name, args, env) {
  const child = spawn(npmCmd, args, {
    env,
    stdio: 'inherit',
  });
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    const detail = signal ? `signal ${signal}` : `code ${code ?? 0}`;
    // eslint-disable-next-line no-console
    console.error(`[dev] ${name} exited (${detail})`);
    shutdown(code ?? 1);
  });
  return child;
}

let shuttingDown = false;
let apiProc;
let webProc;

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;

  if (apiProc && !apiProc.killed) apiProc.kill('SIGTERM');
  if (webProc && !webProc.killed) webProc.kill('SIGTERM');

  setTimeout(() => {
    if (apiProc && !apiProc.killed) apiProc.kill('SIGKILL');
    if (webProc && !webProc.killed) webProc.kill('SIGKILL');
  }, 2500);

  setTimeout(() => process.exit(code), 2600);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

// eslint-disable-next-line no-console
console.log(`[dev] API port: ${apiPort}`);
// eslint-disable-next-line no-console
console.log(`[dev] Web proxy target: ${apiTarget}`);
if (webPort) {
  // eslint-disable-next-line no-console
  console.log(`[dev] Web port override: ${webPort}`);
}

apiProc = start('api', ['run', 'dev:api'], {
  ...process.env,
  PORT: apiPort,
});

webProc = start('web', ['run', 'dev:web'], {
  ...process.env,
  VITE_API_TARGET: apiTarget,
  ...(webPort ? { VITE_PORT: webPort } : {}),
});

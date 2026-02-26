#!/usr/bin/env node
/**
 * Runs API smoke tests: spawns API with test DB, runs smoke script, kills API.
 */

const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const API_PORT = parseInt(process.env.API_SMOKE_PORT || '4100', 10);
const testDbPath = path.join(ROOT, 'data', 'test.db');

function waitFor(url, maxAttempts = 30) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    function tryFetch() {
      attempts++;
      http.get(url, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 500) return resolve();
        if (attempts >= maxAttempts) reject(new Error(`API not ready: ${res.statusCode}`));
        else setTimeout(tryFetch, 500);
      }).on('error', () => {
        if (attempts >= maxAttempts) reject(new Error('API not ready'));
        else setTimeout(tryFetch, 500);
      });
    }
    tryFetch();
  });
}

async function main() {
  for (const dbPath of [testDbPath, `${testDbPath}-wal`, `${testDbPath}-shm`]) {
    try {
      fs.rmSync(dbPath, { force: true });
    } catch {
      // ignore
    }
  }

  const apiProc = spawn('npm', ['run', 'dev', '--workspace', 'apps/api'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(API_PORT),
      DATABASE_FILE: testDbPath,
      NODE_ENV: 'development',
      MAX_ACTIVE_CLAIMS: '50',
      MAX_CLAIMS_PER_HOUR: '100',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  process.on('SIGINT', () => apiProc.kill('SIGTERM'));

  try {
    await waitFor(`http://localhost:${API_PORT}/api/health`);
  } catch (err) {
    apiProc.kill('SIGTERM');
    console.error(err.message);
    process.exit(1);
  }

  const pw = spawn('node', [path.join(__dirname, 'api-smoke.js')], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, API_BASE: `http://localhost:${API_PORT}` },
  });

  const code = await new Promise((resolve) => pw.on('close', resolve));
  apiProc.kill('SIGTERM');
  process.exit(code);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

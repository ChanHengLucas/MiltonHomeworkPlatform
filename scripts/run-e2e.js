#!/usr/bin/env node
/**
 * E2E test runner: spawns API + Vite, waits for readiness, runs Playwright.
 * Uses data/test.db for E2E to avoid polluting dev data.
 */

const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const API_PORT = parseInt(process.env.E2E_API_PORT || '4100', 10);
const VITE_PORT = parseInt(process.env.E2E_WEB_PORT || '3100', 10);
const BASE_URL = `http://localhost:${VITE_PORT}`;
const API_URL = `http://localhost:${API_PORT}`;
const REQUEST_TIMEOUT_MS = 5000;

function waitFor(url, label, maxAttempts = 60) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    function tryFetch() {
      attempts++;
      if (attempts > 1 && attempts % 5 === 0) {
        process.stdout.write(`  [E2E] Waiting for ${label}... (${attempts}/${maxAttempts})\n`);
      }
      const req = http.get(url, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 500) {
            resolve();
            return;
          }
          if (attempts >= maxAttempts) reject(new Error(`${label} failed: ${res.statusCode}`));
          else setTimeout(tryFetch, 500);
        });
      });
      req.setTimeout(REQUEST_TIMEOUT_MS, () => {
        req.destroy();
        if (attempts >= maxAttempts) reject(new Error(`${label} timed out after ${maxAttempts} attempts`));
        else setTimeout(tryFetch, 500);
      });
      req.on('error', () => {
        if (attempts >= maxAttempts) reject(new Error(`${label} not ready`));
        else setTimeout(tryFetch, 500);
      });
    }
    tryFetch();
  });
}

async function main() {
  console.log('[E2E] Starting API server...');
  const testDbPath = path.join(ROOT, 'data', 'test.db');
  for (const dbPath of [testDbPath, `${testDbPath}-wal`, `${testDbPath}-shm`]) {
    try {
      fs.rmSync(dbPath, { force: true });
    } catch {
      // ignore
    }
  }
  const apiEnv = {
    ...process.env,
    PORT: String(API_PORT),
    DATABASE_FILE: testDbPath,
    NODE_ENV: 'development',
    MOCK_AUTH: '1',
    FRONTEND_URL: BASE_URL,
    MAX_ACTIVE_CLAIMS: '50',
    MAX_CLAIMS_PER_HOUR: '100',
  };

  const apiProc = spawn('npm', ['run', 'dev', '--workspace', 'apps/api'], {
    cwd: ROOT,
    env: apiEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  console.log('[E2E] Starting Vite dev server...');
  const viteProc = spawn('npm', ['run', 'dev', '--workspace', 'apps/web'], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      E2E_TEST: '1',
      VITE_E2E_TEST: '1',
      VITE_PORT: String(VITE_PORT),
      VITE_API_PROXY_TARGET: API_URL,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  function killAll() {
    apiProc.kill('SIGTERM');
    viteProc.kill('SIGTERM');
  }

  process.on('SIGINT', killAll);
  process.on('SIGTERM', killAll);

  try {
    console.log('[E2E] Waiting for API to be ready...');
    await waitFor(`${API_URL}/api/health`, 'API');
    console.log('[E2E] API ready. Waiting for Vite...');
    await waitFor(BASE_URL, 'Vite');
    console.log('[E2E] Vite ready. Running Playwright tests...\n');
  } catch (err) {
    killAll();
    console.error('[E2E]', err.message);
    process.exit(1);
  }

  const pw = spawn('npx', ['playwright', 'test', '--project=chromium'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, BASE_URL, API_BASE: API_URL },
  });

  const code = await new Promise((resolve) => pw.on('close', resolve));
  killAll();
  process.exit(code);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

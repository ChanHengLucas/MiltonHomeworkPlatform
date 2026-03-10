#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function resolveAppDbPath() {
  const envPath = process.env.DATABASE_FILE;
  if (envPath && envPath.trim()) {
    return path.resolve(envPath.trim());
  }
  return path.resolve(process.cwd(), 'data', 'app.db');
}

function removeIfExists(filePath) {
  if (!fs.existsSync(filePath)) return false;
  fs.rmSync(filePath, { force: true });
  return true;
}

function removeDbSet(basePath) {
  const files = [basePath, `${basePath}-wal`, `${basePath}-shm`];
  const removed = [];
  for (const filePath of files) {
    if (removeIfExists(filePath)) removed.push(filePath);
  }
  return removed;
}

function main() {
  const includeStudent = process.argv.includes('--include-test');
  const appDbPath = resolveAppDbPath();
  const removedApp = removeDbSet(appDbPath);

  const removed = [...removedApp];
  if (includeStudent) {
    const testDbPath = path.resolve(process.cwd(), 'data', 'test.db');
    removed.push(...removeDbSet(testDbPath));
  }

  console.log('[db:reset] Reset complete');
  console.log(`[db:reset] App DB: ${appDbPath}`);
  console.log(`[db:reset] Removed files: ${removed.length > 0 ? removed.join(', ') : '(none found)'}`);
  if (!includeStudent) {
    console.log('[db:reset] Student DB files were not removed. Pass --include-test to remove test.db variants.');
  }
}

main();

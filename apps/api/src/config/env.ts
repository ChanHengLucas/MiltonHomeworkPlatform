import fs from 'fs';
import path from 'path';

let loaded = false;

function parseLine(line: string): [string, string] | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const eqIndex = trimmed.indexOf('=');
  if (eqIndex <= 0) return null;
  const key = trimmed.slice(0, eqIndex).trim();
  if (!key) return null;
  let value = trimmed.slice(eqIndex + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return [key, value];
}

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const parsed = parseLine(line);
    if (!parsed) continue;
    const [key, value] = parsed;
    if (process.env[key] == null || process.env[key] === '') {
      process.env[key] = value;
    }
  }
}

export function loadEnvFromFiles(): void {
  if (loaded) return;
  loaded = true;
  const cwd = process.cwd();
  loadEnvFile(path.resolve(cwd, '.env'));
  loadEnvFile(path.resolve(cwd, '.env.local'));
}

loadEnvFromFiles();

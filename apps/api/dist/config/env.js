"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadEnvFromFiles = loadEnvFromFiles;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
let loaded = false;
function parseLine(line) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#'))
        return null;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0)
        return null;
    const key = trimmed.slice(0, eqIndex).trim();
    if (!key)
        return null;
    let value = trimmed.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
    }
    return [key, value];
}
function loadEnvFile(filePath) {
    if (!fs_1.default.existsSync(filePath))
        return;
    const content = fs_1.default.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
        const parsed = parseLine(line);
        if (!parsed)
            continue;
        const [key, value] = parsed;
        if (process.env[key] == null || process.env[key] === '') {
            process.env[key] = value;
        }
    }
}
function loadEnvFromFiles() {
    if (loaded)
        return;
    loaded = true;
    const cwd = process.cwd();
    loadEnvFile(path_1.default.resolve(cwd, '.env'));
    loadEnvFile(path_1.default.resolve(cwd, '.env.local'));
}
loadEnvFromFiles();

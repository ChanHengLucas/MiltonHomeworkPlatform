"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveBase64Upload = saveBase64Upload;
const crypto_1 = require("crypto");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const MAX_UPLOAD_BYTES = parseInt(process.env.MAX_UPLOAD_BYTES ?? `${8 * 1024 * 1024}`, 10) || (8 * 1024 * 1024);
function uploadsRoot() {
    const configured = (process.env.UPLOADS_DIR || '').trim();
    const resolved = configured
        ? path_1.default.resolve(configured)
        : path_1.default.resolve(process.cwd(), 'data', 'uploads');
    fs_1.default.mkdirSync(resolved, { recursive: true });
    return resolved;
}
function sanitizeFilename(name) {
    const trimmed = (name || '').trim();
    if (!trimmed)
        return 'upload.bin';
    const sanitized = trimmed.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
    return sanitized || 'upload.bin';
}
function saveBase64Upload(scope, input) {
    const originalName = sanitizeFilename(input.fileName);
    const raw = (input.contentBase64 || '').trim();
    if (!raw) {
        const err = new Error('File content is required');
        err.statusCode = 400;
        throw err;
    }
    let buffer;
    try {
        buffer = Buffer.from(raw, 'base64');
    }
    catch {
        const err = new Error('Invalid base64 file payload');
        err.statusCode = 400;
        throw err;
    }
    if (!buffer || buffer.length === 0) {
        const err = new Error('Uploaded file is empty');
        err.statusCode = 400;
        throw err;
    }
    if (buffer.length > MAX_UPLOAD_BYTES) {
        const err = new Error(`Uploaded file exceeds ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))}MB limit`);
        err.statusCode = 413;
        throw err;
    }
    const day = new Date().toISOString().slice(0, 10);
    const relativeDir = path_1.default.join(scope, day);
    const absDir = path_1.default.join(uploadsRoot(), relativeDir);
    fs_1.default.mkdirSync(absDir, { recursive: true });
    const storedName = `${Date.now()}-${(0, crypto_1.randomUUID)()}-${originalName}`;
    const relativePath = path_1.default.join(relativeDir, storedName);
    const absPath = path_1.default.join(uploadsRoot(), relativePath);
    fs_1.default.writeFileSync(absPath, buffer);
    return {
        originalName,
        storedPath: relativePath,
        mimeType: input.mimeType?.trim() || null,
        sizeBytes: buffer.length,
    };
}

import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

const MAX_UPLOAD_BYTES = parseInt(process.env.MAX_UPLOAD_BYTES ?? `${8 * 1024 * 1024}`, 10) || (8 * 1024 * 1024);

function uploadsRoot(): string {
  const configured = (process.env.UPLOADS_DIR || '').trim();
  const resolved = configured
    ? path.resolve(configured)
    : path.resolve(process.cwd(), 'data', 'uploads');
  fs.mkdirSync(resolved, { recursive: true });
  return resolved;
}

function sanitizeFilename(name: string): string {
  const trimmed = (name || '').trim();
  if (!trimmed) return 'upload.bin';
  const sanitized = trimmed.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
  return sanitized || 'upload.bin';
}

export interface SavedUpload {
  originalName: string;
  storedPath: string;
  mimeType: string | null;
  sizeBytes: number;
}

export function saveBase64Upload(
  scope: string,
  input: { fileName: string; mimeType?: string | null; contentBase64: string }
): SavedUpload {
  const originalName = sanitizeFilename(input.fileName);
  const raw = (input.contentBase64 || '').trim();
  if (!raw) {
    const err = new Error('File content is required') as Error & { statusCode?: number };
    err.statusCode = 400;
    throw err;
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(raw, 'base64');
  } catch {
    const err = new Error('Invalid base64 file payload') as Error & { statusCode?: number };
    err.statusCode = 400;
    throw err;
  }

  if (!buffer || buffer.length === 0) {
    const err = new Error('Uploaded file is empty') as Error & { statusCode?: number };
    err.statusCode = 400;
    throw err;
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    const err = new Error(`Uploaded file exceeds ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))}MB limit`) as Error & { statusCode?: number };
    err.statusCode = 413;
    throw err;
  }

  const day = new Date().toISOString().slice(0, 10);
  const relativeDir = path.join(scope, day);
  const absDir = path.join(uploadsRoot(), relativeDir);
  fs.mkdirSync(absDir, { recursive: true });

  const storedName = `${Date.now()}-${randomUUID()}-${originalName}`;
  const relativePath = path.join(relativeDir, storedName);
  const absPath = path.join(uploadsRoot(), relativePath);
  fs.writeFileSync(absPath, buffer);

  return {
    originalName,
    storedPath: relativePath,
    mimeType: input.mimeType?.trim() || null,
    sizeBytes: buffer.length,
  };
}


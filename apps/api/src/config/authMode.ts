import './env';

export type AuthMode = 'dev' | 'google';

export interface AuthModeInfo {
  mode: AuthMode;
  nodeEnv: string;
  mockAuthOverride: boolean;
  detected: {
    googleClientId: boolean;
    googleClientSecret: boolean;
    googleCallbackUrl: boolean;
    sessionSecret: boolean;
  };
  googleCallbackUrl: string;
}

function trimEnv(name: string): string {
  return (process.env[name] || '').trim();
}

function boolFromEnv(name: string): boolean {
  const raw = trimEnv(name).toLowerCase();
  return raw === '1' || raw === 'true';
}

function inferDefaultCallbackUrl(): string {
  const port = trimEnv('PORT') || '4000';
  return `http://localhost:${port}/api/auth/google/callback`;
}

export function getWebOriginFallback(): string {
  return trimEnv('WEB_ORIGIN') || trimEnv('FRONTEND_URL') || 'http://localhost:3000';
}

export function getAuthModeInfo(): AuthModeInfo {
  const nodeEnv = trimEnv('NODE_ENV') || 'development';
  const mockAuthOverride = nodeEnv !== 'production' && boolFromEnv('MOCK_AUTH');
  const detected = {
    googleClientId: Boolean(trimEnv('GOOGLE_CLIENT_ID')),
    googleClientSecret: Boolean(trimEnv('GOOGLE_CLIENT_SECRET')),
    googleCallbackUrl: Boolean(trimEnv('GOOGLE_CALLBACK_URL')),
    sessionSecret: Boolean(trimEnv('SESSION_SECRET')),
  };
  const googleConfigured =
    detected.googleClientId
    && detected.googleClientSecret
    && detected.googleCallbackUrl;

  const mode: AuthMode = nodeEnv === 'production'
    ? 'google'
    : (mockAuthOverride || !googleConfigured ? 'dev' : 'google');

  return {
    mode,
    nodeEnv,
    mockAuthOverride,
    detected,
    googleCallbackUrl: trimEnv('GOOGLE_CALLBACK_URL') || inferDefaultCallbackUrl(),
  };
}

export function getAuthMode(): AuthMode {
  return getAuthModeInfo().mode;
}

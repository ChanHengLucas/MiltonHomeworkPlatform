import { Router, Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { isTeacherEligible } from '../utils/identity';
import { getAuthModeInfo, getWebOriginFallback } from '../config/authMode';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const AUTH_MODE_INFO = getAuthModeInfo();
const AUTH_MODE = AUTH_MODE_INFO.mode;
const FALLBACK_WEB_ORIGIN = getWebOriginFallback();

interface OAuthState {
  returnOrigin?: string;
}

declare module 'express-session' {
  interface SessionData {
    user?: { email: string; name: string; picture?: string };
    googleTokens?: { access_token?: string; refresh_token?: string };
  }
}

export const authRouter = Router();

function getOAuthClient(): OAuth2Client {
  return new OAuth2Client(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    AUTH_MODE_INFO.googleCallbackUrl
  );
}

function isAllowedReturnOrigin(origin: string): boolean {
  if (!origin) return false;
  if (AUTH_MODE_INFO.nodeEnv === 'production') {
    return origin === FALLBACK_WEB_ORIGIN;
  }
  return /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
}

function normalizeReturnOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const origin = new URL(value).origin;
    return isAllowedReturnOrigin(origin) ? origin : null;
  } catch {
    return null;
  }
}

function resolveReturnOrigin(req: Request): string {
  const fromOrigin = normalizeReturnOrigin(req.get('origin'));
  if (fromOrigin) return fromOrigin;
  const referer = req.get('referer');
  const fromReferer = normalizeReturnOrigin(referer);
  if (fromReferer) return fromReferer;
  return FALLBACK_WEB_ORIGIN;
}

function encodeOAuthState(value: OAuthState): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decodeOAuthState(raw: unknown): OAuthState {
  if (typeof raw !== 'string' || !raw.trim()) return {};
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8');
    const parsed = JSON.parse(json) as OAuthState;
    if (typeof parsed !== 'object' || parsed == null) return {};
    return parsed;
  } catch {
    return {};
  }
}

authRouter.get('/google/start', (_req: Request, res: Response) => {
  if (AUTH_MODE === 'dev') {
    return res.status(400).json({
      error: 'Google auth is disabled in dev mode. Configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL to enable it.',
      mode: 'dev',
    });
  }
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !AUTH_MODE_INFO.detected.googleCallbackUrl) {
    return res.status(500).json({
      error: 'Google OAuth not configured',
      mode: 'google',
    });
  }
  const client = getOAuthClient();
  const returnOrigin = resolveReturnOrigin(_req);
  const scopes = [
    'openid',
    'email',
    'profile',
    'https://www.googleapis.com/auth/calendar.readonly',
  ];
  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
    state: encodeOAuthState({ returnOrigin }),
  });
  console.log('[Auth] Redirecting to Google OAuth start');
  res.redirect(url);
});

authRouter.get('/google/callback', async (req: Request, res: Response) => {
  const state = decodeOAuthState(req.query.state);
  const returnOrigin = normalizeReturnOrigin(state.returnOrigin) || FALLBACK_WEB_ORIGIN;
  if (AUTH_MODE === 'dev') {
    return res.redirect(`${returnOrigin}/login?dev=1`);
  }
  const { code } = req.query;
  if (!code || typeof code !== 'string') {
    return res.redirect(`${returnOrigin}/login?error=no_code`);
  }
  try {
    const client = getOAuthClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token!,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const email = payload?.email || '';
    const name = payload?.name || payload?.email || 'User';
    const picture = payload?.picture;

    req.session.user = { email, name, picture };
    req.session.googleTokens = {
      access_token: tokens.access_token || undefined,
      refresh_token: tokens.refresh_token || undefined,
    };
    console.log('[Auth] Google callback success', { email });

    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.redirect(returnOrigin);
  } catch (err) {
    console.error('[Auth] Google callback error', err);
    res.redirect(`${returnOrigin}/login?error=callback_failed`);
  }
});

authRouter.post('/logout', (req: Request, res: Response) => {
  req.session.destroy(() => {});
  res.json({ ok: true });
});

authRouter.get('/me', (req: Request, res: Response) => {
  if (AUTH_MODE === 'dev') {
    const email = (req.user?.email || '').trim();
    const fallbackName = email ? email.split('@')[0] : 'anonymous';
    const name = (req.user?.name || fallbackName).trim() || fallbackName;
    return res.json({
      email,
      name,
      picture: null,
      isTeacher: isTeacherEligible(email),
      mode: 'dev',
      authenticated: Boolean(email),
    });
  }

  const user = req.session?.user;
  if (!user?.email) {
    return res.status(401).json({ error: 'Not authenticated', mode: 'google' });
  }
  console.log('[Auth] /me resolved from session', { email: user.email });
  res.json({
    email: user.email,
    name: user.name,
    picture: user.picture ?? null,
    isTeacher: isTeacherEligible(user.email),
    mode: 'google',
    authenticated: true,
  });
});

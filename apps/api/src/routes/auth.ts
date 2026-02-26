import { Router, Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { isTeacherEligible } from '../utils/identity';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const MOCK_AUTH = process.env.MOCK_AUTH === 'true';

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
    `${FRONTEND_URL}/auth/google/callback`
  );
}

authRouter.get('/google/start', (req: Request, res: Response) => {
  if (MOCK_AUTH) {
    return res.redirect(`${FRONTEND_URL}/login?mock=1`);
  }
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.status(500).json({ error: 'Google OAuth not configured' });
  }
  const client = getOAuthClient();
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
  });
  res.redirect(url);
});

authRouter.get('/google/callback', async (req: Request, res: Response) => {
  if (MOCK_AUTH) {
    return res.redirect(`${FRONTEND_URL}/login?mock=1`);
  }
  const { code } = req.query;
  if (!code || typeof code !== 'string') {
    return res.redirect(`${FRONTEND_URL}/login?error=no_code`);
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

    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.redirect(FRONTEND_URL);
  } catch (err) {
    console.error('[Auth] Google callback error', err);
    res.redirect(`${FRONTEND_URL}/login?error=callback_failed`);
  }
});

authRouter.post('/logout', (req: Request, res: Response) => {
  req.session.destroy(() => {});
  res.json({ ok: true });
});

authRouter.get('/me', (req: Request, res: Response) => {
  if (MOCK_AUTH) {
    const email = (req.headers['x-user-email'] as string)?.trim() || '';
    const name = (req.headers['x-user-name'] as string)?.trim() || email.split('@')[0] || 'Mock User';
    if (!email) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    return res.json({
      email,
      name,
      picture: null,
      isTeacher: isTeacherEligible(email),
    });
  }

  const user = req.session?.user;
  if (!user?.email) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({
    email: user.email,
    name: user.name,
    picture: user.picture ?? null,
    isTeacher: isTeacherEligible(user.email),
  });
});

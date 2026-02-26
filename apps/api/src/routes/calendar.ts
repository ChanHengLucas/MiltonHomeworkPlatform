import { Router, Request, Response } from 'express';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { data: { startMs: number; endMs: number; source: string }[]; expires: number }>();

function getTokens(req: Request): { access_token?: string; refresh_token?: string } | null {
  const session = req.session as { googleTokens?: { access_token?: string; refresh_token?: string } };
  return session?.googleTokens ?? null;
}

function getOAuthClient(): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  const redirectUri = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/google/callback`;
  return new OAuth2Client(clientId, clientSecret, redirectUri);
}

function getStatusCodeFromError(err: unknown): number {
  if (typeof err !== 'object' || !err) return 500;
  const code = (err as { code?: unknown }).code;
  if (typeof code === 'number') return code;
  const status = (err as { response?: { status?: unknown } }).response?.status;
  if (typeof status === 'number') return status;
  return 500;
}

export const calendarRouter = Router();

calendarRouter.get('/busy', async (req: Request, res: Response) => {
  const tokens = getTokens(req);
  if (!tokens?.access_token) {
    return res.status(401).json({ error: 'Not authenticated with Google. Sign in with Google to import calendar.' });
  }

  const userEmail = (req.user?.email || '').toLowerCase().trim();
  const days = Math.min(parseInt(String(req.query.days || '7'), 10) || 7, 30);
  const cacheKey = `${userEmail}:${days}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expires) {
    console.log('[Calendar] Serving cached busy blocks', { userEmail, days, count: cached.data.length });
    res.setHeader('X-Calendar-Cache', 'HIT');
    return res.json(cached.data);
  }

  try {
    const client = getOAuthClient();
    client.setCredentials(tokens);

    const calendar = google.calendar({ version: 'v3', auth: client });
    const timeMin = new Date();
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + days);

    const freebusy = await calendar.freebusy.query({
      requestBody: {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: [{ id: 'primary' }],
      },
    });

    const busy: { startMs: number; endMs: number; source: string }[] = [];
    const cal = freebusy.data.calendars?.primary?.busy;
    if (cal) {
      for (const b of cal) {
        if (b.start && b.end) {
          busy.push({
            startMs: new Date(b.start).getTime(),
            endMs: new Date(b.end).getTime(),
            source: 'google',
          });
        }
      }
    }

    cache.set(cacheKey, { data: busy, expires: Date.now() + CACHE_TTL_MS });
    console.log('[Calendar] Fetched busy blocks', { userEmail, days, count: busy.length });
    res.setHeader('X-Calendar-Cache', 'MISS');
    res.json(busy);
  } catch (err) {
    const status = getStatusCodeFromError(err);
    console.error('[Calendar] FreeBusy error', { status, err });
    if (status === 401) {
      return res.status(401).json({ error: 'Google session expired. Please sign in again to import calendar.' });
    }
    if (status === 403 || status === 429) {
      return res.status(429).json({ error: 'Google Calendar quota limit reached. Try again in a few minutes.' });
    }
    res.status(500).json({ error: 'Failed to fetch calendar busy times. Please try again.' });
  }
});

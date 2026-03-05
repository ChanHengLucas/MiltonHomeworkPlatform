"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calendarRouter = void 0;
const express_1 = require("express");
const googleapis_1 = require("googleapis");
const google_auth_library_1 = require("google-auth-library");
const authMode_1 = require("../config/authMode");
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map();
const AUTH_MODE_INFO = (0, authMode_1.getAuthModeInfo)();
function getTokens(req) {
    const session = req.session;
    return session?.googleTokens ?? null;
}
function getOAuthClient() {
    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    const redirectUri = AUTH_MODE_INFO.googleCallbackUrl;
    return new google_auth_library_1.OAuth2Client(clientId, clientSecret, redirectUri);
}
function getStatusCodeFromError(err) {
    if (typeof err !== 'object' || !err)
        return 500;
    const code = err.code;
    if (typeof code === 'number')
        return code;
    const status = err.response?.status;
    if (typeof status === 'number')
        return status;
    return 500;
}
exports.calendarRouter = (0, express_1.Router)();
exports.calendarRouter.get('/busy', async (req, res) => {
    if (AUTH_MODE_INFO.mode !== 'google') {
        return res.status(501).json({
            error: 'Google Calendar requires Google login; configure OAuth env vars.',
            mode: AUTH_MODE_INFO.mode,
        });
    }
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
        const calendar = googleapis_1.google.calendar({ version: 'v3', auth: client });
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
        const busy = [];
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
    }
    catch (err) {
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

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calendarRouter = void 0;
const express_1 = require("express");
const googleapis_1 = require("googleapis");
const google_auth_library_1 = require("google-auth-library");
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map();
function getTokens(req) {
    const session = req.session;
    return session?.googleTokens ?? null;
}
function getOAuthClient() {
    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    const redirectUri = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/google/callback`;
    return new google_auth_library_1.OAuth2Client(clientId, clientSecret, redirectUri);
}
exports.calendarRouter = (0, express_1.Router)();
exports.calendarRouter.get('/busy', async (req, res) => {
    const tokens = getTokens(req);
    if (!tokens?.access_token) {
        return res.status(401).json({ error: 'Not authenticated with Google. Sign in with Google to import calendar.' });
    }
    const userEmail = (req.user?.email || '').toLowerCase().trim();
    const days = Math.min(parseInt(String(req.query.days || '7'), 10) || 7, 30);
    const cacheKey = `${userEmail}:${days}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() < cached.expires) {
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
        res.json(busy);
    }
    catch (err) {
        console.error('[Calendar] FreeBusy error', err);
        res.status(500).json({ error: 'Failed to fetch calendar busy times.' });
    }
});

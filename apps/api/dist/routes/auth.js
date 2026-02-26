"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const google_auth_library_1 = require("google-auth-library");
const identity_1 = require("../utils/identity");
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const MOCK_AUTH = process.env.MOCK_AUTH === 'true';
exports.authRouter = (0, express_1.Router)();
function getOAuthClient() {
    return new google_auth_library_1.OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, `${FRONTEND_URL}/auth/google/callback`);
}
exports.authRouter.get('/google/start', (req, res) => {
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
exports.authRouter.get('/google/callback', async (req, res) => {
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
            idToken: tokens.id_token,
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
        await new Promise((resolve, reject) => {
            req.session.save((err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
        res.redirect(FRONTEND_URL);
    }
    catch (err) {
        console.error('[Auth] Google callback error', err);
        res.redirect(`${FRONTEND_URL}/login?error=callback_failed`);
    }
});
exports.authRouter.post('/logout', (req, res) => {
    req.session.destroy(() => { });
    res.json({ ok: true });
});
exports.authRouter.get('/me', (req, res) => {
    if (MOCK_AUTH) {
        const email = req.headers['x-user-email']?.trim() || '';
        const name = req.headers['x-user-name']?.trim() || email.split('@')[0] || 'Mock User';
        if (!email) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        return res.json({
            email,
            name,
            picture: null,
            isTeacher: (0, identity_1.isTeacherEligible)(email),
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
        isTeacher: (0, identity_1.isTeacherEligible)(user.email),
    });
});

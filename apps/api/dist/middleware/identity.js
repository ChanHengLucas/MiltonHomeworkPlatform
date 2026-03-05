"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.identityMiddleware = identityMiddleware;
exports.requireAuth = requireAuth;
exports.requireTeacher = requireTeacher;
const identity_1 = require("../utils/identity");
const authMode_1 = require("../config/authMode");
const AUTH_MODE = (0, authMode_1.getAuthMode)();
const DEV_MODE_MISSING_HEADER_NOISE_PATHS = new Set([
    '/api/health',
    '/api/db/health',
    '/api/auth/me',
    '/auth/me',
    '/api/auth/google/start',
    '/api/auth/google/callback',
    '/auth/google/start',
    '/auth/google/callback',
]);
function identityMiddleware(logger) {
    return (req, _res, next) => {
        const sessionUser = req.session?.user;
        const headerEmail = req.headers['x-user-email']?.trim() || '';
        const headerName = req.headers['x-user-name']?.trim() || '';
        if (AUTH_MODE === 'google' && sessionUser?.email) {
            req.user = { email: sessionUser.email, name: sessionUser.name || sessionUser.email.split('@')[0] || '' };
        }
        else if (AUTH_MODE === 'dev' && headerEmail) {
            req.user = {
                email: headerEmail,
                name: headerName || headerEmail.split('@')[0] || 'anonymous',
            };
        }
        else {
            req.user = { email: '', name: 'anonymous' };
            const shouldWarnMissingHeader = AUTH_MODE === 'dev'
                && process.env.NODE_ENV === 'development'
                && logger
                && !DEV_MODE_MISSING_HEADER_NOISE_PATHS.has(req.path);
            if (shouldWarnMissingHeader) {
                logger.warn({ path: req.path }, '[API] Dev auth mode: Missing X-User-Email header');
            }
        }
        next();
    };
}
function requireAuth(req, res, next) {
    if (!req.user?.email) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }
    next();
}
function requireTeacher(req, res, next) {
    if (!req.user?.email) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }
    if (!(0, identity_1.isTeacherEligible)(req.user.email)) {
        res.status(403).json({ error: 'Teacher access required' });
        return;
    }
    next();
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.identityMiddleware = identityMiddleware;
exports.requireAuth = requireAuth;
exports.requireTeacher = requireTeacher;
const identity_1 = require("../utils/identity");
const MOCK_AUTH = process.env.MOCK_AUTH === 'true';
function identityMiddleware(logger) {
    return (req, _res, next) => {
        const sessionUser = req.session?.user;
        const headerEmail = req.headers['x-user-email']?.trim() || '';
        const headerName = req.headers['x-user-name']?.trim() || '';
        if (sessionUser?.email && !MOCK_AUTH) {
            req.user = { email: sessionUser.email, name: sessionUser.name || sessionUser.email.split('@')[0] || '' };
        }
        else if (headerEmail || MOCK_AUTH) {
            req.user = {
                email: headerEmail || '',
                name: headerName || (headerEmail ? headerEmail.split('@')[0] || '' : 'anonymous'),
            };
            if (!headerEmail && MOCK_AUTH && process.env.NODE_ENV === 'development' && logger) {
                logger.warn({ path: req.path }, '[API] MOCK_AUTH: Missing X-User-Email header');
            }
        }
        else {
            req.user = { email: '', name: 'anonymous' };
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

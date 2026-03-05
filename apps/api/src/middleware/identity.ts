import type { Request, Response, NextFunction } from 'express';
import { isTeacherEligible } from '../utils/identity';
import { getAuthMode } from '../config/authMode';

export interface UserIdentity {
  email: string;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: UserIdentity;
    }
  }
}

const AUTH_MODE = getAuthMode();
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

export function identityMiddleware(
  logger?: { warn: (o: object, msg: string) => void }
): (req: Request, _res: Response, next: NextFunction) => void {
  return (req: Request, _res: Response, next: NextFunction) => {
    const sessionUser = (req.session as { user?: { email: string; name: string } })?.user;
    const headerEmail = (req.headers['x-user-email'] as string)?.trim() || '';
    const headerName = (req.headers['x-user-name'] as string)?.trim() || '';

    if (AUTH_MODE === 'google' && sessionUser?.email) {
      req.user = { email: sessionUser.email, name: sessionUser.name || sessionUser.email.split('@')[0] || '' };
    } else if (AUTH_MODE === 'dev' && headerEmail) {
      req.user = {
        email: headerEmail,
        name: headerName || headerEmail.split('@')[0] || 'anonymous',
      };
    } else {
      req.user = { email: '', name: 'anonymous' };
      const shouldWarnMissingHeader =
        AUTH_MODE === 'dev'
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

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user?.email) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  next();
}

export function requireTeacher(req: Request, res: Response, next: NextFunction): void {
  if (!req.user?.email) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  if (!isTeacherEligible(req.user.email)) {
    res.status(403).json({ error: 'Teacher access required' });
    return;
  }
  next();
}

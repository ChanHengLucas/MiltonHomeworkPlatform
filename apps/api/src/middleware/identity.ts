import type { Request, Response, NextFunction } from 'express';
import { isTeacherEligible } from '../utils/identity';

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

const MOCK_AUTH = process.env.MOCK_AUTH === 'true';

export function identityMiddleware(
  logger?: { warn: (o: object, msg: string) => void }
): (req: Request, _res: Response, next: NextFunction) => void {
  return (req: Request, _res: Response, next: NextFunction) => {
    const sessionUser = (req.session as { user?: { email: string; name: string } })?.user;
    const headerEmail = (req.headers['x-user-email'] as string)?.trim() || '';
    const headerName = (req.headers['x-user-name'] as string)?.trim() || '';

    if (sessionUser?.email && !MOCK_AUTH) {
      req.user = { email: sessionUser.email, name: sessionUser.name || sessionUser.email.split('@')[0] || '' };
    } else if (headerEmail || MOCK_AUTH) {
      req.user = {
        email: headerEmail || '',
        name: headerName || (headerEmail ? headerEmail.split('@')[0] || '' : 'anonymous'),
      };
      if (!headerEmail && MOCK_AUTH && process.env.NODE_ENV === 'development' && logger) {
        logger.warn({ path: req.path }, '[API] MOCK_AUTH: Missing X-User-Email header');
      }
    } else {
      req.user = { email: '', name: 'anonymous' };
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

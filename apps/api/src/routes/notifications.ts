import { Router, Request } from 'express';
import {
  getUnreadNotificationCount,
  listNotificationsByUser,
  markAllNotificationsRead,
  markNotificationRead,
} from '@planner/db';
import { z } from 'zod';
import { requireAuth } from '../middleware/identity';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

notificationsRouter.get('/', (req: Request, res, next) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) {
    const err = new Error('Invalid query params') as Error & { statusCode?: number };
    err.statusCode = 400;
    return next(err);
  }
  const limit = parsed.data.limit ?? 50;
  const notifications = listNotificationsByUser(req.user!.email, limit);
  res.json(notifications);
});

notificationsRouter.get('/unread-count', (req: Request, res) => {
  const count = getUnreadNotificationCount(req.user!.email);
  res.json({ count });
});

notificationsRouter.post('/:id/read', (req: Request, res) => {
  const updated = markNotificationRead(req.user!.email, req.params.id);
  res.json({ ok: true, updated });
});

notificationsRouter.post('/read-all', (req: Request, res) => {
  const updated = markAllNotificationsRead(req.user!.email);
  res.json({ ok: true, updated });
});

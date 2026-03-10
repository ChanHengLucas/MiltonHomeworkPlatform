import { randomUUID } from 'crypto';
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import {
  deleteClosedRequestsOlderThanDays,
  deleteAllClosedRequests,
  addBlocklistEntry,
  listBlocklistEntries,
} from '@planner/db';
import { requireTeacher } from '../middleware/identity';

export const adminRouter = Router();

const blocklistBodySchema = z.object({
  blockedEmail: z.string().email(),
  blockedUntil: z.string().min(1), // ISO date
});

adminRouter.post('/cleanup-closed', requireTeacher, (req: Request, res: Response) => {
  const isProd = process.env.NODE_ENV === 'production';
  const token = process.env.ADMIN_CLEANUP_TOKEN;
  if (isProd && !token) {
    return res.status(403).json({ error: 'Cleanup disabled in production' });
  }
  const authHeader = req.headers.authorization;
  if (isProd && token && authHeader !== `Bearer ${token}`) {
    return res.status(403).json({ error: 'Invalid token' });
  }

  const daysParam = req.query.days as string | undefined;
  const days = daysParam ? parseInt(daysParam, 10) : 7;
  if (Number.isNaN(days) || days < 0) {
    return res.status(400).json({ error: 'Invalid days parameter' });
  }

  const logger = (req as Request & { log?: { info: (o: object, msg: string) => void } }).log;
  const result =
    days === 0 && !isProd
      ? deleteAllClosedRequests(logger)
      : deleteClosedRequestsOlderThanDays(days < 1 ? 7 : days, logger);
  res.json(result);
});

adminRouter.get('/blocklist', requireTeacher, (_req, res) => {
  const entries = listBlocklistEntries();
  res.json(entries);
});

adminRouter.post('/blocklist', requireTeacher, (req, res) => {
  const parsed = blocklistBodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors.map((e) => e.message).join('; ') });
  }
  const entry = {
    id: randomUUID(),
    blockedEmail: parsed.data.blockedEmail.toLowerCase().trim(),
    blockedUntil: parsed.data.blockedUntil,
    blockedByEmail: req.user?.email || '',
    createdAt: new Date().toISOString(),
  };
  addBlocklistEntry(entry);
  res.status(201).json(entry);
});

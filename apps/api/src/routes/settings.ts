import { Router, Request } from 'express';
import { z } from 'zod';
import { getPlannerPreferences, upsertPlannerPreferences } from '@planner/db';
import { requireAuth } from '../middleware/identity';

const plannerPreferencesSchema = z
  .object({
    studyWindowStartMin: z.number().int().min(0).max(1439),
    studyWindowEndMin: z.number().int().min(1).max(1440),
    maxSessionMin: z.number().int().min(5).max(180),
    breakBetweenSessionsMin: z.number().int().min(0).max(120),
    avoidLateNight: z.boolean(),
    coursePriorityWeights: z.record(z.number().min(-5).max(5)).default({}),
  })
  .refine((value) => value.studyWindowEndMin > value.studyWindowStartMin, {
    message: 'Preferred study window end must be after start.',
    path: ['studyWindowEndMin'],
  });

export const settingsRouter = Router();

settingsRouter.use(requireAuth);

settingsRouter.get('/planner-preferences', (req, res) => {
  const email = req.user!.email;
  const preferences = getPlannerPreferences(email);
  res.json(preferences);
});

settingsRouter.put('/planner-preferences', (req: Request, res, next) => {
  const parsed = plannerPreferencesSchema.safeParse(req.body);
  if (!parsed.success) {
    const err = new Error(parsed.error.errors.map((e) => e.message).join('; ')) as Error & {
      statusCode?: number;
    };
    err.statusCode = 400;
    return next(err);
  }

  const saved = upsertPlannerPreferences(req.user!.email, parsed.data);
  const log = (req as Request & { log?: { info: (obj: object, message: string) => void } }).log;
  if (log) {
    log.info(
      {
        userEmail: req.user!.email,
        maxSessionMin: saved.maxSessionMin,
        breakBetweenSessionsMin: saved.breakBetweenSessionsMin,
      },
      '[Settings] Updated planner preferences'
    );
  }
  res.json(saved);
});

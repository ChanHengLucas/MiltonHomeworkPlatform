import { Router, Request } from 'express';
import { getDatabaseFilePath, runDbHealthCheck } from '@planner/db';

export const dbRouter = Router();

dbRouter.get('/health', (req: Request, res, next) => {
  try {
    const result = runDbHealthCheck();
    res.json(result);
  } catch (err) {
    const log = (req as Request & {
      log?: { error: (obj: object, message: string) => void };
    }).log;
    if (log) {
      const e = err as { code?: string; message?: string };
      log.error(
        {
          code: e.code ?? 'UNKNOWN',
          message: e.message ?? String(err),
          dbFile: getDatabaseFilePath(),
        },
        '[DB] Health check failed'
      );
    }
    const error = new Error('Database health check failed') as Error & { statusCode?: number };
    error.statusCode = 500;
    next(error);
  }
});

import type { Request, Response, NextFunction } from 'express';
import type { Logger } from 'pino';

export function errorHandler(logger: Logger) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return (err: Error & { statusCode?: number }, req: Request, res: Response, _next: NextFunction): void => {
    const status = err.statusCode ?? 500;
    const requestId = String((req as Request & { id?: string | number }).id ?? '');

    if (status >= 500) {
      logger.error({ err: err.stack, requestId }, '[API] Unexpected error');
    } else {
      logger.warn({ err: err.message, requestId }, '[API] Validation/client error');
    }

    res.status(status).json({
      error: err.message ?? 'Internal server error',
      ...(requestId && { requestId }),
      ...(status >= 500 && process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  };
}

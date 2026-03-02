import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Request } from 'express';
import session from 'express-session';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { initDb, deleteClosedRequestsOlderThanDays, getDatabaseFilePath } from '@planner/db';

import { authRouter } from './routes/auth';
import { calendarRouter } from './routes/calendar';
import { assignmentsRouter } from './routes/assignments';
import { teacherRouter } from './routes/teacher';
import { studentRouter } from './routes/student';
import { availabilityRouter } from './routes/availability';
import { insightsRouter } from './routes/insights';
import { planRouter } from './routes/plan';
import { requestsRouter } from './routes/requests';
import { adminRouter } from './routes/admin';
import { settingsRouter } from './routes/settings';
import { dbRouter } from './routes/db';
import { notificationsRouter } from './routes/notifications';
import { errorHandler } from './middleware/errorHandler';
import { identityMiddleware } from './middleware/identity';
import { runDueReminderScan } from './services/notifications';

const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport:
    process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-in-prod';

const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json());
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}));
app.use(identityMiddleware(logger));
app.use(
  pinoHttp({
    logger,
    customLogLevel: (req, res, err) => {
      if (res.statusCode >= 500 || err) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    customSuccessMessage: (req, res) =>
      `${req.method} ${req.url} ${res.statusCode}`,
    customErrorMessage: (req, res, err) =>
      `${req.method} ${req.url} ${res.statusCode} - ${err?.message ?? 'Unknown error'}`,
  }),
);
app.use((req, res, next) => {
  const requestId = String((req as Request & { id?: string | number }).id ?? '');
  if (requestId) {
    res.setHeader('X-Request-Id', requestId);
  }
  next();
});

app.use('/auth', authRouter);
app.use('/api/db', dbRouter);
app.use('/api/calendar', calendarRouter);
app.use('/api/assignments', assignmentsRouter);
app.use('/api/teacher', teacherRouter);
app.use('/api/student', studentRouter);
app.use('/api/availability', availabilityRouter);
app.use('/api/plan', planRouter);
app.use('/api/requests', requestsRouter);
app.use('/api/insights', insightsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/notifications', notificationsRouter);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.use(errorHandler(logger));

const CLEANUP_TTL_DAYS = parseInt(process.env.CLEANUP_TTL_DAYS ?? '7', 10) || 7;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const DUE_REMINDER_INTERVAL_MS = parseInt(process.env.DUE_REMINDER_INTERVAL_MS ?? '600000', 10) || 600000;

function start(): void {
  logger.info('[API] Starting...');
  try {
    initDb();
    logger.info({ dbFile: getDatabaseFilePath() }, '[API] Database initialized');
  } catch (err) {
    logger.error({ err }, '[API] Failed to initialize database');
    process.exit(1);
  }

  setInterval(() => {
    try {
      deleteClosedRequestsOlderThanDays(CLEANUP_TTL_DAYS, logger);
    } catch (err) {
      logger.error({ err }, '[API] Cleanup job failed');
    }
  }, CLEANUP_INTERVAL_MS);
  logger.info({ ttlDays: CLEANUP_TTL_DAYS }, '[API] Cleanup job scheduled');

  try {
    runDueReminderScan(logger);
  } catch (err) {
    logger.error({ err }, '[API] Initial due-reminder scan failed');
  }
  setInterval(() => {
    try {
      runDueReminderScan(logger);
    } catch (err) {
      logger.error({ err }, '[API] Due-reminder job failed');
    }
  }, DUE_REMINDER_INTERVAL_MS);
  logger.info({ intervalMs: DUE_REMINDER_INTERVAL_MS }, '[API] Due-reminder job scheduled');

  app.listen(PORT, () => {
    logger.info({ port: PORT }, '[API] API listening on port %s', PORT);
    // eslint-disable-next-line no-console
    console.log(`\n  API: http://localhost:${PORT}`);
  });
}

start();

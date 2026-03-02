"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const express_session_1 = __importDefault(require("express-session"));
const pino_1 = __importDefault(require("pino"));
const pino_http_1 = __importDefault(require("pino-http"));
const db_1 = require("@planner/db");
const auth_1 = require("./routes/auth");
const calendar_1 = require("./routes/calendar");
const assignments_1 = require("./routes/assignments");
const teacher_1 = require("./routes/teacher");
const student_1 = require("./routes/student");
const availability_1 = require("./routes/availability");
const insights_1 = require("./routes/insights");
const plan_1 = require("./routes/plan");
const requests_1 = require("./routes/requests");
const admin_1 = require("./routes/admin");
const settings_1 = require("./routes/settings");
const db_2 = require("./routes/db");
const notifications_1 = require("./routes/notifications");
const errorHandler_1 = require("./middleware/errorHandler");
const identity_1 = require("./middleware/identity");
const notifications_2 = require("./services/notifications");
const logger = (0, pino_1.default)({
    level: process.env.LOG_LEVEL ?? 'info',
    transport: process.env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
});
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-in-prod';
const app = (0, express_1.default)();
const PORT = process.env.PORT ?? 4000;
app.use((0, cors_1.default)({
    origin: FRONTEND_URL,
    credentials: true,
}));
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.json());
app.use((0, express_session_1.default)({
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
app.use((0, identity_1.identityMiddleware)(logger));
app.use((0, pino_http_1.default)({
    logger,
    customLogLevel: (req, res, err) => {
        if (res.statusCode >= 500 || err)
            return 'error';
        if (res.statusCode >= 400)
            return 'warn';
        return 'info';
    },
    customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
    customErrorMessage: (req, res, err) => `${req.method} ${req.url} ${res.statusCode} - ${err?.message ?? 'Unknown error'}`,
}));
app.use((req, res, next) => {
    const requestId = String(req.id ?? '');
    if (requestId) {
        res.setHeader('X-Request-Id', requestId);
    }
    next();
});
app.use('/auth', auth_1.authRouter);
app.use('/api/db', db_2.dbRouter);
app.use('/api/calendar', calendar_1.calendarRouter);
app.use('/api/assignments', assignments_1.assignmentsRouter);
app.use('/api/teacher', teacher_1.teacherRouter);
app.use('/api/student', student_1.studentRouter);
app.use('/api/availability', availability_1.availabilityRouter);
app.use('/api/plan', plan_1.planRouter);
app.use('/api/requests', requests_1.requestsRouter);
app.use('/api/insights', insights_1.insightsRouter);
app.use('/api/admin', admin_1.adminRouter);
app.use('/api/settings', settings_1.settingsRouter);
app.use('/api/notifications', notifications_1.notificationsRouter);
app.get('/api/health', (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
});
app.use((0, errorHandler_1.errorHandler)(logger));
const CLEANUP_TTL_DAYS = parseInt(process.env.CLEANUP_TTL_DAYS ?? '7', 10) || 7;
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const DUE_REMINDER_INTERVAL_MS = parseInt(process.env.DUE_REMINDER_INTERVAL_MS ?? '600000', 10) || 600000;
function start() {
    logger.info('[API] Starting...');
    try {
        (0, db_1.initDb)();
        logger.info({ dbFile: (0, db_1.getDatabaseFilePath)() }, '[API] Database initialized');
    }
    catch (err) {
        logger.error({ err }, '[API] Failed to initialize database');
        process.exit(1);
    }
    setInterval(() => {
        try {
            (0, db_1.deleteClosedRequestsOlderThanDays)(CLEANUP_TTL_DAYS, logger);
        }
        catch (err) {
            logger.error({ err }, '[API] Cleanup job failed');
        }
    }, CLEANUP_INTERVAL_MS);
    logger.info({ ttlDays: CLEANUP_TTL_DAYS }, '[API] Cleanup job scheduled');
    try {
        (0, notifications_2.runDueReminderScan)(logger);
    }
    catch (err) {
        logger.error({ err }, '[API] Initial due-reminder scan failed');
    }
    setInterval(() => {
        try {
            (0, notifications_2.runDueReminderScan)(logger);
        }
        catch (err) {
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

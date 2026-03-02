"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDatabaseFilePath = getDatabaseFilePath;
exports.getDb = getDb;
exports.applyMigrations = applyMigrations;
exports.initDb = initDb;
exports.runDbHealthCheck = runDbHealthCheck;
exports.listAssignments = listAssignments;
exports.createAssignment = createAssignment;
exports.updateAssignmentCompletion = updateAssignmentCompletion;
exports.deleteAssignment = deleteAssignment;
exports.listAvailabilityBlocks = listAvailabilityBlocks;
exports.createAvailabilityBlock = createAvailabilityBlock;
exports.deleteAvailabilityBlock = deleteAvailabilityBlock;
exports.createCourse = createCourse;
exports.listCoursesByTeacher = listCoursesByTeacher;
exports.getCourse = getCourse;
exports.getCourseByCode = getCourseByCode;
exports.addCourseMember = addCourseMember;
exports.listCourseMembers = listCourseMembers;
exports.isStudentInCourse = isStudentInCourse;
exports.listCoursesByStudent = listCoursesByStudent;
exports.createCourseAssignment = createCourseAssignment;
exports.listCourseAssignmentsForStudent = listCourseAssignmentsForStudent;
exports.listCourseAssignmentsByCourse = listCourseAssignmentsByCourse;
exports.createCourseAnnouncement = createCourseAnnouncement;
exports.listCourseAnnouncementsByCourse = listCourseAnnouncementsByCourse;
exports.createGradingTask = createGradingTask;
exports.listGradingTasksByTeacher = listGradingTasksByTeacher;
exports.deleteGradingTask = deleteGradingTask;
exports.getPlannerPreferences = getPlannerPreferences;
exports.upsertPlannerPreferences = upsertPlannerPreferences;
exports.createNotification = createNotification;
exports.listNotificationsByUser = listNotificationsByUser;
exports.getUnreadNotificationCount = getUnreadNotificationCount;
exports.markNotificationRead = markNotificationRead;
exports.markAllNotificationsRead = markAllNotificationsRead;
exports.listCourseAssignmentDueReminderCandidates = listCourseAssignmentDueReminderCandidates;
exports.upsertCourseFeedback = upsertCourseFeedback;
exports.getCourseFeedbackByStudent = getCourseFeedbackByStudent;
exports.getCourseFeedbackSummary = getCourseFeedbackSummary;
exports.createHelpRequest = createHelpRequest;
exports.listHelpRequests = listHelpRequests;
exports.listHelpRequestsVisibleTo = listHelpRequestsVisibleTo;
exports.getHelpRequestById = getHelpRequestById;
exports.claimHelpRequest = claimHelpRequest;
exports.unclaimHelpRequest = unclaimHelpRequest;
exports.closeHelpRequest = closeHelpRequest;
exports.deleteAllClosedRequests = deleteAllClosedRequests;
exports.deleteClosedRequestsOlderThanDays = deleteClosedRequestsOlderThanDays;
exports.listCommentsForRequest = listCommentsForRequest;
exports.addComment = addComment;
exports.countActiveClaimsByEmail = countActiveClaimsByEmail;
exports.countClaimsInLastHour = countClaimsInLastHour;
exports.recordClaimEvent = recordClaimEvent;
exports.isBlocked = isBlocked;
exports.addBlocklistEntry = addBlocklistEntry;
exports.listBlocklistEntries = listBlocklistEntries;
exports.createReport = createReport;
exports.listReports = listReports;
exports.getRequestActivity = getRequestActivity;
exports.getRequestsSummary = getRequestsSummary;
exports.getInsightsStats = getInsightsStats;
const crypto_1 = require("crypto");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
let dbInstance = null;
let dbFilePath = null;
function resolveDatabaseFile() {
    const envPath = process.env.DATABASE_FILE;
    const rawPath = envPath && envPath.trim().length > 0
        ? envPath
        : path_1.default.join(process.cwd(), 'data', 'app.db');
    const dbPath = path_1.default.resolve(rawPath);
    const dir = path_1.default.dirname(dbPath);
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
    }
    return dbPath;
}
function getDatabaseFilePath() {
    if (dbFilePath)
        return dbFilePath;
    dbFilePath = resolveDatabaseFile();
    return dbFilePath;
}
function logWriteError(operation, err) {
    const sqlErr = err;
    const message = sqlErr?.message ?? (err instanceof Error ? err.message : 'Unknown DB write error');
    // eslint-disable-next-line no-console
    console.error('[DB][WRITE_ERROR]', {
        operation,
        code: sqlErr?.code ?? 'UNKNOWN',
        message,
        dbFile: getDatabaseFilePath(),
    });
}
function runWrite(operation, fn) {
    try {
        return fn();
    }
    catch (err) {
        logWriteError(operation, err);
        throw err;
    }
}
function getDb() {
    if (!dbInstance) {
        const file = getDatabaseFilePath();
        dbInstance = new better_sqlite3_1.default(file);
        dbInstance.pragma('journal_mode = WAL');
        dbInstance.pragma('synchronous = NORMAL');
        dbInstance.pragma('busy_timeout = 5000');
    }
    return dbInstance;
}
const MIGRATIONS = [
    {
        id: '001_initial_planner',
        up: `
      CREATE TABLE IF NOT EXISTS assignments (
        id TEXT PRIMARY KEY,
        course TEXT NOT NULL,
        title TEXT NOT NULL,
        dueAt TEXT,
        estMinutes INTEGER NOT NULL,
        priority INTEGER NOT NULL,
        type TEXT NOT NULL,
        completed INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS availability_blocks (
        id TEXT PRIMARY KEY,
        startMin INTEGER NOT NULL,
        endMin INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS migrations (
        id TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      );
    `
    },
    {
        id: '002_support_hub',
        up: `
      CREATE TABLE IF NOT EXISTS help_requests (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        subject TEXT NOT NULL,
        urgency TEXT NOT NULL,
        status TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        claimedBy TEXT,
        linkedAssignmentId TEXT
      );

      CREATE TABLE IF NOT EXISTS help_comments (
        id TEXT PRIMARY KEY,
        requestId TEXT NOT NULL,
        authorLabel TEXT NOT NULL,
        body TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (requestId) REFERENCES help_requests(id) ON DELETE CASCADE
      );
    `
    },
    {
        id: '003_dueat_epoch_closedat',
        up: `
      CREATE TABLE IF NOT EXISTS assignments_new (
        id TEXT PRIMARY KEY,
        course TEXT NOT NULL,
        title TEXT NOT NULL,
        dueAt INTEGER,
        estMinutes INTEGER NOT NULL,
        priority INTEGER NOT NULL,
        type TEXT NOT NULL,
        completed INTEGER NOT NULL DEFAULT 0
      );
      INSERT INTO assignments_new (id, course, title, dueAt, estMinutes, priority, type, completed)
      SELECT id, course, title,
        NULLIF(
          CASE
            WHEN dueAt IS NULL OR dueAt = '' THEN NULL
            WHEN dueAt GLOB '[0-9][0-9][0-9][0-9]-*' THEN CAST(strftime('%s', substr(replace(substr(dueAt, 1, 19), 'T', ' '), 1, 19)) * 1000 AS INTEGER)
            WHEN dueAt GLOB '[0-9]*' THEN CAST(dueAt AS INTEGER)
            ELSE NULL
          END,
          0
        ),
        estMinutes, priority, type, completed
      FROM assignments;
      DROP TABLE assignments;
      ALTER TABLE assignments_new RENAME TO assignments;
      ALTER TABLE help_requests ADD COLUMN closedAt TEXT;
    `
    },
    {
        id: '004_identity_columns',
        up: `
      ALTER TABLE help_requests ADD COLUMN createdByEmail TEXT;
      ALTER TABLE help_requests ADD COLUMN claimedByEmail TEXT;
      ALTER TABLE help_comments ADD COLUMN authorDisplayName TEXT;
    `
    },
    {
        id: '005_comment_author_email',
        up: `
      ALTER TABLE help_comments ADD COLUMN authorEmail TEXT;
    `
    },
    {
        id: '006_claimed_unclaimed_at',
        up: `
      ALTER TABLE help_requests ADD COLUMN claimedAt TEXT;
      ALTER TABLE help_requests ADD COLUMN unclaimedAt TEXT;
      ALTER TABLE help_requests ADD COLUMN unclaimedByEmail TEXT;
    `
    },
    {
        id: '007_help_reports',
        up: `
      CREATE TABLE IF NOT EXISTS help_reports (
        id TEXT PRIMARY KEY,
        requestId TEXT NOT NULL,
        reportedEmail TEXT NOT NULL,
        reason TEXT NOT NULL,
        details TEXT,
        reportedByEmail TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (requestId) REFERENCES help_requests(id) ON DELETE CASCADE
      );
    `
    },
    {
        id: '008_claim_blocklist',
        up: `
      CREATE TABLE IF NOT EXISTS claim_blocklist (
        id TEXT PRIMARY KEY,
        blockedEmail TEXT NOT NULL,
        blockedUntil TEXT NOT NULL,
        blockedByEmail TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );
    `
    },
    {
        id: '009_claim_events',
        up: `
      CREATE TABLE IF NOT EXISTS help_claim_events (
        id TEXT PRIMARY KEY,
        requestId TEXT NOT NULL,
        claimedByEmail TEXT NOT NULL,
        claimedAt TEXT NOT NULL
      );
    `
    },
    {
        id: '010_courses',
        up: `
      CREATE TABLE IF NOT EXISTS courses (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        teacherEmail TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS course_members (
        courseId TEXT NOT NULL,
        studentEmail TEXT NOT NULL,
        PRIMARY KEY (courseId, studentEmail),
        FOREIGN KEY (courseId) REFERENCES courses(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS course_assignments (
        id TEXT PRIMARY KEY,
        courseId TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        dueAtMs INTEGER,
        estMinutes INTEGER NOT NULL,
        type TEXT NOT NULL,
        createdByEmail TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (courseId) REFERENCES courses(id) ON DELETE CASCADE
      );
    `
    },
    {
        id: '011_grading_tasks',
        up: `
      CREATE TABLE IF NOT EXISTS grading_tasks (
        id TEXT PRIMARY KEY,
        teacherEmail TEXT NOT NULL,
        title TEXT NOT NULL,
        dueAtMs INTEGER,
        estMinutes INTEGER NOT NULL,
        createdAt TEXT NOT NULL
      );
    `
    },
    {
        id: '012_planner_preferences',
        up: `
      CREATE TABLE IF NOT EXISTS planner_preferences (
        userEmail TEXT PRIMARY KEY,
        studyWindowStartMin INTEGER NOT NULL DEFAULT 480,
        studyWindowEndMin INTEGER NOT NULL DEFAULT 1320,
        maxSessionMin INTEGER NOT NULL DEFAULT 45,
        breakBetweenSessionsMin INTEGER NOT NULL DEFAULT 10,
        avoidLateNight INTEGER NOT NULL DEFAULT 1,
        coursePriorityWeightsJson TEXT,
        updatedAt TEXT NOT NULL
      );
    `
    },
    {
        id: '013_course_codes_announcements',
        up: `
      ALTER TABLE courses ADD COLUMN courseCode TEXT;
      UPDATE courses
      SET courseCode = UPPER(SUBSTR(REPLACE(id, '-', ''), 1, 8))
      WHERE courseCode IS NULL OR courseCode = '';
      CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_courseCode ON courses(courseCode);

      CREATE TABLE IF NOT EXISTS course_announcements (
        id TEXT PRIMARY KEY,
        courseId TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        createdByEmail TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (courseId) REFERENCES courses(id) ON DELETE CASCADE
      );
    `
    },
    {
        id: '014_support_request_meeting_claim_mode',
        up: `
      ALTER TABLE help_requests ADD COLUMN claimMode TEXT NOT NULL DEFAULT 'any';
      ALTER TABLE help_requests ADD COLUMN meetingAbout TEXT;
      ALTER TABLE help_requests ADD COLUMN meetingLocation TEXT;
      ALTER TABLE help_requests ADD COLUMN meetingLink TEXT;
      ALTER TABLE help_requests ADD COLUMN proposedTimes TEXT;
    `
    },
    {
        id: '015_notifications_feedback',
        up: `
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        userEmail TEXT NOT NULL,
        type TEXT NOT NULL,
        payloadJson TEXT,
        dedupeKey TEXT,
        createdAt TEXT NOT NULL,
        readAt TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(userEmail, createdAt DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(userEmail, readAt);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe ON notifications(dedupeKey) WHERE dedupeKey IS NOT NULL;

      CREATE TABLE IF NOT EXISTS course_feedback (
        id TEXT PRIMARY KEY,
        courseId TEXT NOT NULL,
        studentEmail TEXT NOT NULL,
        rating INTEGER NOT NULL,
        comment TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (courseId) REFERENCES courses(id) ON DELETE CASCADE,
        UNIQUE(courseId, studentEmail)
      );
      CREATE INDEX IF NOT EXISTS idx_course_feedback_course ON course_feedback(courseId, updatedAt DESC);
    `
    }
];
function applyMigrations() {
    const db = getDb();
    db.exec('BEGIN');
    try {
        db.exec(`CREATE TABLE IF NOT EXISTS migrations (
        id TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      );`);
        const hasMigrationStmt = db.prepare('SELECT COUNT(1) as count FROM migrations WHERE id = ?');
        const insertMigrationStmt = db.prepare('INSERT INTO migrations (id, applied_at) VALUES (?, ?)');
        for (const migration of MIGRATIONS) {
            const row = hasMigrationStmt.get(migration.id);
            if (!row || row.count === 0) {
                runWrite(`migration:${migration.id}:exec`, () => db.exec(migration.up));
                runWrite(`migration:${migration.id}:record`, () => insertMigrationStmt.run(migration.id, new Date().toISOString()));
            }
        }
        db.exec('COMMIT');
    }
    catch (err) {
        db.exec('ROLLBACK');
        throw err;
    }
}
function initDb() {
    const db = getDb();
    applyMigrations();
    return db;
}
function runDbHealthCheck() {
    const db = getDb();
    const checkedAt = new Date().toISOString();
    const marker = (0, crypto_1.randomUUID)();
    runWrite('db_health.createTempTable', () => db.exec(`CREATE TEMP TABLE IF NOT EXISTS __db_health_check (
        id TEXT PRIMARY KEY,
        createdAt TEXT NOT NULL
      );`));
    runWrite('db_health.insert', () => db.prepare('INSERT INTO __db_health_check (id, createdAt) VALUES (?, ?)').run(marker, checkedAt));
    const row = db.prepare('SELECT id FROM __db_health_check WHERE id = ?').get(marker);
    if (!row) {
        throw new Error('DB health read failed after write');
    }
    runWrite('db_health.delete', () => db.prepare('DELETE FROM __db_health_check WHERE id = ?').run(marker));
    return {
        ok: true,
        dbFile: getDatabaseFilePath(),
        checkedAt,
    };
}
// Assignment repository
function listAssignments() {
    const db = getDb();
    const rows = db
        .prepare('SELECT * FROM assignments ORDER BY dueAt IS NULL, dueAt ASC, title ASC')
        .all();
    return rows.map((row) => ({
        id: row.id,
        course: row.course,
        title: row.title,
        dueAt: row.dueAt != null && row.dueAt > 0 ? row.dueAt : undefined,
        estMinutes: row.estMinutes,
        priority: row.priority,
        type: row.type,
        completed: !!row.completed
    }));
}
function createAssignment(assignment) {
    const db = getDb();
    const stmt = db.prepare(`INSERT INTO assignments
      (id, course, title, dueAt, estMinutes, priority, type, completed)
     VALUES (@id, @course, @title, @dueAt, @estMinutes, @priority, @type, @completed)`);
    const dueAt = assignment.dueAt != null && assignment.dueAt > 0 ? assignment.dueAt : null;
    runWrite('assignments.insert', () => stmt.run({
        ...assignment,
        dueAt,
        completed: assignment.completed ? 1 : 0
    }));
    return assignment;
}
function updateAssignmentCompletion(id, completed) {
    const db = getDb();
    runWrite('assignments.updateCompletion', () => db.prepare('UPDATE assignments SET completed = ? WHERE id = ?').run(completed ? 1 : 0, id));
}
function deleteAssignment(id) {
    const db = getDb();
    runWrite('assignments.delete', () => db.prepare('DELETE FROM assignments WHERE id = ?').run(id));
}
// Availability repository
function listAvailabilityBlocks() {
    const db = getDb();
    const rows = db
        .prepare('SELECT * FROM availability_blocks ORDER BY startMin ASC')
        .all();
    return rows.map((row) => ({
        id: row.id,
        startMin: row.startMin,
        endMin: row.endMin
    }));
}
function createAvailabilityBlock(block) {
    const db = getDb();
    runWrite('availability.insert', () => db.prepare(`INSERT INTO availability_blocks (id, startMin, endMin)
       VALUES (@id, @startMin, @endMin)`).run(block));
    return block;
}
function deleteAvailabilityBlock(id) {
    const db = getDb();
    runWrite('availability.delete', () => db.prepare('DELETE FROM availability_blocks WHERE id = ?').run(id));
}
function createCourse(course) {
    const db = getDb();
    runWrite('courses.insert', () => db.prepare('INSERT INTO courses (id, name, courseCode, teacherEmail, createdAt) VALUES (@id, @name, @courseCode, @teacherEmail, @createdAt)').run(course));
    return course;
}
function listCoursesByTeacher(teacherEmail) {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM courses WHERE teacherEmail = ? ORDER BY name ASC').all(teacherEmail);
    return rows;
}
function getCourse(id) {
    const db = getDb();
    const row = db.prepare('SELECT * FROM courses WHERE id = ?').get(id);
    return row ?? null;
}
function getCourseByCode(code) {
    const db = getDb();
    const normalized = code.trim().toUpperCase();
    const row = db
        .prepare('SELECT * FROM courses WHERE UPPER(courseCode) = ?')
        .get(normalized);
    return row ?? null;
}
function addCourseMember(courseId, studentEmail) {
    const db = getDb();
    const email = studentEmail.toLowerCase().trim();
    runWrite('course_members.insertOrIgnore', () => db.prepare('INSERT OR IGNORE INTO course_members (courseId, studentEmail) VALUES (?, ?)').run(courseId, email));
}
function listCourseMembers(courseId) {
    const db = getDb();
    const rows = db.prepare('SELECT studentEmail FROM course_members WHERE courseId = ?').all(courseId);
    return rows.map((r) => r.studentEmail);
}
function isStudentInCourse(courseId, studentEmail) {
    const db = getDb();
    const email = studentEmail.toLowerCase().trim();
    const row = db
        .prepare('SELECT 1 FROM course_members WHERE courseId = ? AND studentEmail = ? LIMIT 1')
        .get(courseId, email);
    return !!row;
}
function listCoursesByStudent(studentEmail) {
    const db = getDb();
    const email = studentEmail.toLowerCase().trim();
    const rows = db
        .prepare(`SELECT c.*
       FROM courses c
       INNER JOIN course_members cm ON cm.courseId = c.id
       WHERE cm.studentEmail = ?
       ORDER BY c.name ASC`)
        .all(email);
    return rows;
}
function createCourseAssignment(a) {
    const db = getDb();
    runWrite('course_assignments.insert', () => db.prepare(`INSERT INTO course_assignments (id, courseId, title, description, dueAtMs, estMinutes, type, createdByEmail, createdAt)
       VALUES (@id, @courseId, @title, @description, @dueAtMs, @estMinutes, @type, @createdByEmail, @createdAt)`).run(a));
    return a;
}
function listCourseAssignmentsForStudent(studentEmail) {
    const db = getDb();
    const email = studentEmail.toLowerCase().trim();
    const rows = db
        .prepare(`SELECT ca.*, c.name as courseName FROM course_assignments ca
       INNER JOIN course_members cm ON ca.courseId = cm.courseId
       INNER JOIN courses c ON ca.courseId = c.id
       WHERE cm.studentEmail = ?
       ORDER BY ca.dueAtMs IS NULL, ca.dueAtMs ASC, ca.title ASC`)
        .all(email);
    return rows;
}
function listCourseAssignmentsByCourse(courseId) {
    const db = getDb();
    const rows = db
        .prepare('SELECT * FROM course_assignments WHERE courseId = ? ORDER BY dueAtMs IS NULL, dueAtMs ASC, title ASC')
        .all(courseId);
    return rows;
}
function createCourseAnnouncement(announcement) {
    const db = getDb();
    runWrite('course_announcements.insert', () => db.prepare(`INSERT INTO course_announcements
        (id, courseId, title, body, createdByEmail, createdAt)
       VALUES
        (@id, @courseId, @title, @body, @createdByEmail, @createdAt)`).run(announcement));
    return announcement;
}
function listCourseAnnouncementsByCourse(courseId) {
    const db = getDb();
    const rows = db
        .prepare('SELECT * FROM course_announcements WHERE courseId = ? ORDER BY createdAt DESC')
        .all(courseId);
    return rows;
}
// Grading tasks (teacher)
function createGradingTask(task) {
    const db = getDb();
    runWrite('grading_tasks.insert', () => db.prepare('INSERT INTO grading_tasks (id, teacherEmail, title, dueAtMs, estMinutes, createdAt) VALUES (@id, @teacherEmail, @title, @dueAtMs, @estMinutes, @createdAt)').run(task));
    return task;
}
function listGradingTasksByTeacher(teacherEmail) {
    const db = getDb();
    const rows = db
        .prepare('SELECT * FROM grading_tasks WHERE teacherEmail = ? ORDER BY dueAtMs IS NULL, dueAtMs ASC, title ASC')
        .all(teacherEmail);
    return rows;
}
function deleteGradingTask(id, teacherEmail) {
    const db = getDb();
    runWrite('grading_tasks.delete', () => db.prepare('DELETE FROM grading_tasks WHERE id = ? AND teacherEmail = ?').run(id, teacherEmail));
}
const DEFAULT_PREFERENCES = {
    studyWindowStartMin: 8 * 60,
    studyWindowEndMin: 22 * 60,
    maxSessionMin: 45,
    breakBetweenSessionsMin: 10,
    avoidLateNight: true,
};
function clampInt(value, min, max) {
    return Math.min(max, Math.max(min, Math.round(value)));
}
function normalizeEmail(email) {
    return email.toLowerCase().trim();
}
function parseCoursePriorityWeights(raw) {
    if (!raw)
        return {};
    try {
        const parsed = JSON.parse(raw);
        const out = {};
        for (const [course, weight] of Object.entries(parsed)) {
            if (typeof course !== 'string')
                continue;
            if (typeof weight !== 'number' || !Number.isFinite(weight))
                continue;
            out[course.toLowerCase().trim()] = clampInt(weight, -5, 5);
        }
        return out;
    }
    catch {
        return {};
    }
}
function getPlannerPreferences(userEmail) {
    const db = getDb();
    const email = normalizeEmail(userEmail);
    if (!email) {
        return {
            userEmail: '',
            ...DEFAULT_PREFERENCES,
            coursePriorityWeights: {},
            updatedAt: new Date().toISOString(),
        };
    }
    const row = db
        .prepare(`SELECT userEmail, studyWindowStartMin, studyWindowEndMin, maxSessionMin, breakBetweenSessionsMin, avoidLateNight, coursePriorityWeightsJson, updatedAt
       FROM planner_preferences
       WHERE userEmail = ?`)
        .get(email);
    if (!row) {
        return {
            userEmail: email,
            ...DEFAULT_PREFERENCES,
            coursePriorityWeights: {},
            updatedAt: new Date().toISOString(),
        };
    }
    return {
        userEmail: row.userEmail,
        studyWindowStartMin: clampInt(row.studyWindowStartMin, 0, 1439),
        studyWindowEndMin: clampInt(row.studyWindowEndMin, 1, 1440),
        maxSessionMin: clampInt(row.maxSessionMin, 5, 180),
        breakBetweenSessionsMin: clampInt(row.breakBetweenSessionsMin, 0, 120),
        avoidLateNight: row.avoidLateNight === 1,
        coursePriorityWeights: parseCoursePriorityWeights(row.coursePriorityWeightsJson),
        updatedAt: row.updatedAt,
    };
}
function upsertPlannerPreferences(userEmail, update) {
    const db = getDb();
    const email = normalizeEmail(userEmail);
    const now = new Date().toISOString();
    const studyWindowStartMin = clampInt(update.studyWindowStartMin, 0, 1439);
    const studyWindowEndMin = clampInt(update.studyWindowEndMin, 1, 1440);
    const maxSessionMin = clampInt(update.maxSessionMin, 5, 180);
    const breakBetweenSessionsMin = clampInt(update.breakBetweenSessionsMin, 0, 120);
    const normalizedWeights = {};
    for (const [course, weight] of Object.entries(update.coursePriorityWeights || {})) {
        const key = course.toLowerCase().trim();
        if (!key)
            continue;
        if (typeof weight !== 'number' || !Number.isFinite(weight))
            continue;
        normalizedWeights[key] = clampInt(weight, -5, 5);
    }
    runWrite('planner_preferences.upsert', () => db.prepare(`INSERT INTO planner_preferences
        (userEmail, studyWindowStartMin, studyWindowEndMin, maxSessionMin, breakBetweenSessionsMin, avoidLateNight, coursePriorityWeightsJson, updatedAt)
       VALUES
        (@userEmail, @studyWindowStartMin, @studyWindowEndMin, @maxSessionMin, @breakBetweenSessionsMin, @avoidLateNight, @coursePriorityWeightsJson, @updatedAt)
       ON CONFLICT(userEmail) DO UPDATE SET
        studyWindowStartMin = excluded.studyWindowStartMin,
        studyWindowEndMin = excluded.studyWindowEndMin,
        maxSessionMin = excluded.maxSessionMin,
        breakBetweenSessionsMin = excluded.breakBetweenSessionsMin,
        avoidLateNight = excluded.avoidLateNight,
        coursePriorityWeightsJson = excluded.coursePriorityWeightsJson,
        updatedAt = excluded.updatedAt`).run({
        userEmail: email,
        studyWindowStartMin,
        studyWindowEndMin: Math.max(studyWindowEndMin, studyWindowStartMin + 1),
        maxSessionMin,
        breakBetweenSessionsMin,
        avoidLateNight: update.avoidLateNight ? 1 : 0,
        coursePriorityWeightsJson: JSON.stringify(normalizedWeights),
        updatedAt: now,
    }));
    return getPlannerPreferences(email);
}
function parseNotificationPayload(raw) {
    if (!raw)
        return null;
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
            return null;
        return parsed;
    }
    catch {
        return null;
    }
}
function rowToNotification(row) {
    return {
        id: row.id,
        userEmail: row.userEmail,
        type: row.type,
        payload: parseNotificationPayload(row.payloadJson),
        dedupeKey: row.dedupeKey ?? null,
        createdAt: row.createdAt,
        readAt: row.readAt ?? null,
    };
}
function createNotification(input) {
    const db = getDb();
    const userEmail = normalizeEmail(input.userEmail);
    if (!userEmail)
        return null;
    const id = (0, crypto_1.randomUUID)();
    const createdAt = input.createdAt ?? new Date().toISOString();
    const dedupeKey = input.dedupeKey?.trim() || null;
    const payloadJson = input.payload ? JSON.stringify(input.payload) : null;
    const result = runWrite('notifications.insert', () => db.prepare(`INSERT OR IGNORE INTO notifications
        (id, userEmail, type, payloadJson, dedupeKey, createdAt, readAt)
       VALUES
        (@id, @userEmail, @type, @payloadJson, @dedupeKey, @createdAt, NULL)`).run({
        id,
        userEmail,
        type: input.type,
        payloadJson,
        dedupeKey,
        createdAt,
    }));
    if (result.changes === 0)
        return null;
    return {
        id,
        userEmail,
        type: input.type,
        payload: input.payload ?? null,
        dedupeKey,
        createdAt,
        readAt: null,
    };
}
function listNotificationsByUser(userEmail, limit = 50) {
    const db = getDb();
    const email = normalizeEmail(userEmail);
    const safeLimit = clampInt(limit, 1, 200);
    const rows = db.prepare(`SELECT id, userEmail, type, payloadJson, dedupeKey, createdAt, readAt
     FROM notifications
     WHERE userEmail = ?
     ORDER BY createdAt DESC
     LIMIT ?`).all(email, safeLimit);
    return rows.map(rowToNotification);
}
function getUnreadNotificationCount(userEmail) {
    const db = getDb();
    const email = normalizeEmail(userEmail);
    const row = db.prepare('SELECT COUNT(*) as c FROM notifications WHERE userEmail = ? AND readAt IS NULL').get(email);
    return row.c;
}
function markNotificationRead(userEmail, notificationId) {
    const db = getDb();
    const email = normalizeEmail(userEmail);
    const now = new Date().toISOString();
    const result = runWrite('notifications.markRead', () => db.prepare('UPDATE notifications SET readAt = ? WHERE id = ? AND userEmail = ? AND readAt IS NULL').run(now, notificationId, email));
    return result.changes > 0;
}
function markAllNotificationsRead(userEmail) {
    const db = getDb();
    const email = normalizeEmail(userEmail);
    const now = new Date().toISOString();
    const result = runWrite('notifications.markAllRead', () => db.prepare('UPDATE notifications SET readAt = ? WHERE userEmail = ? AND readAt IS NULL').run(now, email));
    return result.changes;
}
function listCourseAssignmentDueReminderCandidates(minDueAtMs, maxDueAtMs) {
    const db = getDb();
    const rows = db.prepare(`SELECT
        ca.id AS assignmentId,
        ca.courseId AS courseId,
        c.name AS courseName,
        ca.title AS title,
        ca.dueAtMs AS dueAtMs,
        cm.studentEmail AS studentEmail
      FROM course_assignments ca
      INNER JOIN courses c ON c.id = ca.courseId
      INNER JOIN course_members cm ON cm.courseId = ca.courseId
      WHERE ca.dueAtMs IS NOT NULL
        AND ca.dueAtMs BETWEEN ? AND ?
      ORDER BY ca.dueAtMs ASC`).all(minDueAtMs, maxDueAtMs);
    return rows.map((row) => ({
        assignmentId: row.assignmentId,
        courseId: row.courseId,
        courseName: row.courseName,
        title: row.title,
        dueAtMs: row.dueAtMs,
        studentEmail: row.studentEmail,
    }));
}
function upsertCourseFeedback(courseId, studentEmail, rating, comment) {
    const db = getDb();
    const now = new Date().toISOString();
    const email = normalizeEmail(studentEmail);
    const normalizedRating = clampInt(rating, 1, 5);
    const normalizedComment = comment?.trim() ? comment.trim() : null;
    runWrite('course_feedback.upsert', () => db.prepare(`INSERT INTO course_feedback
        (id, courseId, studentEmail, rating, comment, createdAt, updatedAt)
       VALUES
        (@id, @courseId, @studentEmail, @rating, @comment, @createdAt, @updatedAt)
       ON CONFLICT(courseId, studentEmail) DO UPDATE SET
        rating = excluded.rating,
        comment = excluded.comment,
        updatedAt = excluded.updatedAt`).run({
        id: (0, crypto_1.randomUUID)(),
        courseId,
        studentEmail: email,
        rating: normalizedRating,
        comment: normalizedComment,
        createdAt: now,
        updatedAt: now,
    }));
    const row = db.prepare('SELECT * FROM course_feedback WHERE courseId = ? AND studentEmail = ?').get(courseId, email);
    return {
        id: row.id,
        courseId: row.courseId,
        studentEmail: row.studentEmail,
        rating: row.rating,
        comment: row.comment ?? null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}
function getCourseFeedbackByStudent(courseId, studentEmail) {
    const db = getDb();
    const email = normalizeEmail(studentEmail);
    const row = db.prepare('SELECT * FROM course_feedback WHERE courseId = ? AND studentEmail = ?').get(courseId, email);
    if (!row)
        return null;
    return {
        id: row.id,
        courseId: row.courseId,
        studentEmail: row.studentEmail,
        rating: row.rating,
        comment: row.comment ?? null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}
function getCourseFeedbackSummary(courseId) {
    const db = getDb();
    const stats = db.prepare('SELECT COUNT(*) as totalResponses, AVG(rating) as averageRating FROM course_feedback WHERE courseId = ?').get(courseId);
    const breakdownRows = db.prepare('SELECT rating, COUNT(*) as count FROM course_feedback WHERE courseId = ? GROUP BY rating').all(courseId);
    const counts = new Map();
    breakdownRows.forEach((row) => counts.set(row.rating, row.count));
    const ratingBreakdown = [1, 2, 3, 4, 5].map((rating) => ({
        rating,
        count: counts.get(rating) ?? 0,
    }));
    const recentCommentsRows = db.prepare(`SELECT rating, comment, updatedAt
     FROM course_feedback
     WHERE courseId = ? AND comment IS NOT NULL AND LENGTH(TRIM(comment)) > 0
     ORDER BY updatedAt DESC
     LIMIT 8`).all(courseId);
    return {
        courseId,
        totalResponses: stats.totalResponses ?? 0,
        averageRating: stats.averageRating == null
            ? null
            : Math.round((stats.averageRating + Number.EPSILON) * 100) / 100,
        ratingBreakdown,
        recentComments: recentCommentsRows.map((row) => ({
            rating: row.rating,
            comment: row.comment,
            createdAt: row.updatedAt,
        })),
    };
}
// Support Hub repository
function createHelpRequest(req) {
    const db = getDb();
    runWrite('help_requests.insert', () => db.prepare(`INSERT INTO help_requests
        (id, title, description, subject, urgency, status, createdAt, claimMode, meetingAbout, meetingLocation, meetingLink, proposedTimes, claimedBy, claimedByEmail, linkedAssignmentId, closedAt, createdByEmail)
       VALUES
        (@id, @title, @description, @subject, @urgency, @status, @createdAt, @claimMode, @meetingAbout, @meetingLocation, @meetingLink, @proposedTimes, @claimedBy, @claimedByEmail, @linkedAssignmentId, @closedAt, @createdByEmail)`).run({
        ...req,
        claimMode: req.claimMode ?? 'any',
        meetingAbout: req.meetingAbout ?? null,
        meetingLocation: req.meetingLocation ?? null,
        meetingLink: req.meetingLink ?? null,
        proposedTimes: req.proposedTimes ?? null,
        claimedBy: req.claimedBy ?? null,
        claimedByEmail: req.claimedByEmail ?? null,
        linkedAssignmentId: req.linkedAssignmentId ?? null,
        closedAt: req.closedAt ?? null,
        createdByEmail: req.createdByEmail ?? null,
    }));
    return req;
}
function listHelpRequests(filter = {}) {
    const db = getDb();
    const conditions = [];
    const params = [];
    if (filter.subject) {
        conditions.push('subject = ?');
        params.push(filter.subject);
    }
    if (filter.urgency) {
        conditions.push('urgency = ?');
        params.push(filter.urgency);
    }
    if (filter.status) {
        conditions.push('status = ?');
        params.push(filter.status);
    }
    else if (filter.excludeClosed) {
        conditions.push("status != 'closed'");
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT * FROM help_requests ${whereClause} ORDER BY createdAt DESC`;
    const rows = db.prepare(sql).all(...params);
    return rows.map(rowToHelpRequest);
}
function rowToHelpRequest(row) {
    return {
        id: row.id,
        title: row.title,
        description: row.description,
        subject: row.subject,
        urgency: row.urgency,
        status: row.status,
        createdAt: row.createdAt,
        claimMode: row.claimMode ?? 'any',
        meetingAbout: row.meetingAbout ?? null,
        meetingLocation: row.meetingLocation ?? null,
        meetingLink: row.meetingLink ?? null,
        proposedTimes: row.proposedTimes ?? null,
        claimedBy: row.claimedBy ?? null,
        claimedByEmail: row.claimedByEmail ?? null,
        claimedAt: row.claimedAt ?? null,
        unclaimedAt: row.unclaimedAt ?? null,
        unclaimedByEmail: row.unclaimedByEmail ?? null,
        linkedAssignmentId: row.linkedAssignmentId ?? null,
        closedAt: row.closedAt ?? null,
        createdByEmail: row.createdByEmail ?? null,
    };
}
function listHelpRequestsVisibleTo(userEmail, isTeacher, filter = {}) {
    const all = listHelpRequests(filter);
    const u = userEmail.toLowerCase().trim();
    return all.filter((r) => {
        if (r.status === 'open')
            return true;
        const creator = (r.createdByEmail || '').toLowerCase().trim();
        const claimer = (r.claimedByEmail || '').toLowerCase().trim();
        if (r.status === 'claimed') {
            return (creator && u === creator) || (claimer && u === claimer) || isTeacher;
        }
        if (r.status === 'closed') {
            return (creator && u === creator) || isTeacher;
        }
        return false;
    });
}
function getHelpRequestById(id) {
    const db = getDb();
    const row = db
        .prepare('SELECT * FROM help_requests WHERE id = ?')
        .get(id);
    if (!row)
        return null;
    return rowToHelpRequest(row);
}
function claimHelpRequest(id, claimedBy, claimedByEmail) {
    const db = getDb();
    const now = new Date().toISOString();
    const result = runWrite('help_requests.claim', () => db.prepare('UPDATE help_requests SET status = ?, claimedBy = ?, claimedByEmail = ?, claimedAt = ? WHERE id = ? AND status = ?').run('claimed', claimedBy, claimedByEmail, now, id, 'open'));
    if (result.changes === 0)
        return null;
    recordClaimEvent(id, claimedByEmail);
    return getHelpRequestById(id);
}
function unclaimHelpRequest(id) {
    const db = getDb();
    const now = new Date().toISOString();
    const row = db.prepare('SELECT claimedByEmail FROM help_requests WHERE id = ? AND status = ?').get(id, 'claimed');
    const unclaimedBy = row?.claimedByEmail ?? null;
    runWrite('help_requests.unclaim', () => db.prepare('UPDATE help_requests SET status = ?, claimedBy = NULL, claimedByEmail = NULL, claimedAt = NULL, unclaimedAt = ?, unclaimedByEmail = ? WHERE id = ? AND status = ?').run('open', now, unclaimedBy, id, 'claimed'));
    return getHelpRequestById(id);
}
function closeHelpRequest(id) {
    const db = getDb();
    const now = new Date().toISOString();
    runWrite('help_requests.close', () => db.prepare('UPDATE help_requests SET status = ?, closedAt = ? WHERE id = ?').run('closed', now, id));
    return getHelpRequestById(id);
}
/**
 * Delete ALL closed requests (for dev/test when days=0).
 */
function deleteAllClosedRequests(logger) {
    const db = getDb();
    const rows = db
        .prepare('SELECT id FROM help_requests WHERE status = ?')
        .all('closed');
    let deletedComments = 0;
    for (const row of rows) {
        const commentRows = runWrite('help_comments.cleanupByRequest', () => db.prepare('DELETE FROM help_comments WHERE requestId = ?').run(row.id));
        deletedComments += commentRows.changes;
    }
    const reqResult = runWrite('help_requests.cleanupAllClosed', () => db.prepare('DELETE FROM help_requests WHERE status = ?').run('closed'));
    if (logger) {
        logger.info({ deletedRequests: reqResult.changes, deletedComments }, '[API] Cleanup all closed requests');
    }
    return { deletedRequests: reqResult.changes, deletedComments };
}
function deleteClosedRequestsOlderThanDays(days, logger) {
    const db = getDb();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffIso = cutoff.toISOString();
    const rows = db
        .prepare('SELECT id FROM help_requests WHERE status = ? AND closedAt IS NOT NULL AND closedAt < ?')
        .all('closed', cutoffIso);
    let deletedComments = 0;
    for (const row of rows) {
        const commentRows = runWrite('help_comments.cleanupOlderThanDays', () => db.prepare('DELETE FROM help_comments WHERE requestId = ?').run(row.id));
        deletedComments += commentRows.changes;
    }
    const reqResult = runWrite('help_requests.cleanupOlderThanDays', () => db
        .prepare('DELETE FROM help_requests WHERE status = ? AND closedAt IS NOT NULL AND closedAt < ?')
        .run('closed', cutoffIso));
    if (logger) {
        logger.info({ deletedRequests: reqResult.changes, deletedComments, cutoff: cutoffIso }, '[API] Cleanup closed requests');
    }
    return { deletedRequests: reqResult.changes, deletedComments };
}
function listCommentsForRequest(requestId) {
    const db = getDb();
    const rows = db
        .prepare('SELECT * FROM help_comments WHERE requestId = ? ORDER BY createdAt ASC')
        .all(requestId);
    return rows.map((row) => ({
        id: row.id,
        requestId: row.requestId,
        authorLabel: (row.authorLabel || 'other'),
        authorDisplayName: row.authorDisplayName ?? null,
        authorEmail: row.authorEmail ?? null,
        body: row.body,
        createdAt: row.createdAt
    }));
}
function addComment(comment) {
    const db = getDb();
    runWrite('help_comments.insert', () => db.prepare(`INSERT INTO help_comments
        (id, requestId, authorLabel, authorDisplayName, authorEmail, body, createdAt)
       VALUES
        (@id, @requestId, @authorLabel, @authorDisplayName, @authorEmail, @body, @createdAt)`).run({
        ...comment,
        authorDisplayName: comment.authorDisplayName ?? null,
        authorEmail: comment.authorEmail ?? null,
    }));
    return comment;
}
// Claim limits & blocklist
function countActiveClaimsByEmail(email) {
    const db = getDb();
    const u = email.toLowerCase().trim();
    const row = db.prepare("SELECT COUNT(*) as c FROM help_requests WHERE status = 'claimed' AND LOWER(TRIM(claimedByEmail)) = ?").get(u);
    return row.c;
}
function countClaimsInLastHour(email) {
    const db = getDb();
    const u = email.toLowerCase().trim();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const row = db.prepare('SELECT COUNT(*) as c FROM help_claim_events WHERE LOWER(TRIM(claimedByEmail)) = ? AND claimedAt >= ?').get(u, oneHourAgo);
    return row.c;
}
function recordClaimEvent(requestId, claimedByEmail) {
    const db = getDb();
    const id = (0, crypto_1.randomUUID)();
    const now = new Date().toISOString();
    runWrite('help_claim_events.insert', () => db.prepare('INSERT INTO help_claim_events (id, requestId, claimedByEmail, claimedAt) VALUES (?, ?, ?, ?)').run(id, requestId, claimedByEmail, now));
}
function isBlocked(email) {
    const db = getDb();
    const u = email.toLowerCase().trim();
    const now = new Date().toISOString();
    const row = db.prepare('SELECT 1 FROM claim_blocklist WHERE LOWER(TRIM(blockedEmail)) = ? AND blockedUntil > ? LIMIT 1').get(u, now);
    return !!row;
}
function addBlocklistEntry(entry) {
    const db = getDb();
    runWrite('claim_blocklist.insert', () => db.prepare('INSERT INTO claim_blocklist (id, blockedEmail, blockedUntil, blockedByEmail, createdAt) VALUES (@id, @blockedEmail, @blockedUntil, @blockedByEmail, @createdAt)').run(entry));
}
function listBlocklistEntries() {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM claim_blocklist ORDER BY createdAt DESC').all();
    return rows.map((r) => ({
        id: r.id,
        blockedEmail: r.blockedEmail,
        blockedUntil: r.blockedUntil,
        blockedByEmail: r.blockedByEmail,
        createdAt: r.createdAt,
    }));
}
// Reports
function createReport(report) {
    const db = getDb();
    runWrite('help_reports.insert', () => db.prepare(`INSERT INTO help_reports (id, requestId, reportedEmail, reason, details, reportedByEmail, createdAt)
       VALUES (@id, @requestId, @reportedEmail, @reason, @details, @reportedByEmail, @createdAt)`).run({
        ...report,
        details: report.details ?? null,
    }));
    return report;
}
function listReports() {
    const db = getDb();
    const reports = db.prepare('SELECT * FROM help_reports ORDER BY createdAt DESC LIMIT 100').all();
    const counts = db.prepare(`SELECT reportedEmail, COUNT(*) as count FROM help_reports GROUP BY reportedEmail ORDER BY count DESC`).all();
    return {
        reports: reports.map((r) => ({ ...r, details: r.details ?? null })),
        countsByReportedEmail: counts,
    };
}
// Request activity (for detail page)
function getRequestActivity(request) {
    const entries = [];
    if (request.createdAt) {
        entries.push({ type: 'created', at: request.createdAt, byEmail: request.createdByEmail ?? null, label: 'Created' });
    }
    if (request.claimedAt && request.status === 'claimed') {
        entries.push({ type: 'claimed', at: request.claimedAt, byEmail: request.claimedByEmail ?? null, label: request.claimedBy ?? 'Claimed' });
    }
    if (request.unclaimedAt) {
        entries.push({ type: 'unclaimed', at: request.unclaimedAt, byEmail: request.unclaimedByEmail ?? null, label: 'Released' });
    }
    if (request.closedAt) {
        entries.push({ type: 'closed', at: request.closedAt, byEmail: null, label: 'Closed' });
    }
    return entries.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}
// Insights
function getRequestsSummary() {
    const db = getDb();
    const rows = db
        .prepare(`SELECT subject, urgency, status, COUNT(*) as count
       FROM help_requests
       GROUP BY subject, urgency, status
       ORDER BY subject ASC, urgency ASC, status ASC`)
        .all();
    return rows.map((row) => ({
        subject: row.subject,
        urgency: row.urgency,
        status: row.status,
        count: row.count
    }));
}
function getInsightsStats() {
    const db = getDb();
    const open = db.prepare("SELECT COUNT(*) as c FROM help_requests WHERE status = 'open'").get().c;
    const claimed = db.prepare("SELECT COUNT(*) as c FROM help_requests WHERE status = 'claimed'").get().c;
    const closed = db.prepare("SELECT COUNT(*) as c FROM help_requests WHERE status = 'closed'").get().c;
    const topSubjects = db
        .prepare(`SELECT subject, COUNT(*) as count FROM help_requests WHERE status = 'open' GROUP BY subject ORDER BY count DESC LIMIT 5`)
        .all();
    return { totalOpen: open, totalClaimed: claimed, totalClosed: closed, topSubjectsByOpen: topSubjects };
}

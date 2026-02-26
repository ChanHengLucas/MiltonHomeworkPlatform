"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDb = getDb;
exports.applyMigrations = applyMigrations;
exports.initDb = initDb;
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
exports.addCourseMember = addCourseMember;
exports.listCourseMembers = listCourseMembers;
exports.createCourseAssignment = createCourseAssignment;
exports.listCourseAssignmentsForStudent = listCourseAssignmentsForStudent;
exports.listCourseAssignmentsByCourse = listCourseAssignmentsByCourse;
exports.createGradingTask = createGradingTask;
exports.listGradingTasksByTeacher = listGradingTasksByTeacher;
exports.deleteGradingTask = deleteGradingTask;
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
function getDatabaseFile() {
    const envPath = process.env.DATABASE_FILE;
    const dbPath = envPath && envPath.trim().length > 0
        ? envPath
        : path_1.default.join(process.cwd(), 'data', 'app.db');
    const dir = path_1.default.dirname(dbPath);
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
    }
    return dbPath;
}
function getDb() {
    if (!dbInstance) {
        const file = getDatabaseFile();
        dbInstance = new better_sqlite3_1.default(file);
        dbInstance.pragma('journal_mode = WAL');
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
                db.exec(migration.up);
                insertMigrationStmt.run(migration.id, new Date().toISOString());
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
    stmt.run({
        ...assignment,
        dueAt,
        completed: assignment.completed ? 1 : 0
    });
    return assignment;
}
function updateAssignmentCompletion(id, completed) {
    const db = getDb();
    db.prepare('UPDATE assignments SET completed = ? WHERE id = ?').run(completed ? 1 : 0, id);
}
function deleteAssignment(id) {
    const db = getDb();
    db.prepare('DELETE FROM assignments WHERE id = ?').run(id);
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
    db.prepare(`INSERT INTO availability_blocks (id, startMin, endMin)
     VALUES (@id, @startMin, @endMin)`).run(block);
    return block;
}
function deleteAvailabilityBlock(id) {
    const db = getDb();
    db.prepare('DELETE FROM availability_blocks WHERE id = ?').run(id);
}
function createCourse(course) {
    const db = getDb();
    db.prepare('INSERT INTO courses (id, name, teacherEmail, createdAt) VALUES (@id, @name, @teacherEmail, @createdAt)').run(course);
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
function addCourseMember(courseId, studentEmail) {
    const db = getDb();
    const email = studentEmail.toLowerCase().trim();
    db.prepare('INSERT OR IGNORE INTO course_members (courseId, studentEmail) VALUES (?, ?)').run(courseId, email);
}
function listCourseMembers(courseId) {
    const db = getDb();
    const rows = db.prepare('SELECT studentEmail FROM course_members WHERE courseId = ?').all(courseId);
    return rows.map((r) => r.studentEmail);
}
function createCourseAssignment(a) {
    const db = getDb();
    db.prepare(`INSERT INTO course_assignments (id, courseId, title, description, dueAtMs, estMinutes, type, createdByEmail, createdAt)
     VALUES (@id, @courseId, @title, @description, @dueAtMs, @estMinutes, @type, @createdByEmail, @createdAt)`).run(a);
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
// Grading tasks (teacher)
function createGradingTask(task) {
    const db = getDb();
    db.prepare('INSERT INTO grading_tasks (id, teacherEmail, title, dueAtMs, estMinutes, createdAt) VALUES (@id, @teacherEmail, @title, @dueAtMs, @estMinutes, @createdAt)').run(task);
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
    db.prepare('DELETE FROM grading_tasks WHERE id = ? AND teacherEmail = ?').run(id, teacherEmail);
}
// Support Hub repository
function createHelpRequest(req) {
    const db = getDb();
    db.prepare(`INSERT INTO help_requests
      (id, title, description, subject, urgency, status, createdAt, claimedBy, claimedByEmail, linkedAssignmentId, closedAt, createdByEmail)
     VALUES
      (@id, @title, @description, @subject, @urgency, @status, @createdAt, @claimedBy, @claimedByEmail, @linkedAssignmentId, @closedAt, @createdByEmail)`).run({
        ...req,
        claimedBy: req.claimedBy ?? null,
        claimedByEmail: req.claimedByEmail ?? null,
        linkedAssignmentId: req.linkedAssignmentId ?? null,
        closedAt: req.closedAt ?? null,
        createdByEmail: req.createdByEmail ?? null,
    });
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
    const result = db.prepare('UPDATE help_requests SET status = ?, claimedBy = ?, claimedByEmail = ?, claimedAt = ? WHERE id = ? AND status = ?').run('claimed', claimedBy, claimedByEmail, now, id, 'open');
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
    db.prepare('UPDATE help_requests SET status = ?, claimedBy = NULL, claimedByEmail = NULL, claimedAt = NULL, unclaimedAt = ?, unclaimedByEmail = ? WHERE id = ? AND status = ?').run('open', now, unclaimedBy, id, 'claimed');
    return getHelpRequestById(id);
}
function closeHelpRequest(id) {
    const db = getDb();
    const now = new Date().toISOString();
    db.prepare('UPDATE help_requests SET status = ?, closedAt = ? WHERE id = ?').run('closed', now, id);
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
        const commentRows = db.prepare('DELETE FROM help_comments WHERE requestId = ?').run(row.id);
        deletedComments += commentRows.changes;
    }
    const reqResult = db.prepare('DELETE FROM help_requests WHERE status = ?').run('closed');
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
        const commentRows = db.prepare('DELETE FROM help_comments WHERE requestId = ?').run(row.id);
        deletedComments += commentRows.changes;
    }
    const reqResult = db
        .prepare('DELETE FROM help_requests WHERE status = ? AND closedAt IS NOT NULL AND closedAt < ?')
        .run('closed', cutoffIso);
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
    db.prepare(`INSERT INTO help_comments
      (id, requestId, authorLabel, authorDisplayName, authorEmail, body, createdAt)
     VALUES
      (@id, @requestId, @authorLabel, @authorDisplayName, @authorEmail, @body, @createdAt)`).run({
        ...comment,
        authorDisplayName: comment.authorDisplayName ?? null,
        authorEmail: comment.authorEmail ?? null,
    });
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
    db.prepare('INSERT INTO help_claim_events (id, requestId, claimedByEmail, claimedAt) VALUES (?, ?, ?, ?)').run(id, requestId, claimedByEmail, now);
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
    db.prepare('INSERT INTO claim_blocklist (id, blockedEmail, blockedUntil, blockedByEmail, createdAt) VALUES (@id, @blockedEmail, @blockedUntil, @blockedByEmail, @createdAt)').run(entry);
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
    db.prepare(`INSERT INTO help_reports (id, requestId, reportedEmail, reason, details, reportedByEmail, createdAt)
     VALUES (@id, @requestId, @reportedEmail, @reason, @details, @reportedByEmail, @createdAt)`).run({
        ...report,
        details: report.details ?? null,
    });
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

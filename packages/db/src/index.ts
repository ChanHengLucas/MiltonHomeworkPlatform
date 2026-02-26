import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

import DatabaseConstructor, { Database } from 'better-sqlite3';
import type {
  Assignment,
  AvailabilityBlock,
  PlannerPlanSession
} from '@planner/core';

export interface HelpRequest {
  id: string;
  title: string;
  description: string;
  subject: string;
  urgency: 'low' | 'med' | 'high';
  status: 'open' | 'claimed' | 'closed';
  createdAt: string;
  claimedBy?: string | null;
  claimedByEmail?: string | null;
  claimedAt?: string | null;
  unclaimedAt?: string | null;
  unclaimedByEmail?: string | null;
  linkedAssignmentId?: string | null;
  closedAt?: string | null;
  createdByEmail?: string | null;
}

export interface HelpReport {
  id: string;
  requestId: string;
  reportedEmail: string;
  reason: 'spam' | 'trolling' | 'no_show' | 'other';
  details?: string | null;
  reportedByEmail: string;
  createdAt: string;
}

export interface ClaimBlocklistEntry {
  id: string;
  blockedEmail: string;
  blockedUntil: string; // ISO date
  blockedByEmail: string;
  createdAt: string;
}

export interface RequestActivityEntry {
  type: 'created' | 'claimed' | 'unclaimed' | 'closed';
  at: string;
  byEmail?: string | null;
  label?: string | null;
}

export interface HelpComment {
  id: string;
  requestId: string;
  authorLabel: 'requester' | 'helper' | 'teacher' | 'other';
  authorDisplayName?: string | null;
  authorEmail?: string | null;
  body: string;
  createdAt: string;
}

interface AssignmentRow {
  id: string;
  course: string;
  title: string;
  dueAt: number | null;
  estMinutes: number;
  priority: number;
  type: string;
  completed: number;
}

interface AvailabilityRow {
  id: string;
  startMin: number;
  endMin: number;
}

interface HelpRequestRow {
  id: string;
  title: string;
  description: string;
  subject: string;
  urgency: string;
  status: string;
  createdAt: string;
  claimedBy: string | null;
  claimedByEmail?: string | null;
  claimedAt?: string | null;
  unclaimedAt?: string | null;
  unclaimedByEmail?: string | null;
  linkedAssignmentId: string | null;
  closedAt?: string | null;
  createdByEmail?: string | null;
}

interface HelpCommentRow {
  id: string;
  requestId: string;
  authorLabel: string;
  authorDisplayName?: string | null;
  authorEmail?: string | null;
  body: string;
  createdAt: string;
}

interface RequestsSummaryRowRaw {
  subject: string;
  urgency: string;
  status: string;
  count: number;
}

export interface RequestsSummaryRow {
  subject: string;
  urgency: string;
  status: string;
  count: number;
}

let dbInstance: Database | null = null;

function getDatabaseFile(): string {
  const envPath = process.env.DATABASE_FILE;
  const dbPath =
    envPath && envPath.trim().length > 0
      ? envPath
      : path.join(process.cwd(), 'data', 'app.db');

  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  return dbPath;
}

export function getDb(): Database {
  if (!dbInstance) {
    const file = getDatabaseFile();
    dbInstance = new DatabaseConstructor(file);
    dbInstance.pragma('journal_mode = WAL');
  }

  return dbInstance;
}

interface Migration {
  id: string;
  up: string;
}

const MIGRATIONS: Migration[] = [
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
  }
];

export function applyMigrations(): void {
  const db = getDb();

  db.exec('BEGIN');
  try {
    db.exec(
      `CREATE TABLE IF NOT EXISTS migrations (
        id TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL
      );`
    );

    const hasMigrationStmt = db.prepare(
      'SELECT COUNT(1) as count FROM migrations WHERE id = ?'
    );
    const insertMigrationStmt = db.prepare(
      'INSERT INTO migrations (id, applied_at) VALUES (?, ?)'
    );

    for (const migration of MIGRATIONS) {
      const row = hasMigrationStmt.get(migration.id) as { count: number } | undefined;
      if (!row || row.count === 0) {
        db.exec(migration.up);
        insertMigrationStmt.run(migration.id, new Date().toISOString());
      }
    }

    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function initDb(): Database {
  const db = getDb();
  applyMigrations();
  return db;
}

// Assignment repository

export function listAssignments(): Assignment[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM assignments ORDER BY dueAt IS NULL, dueAt ASC, title ASC')
    .all() as AssignmentRow[];

  return rows.map((row): Assignment => ({
    id: row.id,
    course: row.course,
    title: row.title,
    dueAt: row.dueAt != null && row.dueAt > 0 ? row.dueAt : undefined,
    estMinutes: row.estMinutes,
    priority: row.priority as 1 | 2 | 3 | 4 | 5,
    type: row.type as Assignment['type'],
    completed: !!row.completed
  }));
}

export function createAssignment(assignment: Assignment): Assignment {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO assignments
      (id, course, title, dueAt, estMinutes, priority, type, completed)
     VALUES (@id, @course, @title, @dueAt, @estMinutes, @priority, @type, @completed)`
  );

  const dueAt = assignment.dueAt != null && assignment.dueAt > 0 ? assignment.dueAt : null;
  stmt.run({
    ...assignment,
    dueAt,
    completed: assignment.completed ? 1 : 0
  });

  return assignment;
}

export function updateAssignmentCompletion(id: string, completed: boolean): void {
  const db = getDb();
  db.prepare('UPDATE assignments SET completed = ? WHERE id = ?').run(
    completed ? 1 : 0,
    id
  );
}

export function deleteAssignment(id: string): void {
  const db = getDb();
  db.prepare('DELETE FROM assignments WHERE id = ?').run(id);
}

// Availability repository

export function listAvailabilityBlocks(): AvailabilityBlock[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM availability_blocks ORDER BY startMin ASC')
    .all() as AvailabilityRow[];

  return rows.map((row) => ({
    id: row.id,
    startMin: row.startMin,
    endMin: row.endMin
  }));
}

export function createAvailabilityBlock(block: AvailabilityBlock): AvailabilityBlock {
  const db = getDb();
  db.prepare(
    `INSERT INTO availability_blocks (id, startMin, endMin)
     VALUES (@id, @startMin, @endMin)`
  ).run(block);

  return block;
}

export function deleteAvailabilityBlock(id: string): void {
  const db = getDb();
  db.prepare('DELETE FROM availability_blocks WHERE id = ?').run(id);
}

// Courses (teacher publishing)

export interface Course {
  id: string;
  name: string;
  teacherEmail: string;
  createdAt: string;
}

export interface CourseMember {
  courseId: string;
  studentEmail: string;
}

export interface CourseAssignment {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  dueAtMs: number | null;
  estMinutes: number;
  type: string;
  createdByEmail: string;
  createdAt: string;
}

export interface GradingTask {
  id: string;
  teacherEmail: string;
  title: string;
  dueAtMs: number | null;
  estMinutes: number;
  createdAt: string;
}

export interface PlannerPreferences {
  userEmail: string;
  studyWindowStartMin: number;
  studyWindowEndMin: number;
  maxSessionMin: number;
  breakBetweenSessionsMin: number;
  avoidLateNight: boolean;
  coursePriorityWeights: Record<string, number>;
  updatedAt: string;
}

export function createCourse(course: Course): Course {
  const db = getDb();
  db.prepare(
    'INSERT INTO courses (id, name, teacherEmail, createdAt) VALUES (@id, @name, @teacherEmail, @createdAt)'
  ).run(course);
  return course;
}

export function listCoursesByTeacher(teacherEmail: string): Course[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM courses WHERE teacherEmail = ? ORDER BY name ASC').all(teacherEmail) as Course[];
  return rows;
}

export function getCourse(id: string): Course | null {
  const db = getDb();
  const row = db.prepare('SELECT * FROM courses WHERE id = ?').get(id) as Course | undefined;
  return row ?? null;
}

export function addCourseMember(courseId: string, studentEmail: string): void {
  const db = getDb();
  const email = studentEmail.toLowerCase().trim();
  db.prepare('INSERT OR IGNORE INTO course_members (courseId, studentEmail) VALUES (?, ?)').run(courseId, email);
}

export function listCourseMembers(courseId: string): string[] {
  const db = getDb();
  const rows = db.prepare('SELECT studentEmail FROM course_members WHERE courseId = ?').all(courseId) as { studentEmail: string }[];
  return rows.map((r) => r.studentEmail);
}

export function createCourseAssignment(a: CourseAssignment): CourseAssignment {
  const db = getDb();
  db.prepare(
    `INSERT INTO course_assignments (id, courseId, title, description, dueAtMs, estMinutes, type, createdByEmail, createdAt)
     VALUES (@id, @courseId, @title, @description, @dueAtMs, @estMinutes, @type, @createdByEmail, @createdAt)`
  ).run(a);
  return a;
}

export interface CourseAssignmentWithCourse extends CourseAssignment {
  courseName: string;
}

export function listCourseAssignmentsForStudent(studentEmail: string): CourseAssignmentWithCourse[] {
  const db = getDb();
  const email = studentEmail.toLowerCase().trim();
  const rows = db
    .prepare(
      `SELECT ca.*, c.name as courseName FROM course_assignments ca
       INNER JOIN course_members cm ON ca.courseId = cm.courseId
       INNER JOIN courses c ON ca.courseId = c.id
       WHERE cm.studentEmail = ?
       ORDER BY ca.dueAtMs IS NULL, ca.dueAtMs ASC, ca.title ASC`
    )
    .all(email) as (CourseAssignment & { courseName: string })[];
  return rows;
}

export function listCourseAssignmentsByCourse(courseId: string): CourseAssignment[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM course_assignments WHERE courseId = ? ORDER BY dueAtMs IS NULL, dueAtMs ASC, title ASC')
    .all(courseId) as CourseAssignment[];
  return rows;
}

// Grading tasks (teacher)

export function createGradingTask(task: GradingTask): GradingTask {
  const db = getDb();
  db.prepare(
    'INSERT INTO grading_tasks (id, teacherEmail, title, dueAtMs, estMinutes, createdAt) VALUES (@id, @teacherEmail, @title, @dueAtMs, @estMinutes, @createdAt)'
  ).run(task);
  return task;
}

export function listGradingTasksByTeacher(teacherEmail: string): GradingTask[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM grading_tasks WHERE teacherEmail = ? ORDER BY dueAtMs IS NULL, dueAtMs ASC, title ASC')
    .all(teacherEmail) as GradingTask[];
  return rows;
}

export function deleteGradingTask(id: string, teacherEmail: string): void {
  const db = getDb();
  db.prepare('DELETE FROM grading_tasks WHERE id = ? AND teacherEmail = ?').run(id, teacherEmail);
}

const DEFAULT_PREFERENCES = {
  studyWindowStartMin: 8 * 60,
  studyWindowEndMin: 22 * 60,
  maxSessionMin: 45,
  breakBetweenSessionsMin: 10,
  avoidLateNight: true,
};

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

function parseCoursePriorityWeights(raw: string | null | undefined): Record<string, number> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [course, weight] of Object.entries(parsed)) {
      if (typeof course !== 'string') continue;
      if (typeof weight !== 'number' || !Number.isFinite(weight)) continue;
      out[course.toLowerCase().trim()] = clampInt(weight, -5, 5);
    }
    return out;
  } catch {
    return {};
  }
}

export function getPlannerPreferences(userEmail: string): PlannerPreferences {
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
    .prepare(
      `SELECT userEmail, studyWindowStartMin, studyWindowEndMin, maxSessionMin, breakBetweenSessionsMin, avoidLateNight, coursePriorityWeightsJson, updatedAt
       FROM planner_preferences
       WHERE userEmail = ?`
    )
    .get(email) as
    | {
        userEmail: string;
        studyWindowStartMin: number;
        studyWindowEndMin: number;
        maxSessionMin: number;
        breakBetweenSessionsMin: number;
        avoidLateNight: number;
        coursePriorityWeightsJson: string | null;
        updatedAt: string;
      }
    | undefined;

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

export function upsertPlannerPreferences(
  userEmail: string,
  update: {
    studyWindowStartMin: number;
    studyWindowEndMin: number;
    maxSessionMin: number;
    breakBetweenSessionsMin: number;
    avoidLateNight: boolean;
    coursePriorityWeights: Record<string, number>;
  }
): PlannerPreferences {
  const db = getDb();
  const email = normalizeEmail(userEmail);
  const now = new Date().toISOString();

  const studyWindowStartMin = clampInt(update.studyWindowStartMin, 0, 1439);
  const studyWindowEndMin = clampInt(update.studyWindowEndMin, 1, 1440);
  const maxSessionMin = clampInt(update.maxSessionMin, 5, 180);
  const breakBetweenSessionsMin = clampInt(update.breakBetweenSessionsMin, 0, 120);

  const normalizedWeights: Record<string, number> = {};
  for (const [course, weight] of Object.entries(update.coursePriorityWeights || {})) {
    const key = course.toLowerCase().trim();
    if (!key) continue;
    if (typeof weight !== 'number' || !Number.isFinite(weight)) continue;
    normalizedWeights[key] = clampInt(weight, -5, 5);
  }

  db.prepare(
    `INSERT INTO planner_preferences
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
      updatedAt = excluded.updatedAt`
  ).run({
    userEmail: email,
    studyWindowStartMin,
    studyWindowEndMin: Math.max(studyWindowEndMin, studyWindowStartMin + 1),
    maxSessionMin,
    breakBetweenSessionsMin,
    avoidLateNight: update.avoidLateNight ? 1 : 0,
    coursePriorityWeightsJson: JSON.stringify(normalizedWeights),
    updatedAt: now,
  });

  return getPlannerPreferences(email);
}

// Support Hub repository

export function createHelpRequest(req: HelpRequest): HelpRequest {
  const db = getDb();
  db.prepare(
    `INSERT INTO help_requests
      (id, title, description, subject, urgency, status, createdAt, claimedBy, claimedByEmail, linkedAssignmentId, closedAt, createdByEmail)
     VALUES
      (@id, @title, @description, @subject, @urgency, @status, @createdAt, @claimedBy, @claimedByEmail, @linkedAssignmentId, @closedAt, @createdByEmail)`
  ).run({
    ...req,
    claimedBy: req.claimedBy ?? null,
    claimedByEmail: req.claimedByEmail ?? null,
    linkedAssignmentId: req.linkedAssignmentId ?? null,
    closedAt: req.closedAt ?? null,
    createdByEmail: req.createdByEmail ?? null,
  });

  return req;
}

export interface HelpRequestFilter {
  subject?: string;
  urgency?: 'low' | 'med' | 'high';
  status?: 'open' | 'claimed' | 'closed';
  excludeClosed?: boolean;
}

export function listHelpRequests(filter: HelpRequestFilter = {}): HelpRequest[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: (string | number)[] = [];

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
  } else if (filter.excludeClosed) {
    conditions.push("status != 'closed'");
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT * FROM help_requests ${whereClause} ORDER BY createdAt DESC`;

  const rows = db.prepare(sql).all(...params) as HelpRequestRow[];

  return rows.map(rowToHelpRequest);
}

function rowToHelpRequest(row: HelpRequestRow): HelpRequest {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    subject: row.subject,
    urgency: row.urgency as HelpRequest['urgency'],
    status: row.status as HelpRequest['status'],
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

export function listHelpRequestsVisibleTo(
  userEmail: string,
  isTeacher: boolean,
  filter: HelpRequestFilter = {}
): HelpRequest[] {
  const all = listHelpRequests(filter);
  const u = userEmail.toLowerCase().trim();
  return all.filter((r) => {
    if (r.status === 'open') return true;
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

export function getHelpRequestById(id: string): HelpRequest | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM help_requests WHERE id = ?')
    .get(id) as HelpRequestRow | undefined;

  if (!row) return null;
  return rowToHelpRequest(row);
}

export function claimHelpRequest(
  id: string,
  claimedBy: string,
  claimedByEmail: string
): HelpRequest | null {
  const db = getDb();
  const now = new Date().toISOString();
  const result = db.prepare(
    'UPDATE help_requests SET status = ?, claimedBy = ?, claimedByEmail = ?, claimedAt = ? WHERE id = ? AND status = ?'
  ).run('claimed', claimedBy, claimedByEmail, now, id, 'open');
  if (result.changes === 0) return null;
  recordClaimEvent(id, claimedByEmail);
  return getHelpRequestById(id);
}

export function unclaimHelpRequest(id: string): HelpRequest | null {
  const db = getDb();
  const now = new Date().toISOString();
  const row = db.prepare('SELECT claimedByEmail FROM help_requests WHERE id = ? AND status = ?').get(id, 'claimed') as { claimedByEmail: string | null } | undefined;
  const unclaimedBy = row?.claimedByEmail ?? null;
  db.prepare(
    'UPDATE help_requests SET status = ?, claimedBy = NULL, claimedByEmail = NULL, claimedAt = NULL, unclaimedAt = ?, unclaimedByEmail = ? WHERE id = ? AND status = ?'
  ).run('open', now, unclaimedBy, id, 'claimed');

  return getHelpRequestById(id);
}

export function closeHelpRequest(id: string): HelpRequest | null {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare('UPDATE help_requests SET status = ?, closedAt = ? WHERE id = ?').run(
    'closed',
    now,
    id
  );
  return getHelpRequestById(id);
}

/**
 * Delete ALL closed requests (for dev/test when days=0).
 */
export function deleteAllClosedRequests(
  logger?: { info: (o: object, msg: string) => void }
): { deletedRequests: number; deletedComments: number } {
  const db = getDb();
  const rows = db
    .prepare('SELECT id FROM help_requests WHERE status = ?')
    .all('closed') as { id: string }[];

  let deletedComments = 0;
  for (const row of rows) {
    const commentRows = db.prepare('DELETE FROM help_comments WHERE requestId = ?').run(row.id);
    deletedComments += commentRows.changes;
  }
  const reqResult = db.prepare('DELETE FROM help_requests WHERE status = ?').run('closed');

  if (logger) {
    logger.info(
      { deletedRequests: reqResult.changes, deletedComments },
      '[API] Cleanup all closed requests'
    );
  }
  return { deletedRequests: reqResult.changes, deletedComments };
}

export function deleteClosedRequestsOlderThanDays(
  days: number,
  logger?: { info: (o: object, msg: string) => void }
): { deletedRequests: number; deletedComments: number } {
  const db = getDb();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffIso = cutoff.toISOString();

  const rows = db
    .prepare(
      'SELECT id FROM help_requests WHERE status = ? AND closedAt IS NOT NULL AND closedAt < ?'
    )
    .all('closed', cutoffIso) as { id: string }[];

  let deletedComments = 0;
  for (const row of rows) {
    const commentRows = db.prepare('DELETE FROM help_comments WHERE requestId = ?').run(row.id);
    deletedComments += commentRows.changes;
  }
  const reqResult = db
    .prepare(
      'DELETE FROM help_requests WHERE status = ? AND closedAt IS NOT NULL AND closedAt < ?'
    )
    .run('closed', cutoffIso);

  if (logger) {
    logger.info(
      { deletedRequests: reqResult.changes, deletedComments, cutoff: cutoffIso },
      '[API] Cleanup closed requests'
    );
  }
  return { deletedRequests: reqResult.changes, deletedComments };
}

export function listCommentsForRequest(requestId: string): HelpComment[] {
  const db = getDb();
  const rows = db
    .prepare(
      'SELECT * FROM help_comments WHERE requestId = ? ORDER BY createdAt ASC'
    )
    .all(requestId) as HelpCommentRow[];

  return rows.map((row): HelpComment => ({
    id: row.id,
    requestId: row.requestId,
    authorLabel: (row.authorLabel || 'other') as HelpComment['authorLabel'],
    authorDisplayName: row.authorDisplayName ?? null,
    authorEmail: row.authorEmail ?? null,
    body: row.body,
    createdAt: row.createdAt
  }));
}

export function addComment(comment: HelpComment): HelpComment {
  const db = getDb();
  db.prepare(
    `INSERT INTO help_comments
      (id, requestId, authorLabel, authorDisplayName, authorEmail, body, createdAt)
     VALUES
      (@id, @requestId, @authorLabel, @authorDisplayName, @authorEmail, @body, @createdAt)`
  ).run({
    ...comment,
    authorDisplayName: comment.authorDisplayName ?? null,
    authorEmail: comment.authorEmail ?? null,
  });

  return comment;
}

// Claim limits & blocklist

export function countActiveClaimsByEmail(email: string): number {
  const db = getDb();
  const u = email.toLowerCase().trim();
  const row = db.prepare(
    "SELECT COUNT(*) as c FROM help_requests WHERE status = 'claimed' AND LOWER(TRIM(claimedByEmail)) = ?"
  ).get(u) as { c: number };
  return row.c;
}

export function countClaimsInLastHour(email: string): number {
  const db = getDb();
  const u = email.toLowerCase().trim();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const row = db.prepare(
    'SELECT COUNT(*) as c FROM help_claim_events WHERE LOWER(TRIM(claimedByEmail)) = ? AND claimedAt >= ?'
  ).get(u, oneHourAgo) as { c: number };
  return row.c;
}

export function recordClaimEvent(requestId: string, claimedByEmail: string): void {
  const db = getDb();
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO help_claim_events (id, requestId, claimedByEmail, claimedAt) VALUES (?, ?, ?, ?)'
  ).run(id, requestId, claimedByEmail, now);
}

export function isBlocked(email: string): boolean {
  const db = getDb();
  const u = email.toLowerCase().trim();
  const now = new Date().toISOString();
  const row = db.prepare(
    'SELECT 1 FROM claim_blocklist WHERE LOWER(TRIM(blockedEmail)) = ? AND blockedUntil > ? LIMIT 1'
  ).get(u, now);
  return !!row;
}

export function addBlocklistEntry(entry: ClaimBlocklistEntry): void {
  const db = getDb();
  db.prepare(
    'INSERT INTO claim_blocklist (id, blockedEmail, blockedUntil, blockedByEmail, createdAt) VALUES (@id, @blockedEmail, @blockedUntil, @blockedByEmail, @createdAt)'
  ).run(entry);
}

export function listBlocklistEntries(): ClaimBlocklistEntry[] {
  const db = getDb();
  const rows = db.prepare(
    'SELECT * FROM claim_blocklist ORDER BY createdAt DESC'
  ).all() as { id: string; blockedEmail: string; blockedUntil: string; blockedByEmail: string; createdAt: string }[];
  return rows.map((r) => ({
    id: r.id,
    blockedEmail: r.blockedEmail,
    blockedUntil: r.blockedUntil,
    blockedByEmail: r.blockedByEmail,
    createdAt: r.createdAt,
  }));
}

// Reports

export function createReport(report: HelpReport): HelpReport {
  const db = getDb();
  db.prepare(
    `INSERT INTO help_reports (id, requestId, reportedEmail, reason, details, reportedByEmail, createdAt)
     VALUES (@id, @requestId, @reportedEmail, @reason, @details, @reportedByEmail, @createdAt)`
  ).run({
    ...report,
    details: report.details ?? null,
  });
  return report;
}

export function listReports(): { reports: HelpReport[]; countsByReportedEmail: { reportedEmail: string; count: number }[] } {
  const db = getDb();
  const reports = db.prepare(
    'SELECT * FROM help_reports ORDER BY createdAt DESC LIMIT 100'
  ).all() as HelpReport[];
  const counts = db.prepare(
    `SELECT reportedEmail, COUNT(*) as count FROM help_reports GROUP BY reportedEmail ORDER BY count DESC`
  ).all() as { reportedEmail: string; count: number }[];
  return {
    reports: reports.map((r) => ({ ...r, details: r.details ?? null })),
    countsByReportedEmail: counts,
  };
}

// Request activity (for detail page)

export function getRequestActivity(request: HelpRequest): RequestActivityEntry[] {
  const entries: RequestActivityEntry[] = [];
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

export function getRequestsSummary(): RequestsSummaryRow[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT subject, urgency, status, COUNT(*) as count
       FROM help_requests
       GROUP BY subject, urgency, status
       ORDER BY subject ASC, urgency ASC, status ASC`
    )
    .all() as RequestsSummaryRowRaw[];

  return rows.map((row) => ({
    subject: row.subject,
    urgency: row.urgency,
    status: row.status,
    count: row.count
  }));
}

export function getInsightsStats(): {
  totalOpen: number;
  totalClaimed: number;
  totalClosed: number;
  topSubjectsByOpen: { subject: string; count: number }[];
} {
  const db = getDb();
  const open = (db.prepare("SELECT COUNT(*) as c FROM help_requests WHERE status = 'open'").get() as { c: number }).c;
  const claimed = (db.prepare("SELECT COUNT(*) as c FROM help_requests WHERE status = 'claimed'").get() as { c: number }).c;
  const closed = (db.prepare("SELECT COUNT(*) as c FROM help_requests WHERE status = 'closed'").get() as { c: number }).c;
  const topSubjects = db
    .prepare(
      `SELECT subject, COUNT(*) as count FROM help_requests WHERE status = 'open' GROUP BY subject ORDER BY count DESC LIMIT 5`
    )
    .all() as { subject: string; count: number }[];
  return { totalOpen: open, totalClaimed: claimed, totalClosed: closed, topSubjectsByOpen: topSubjects };
}

// Planner sessions are generated in memory; this placeholder exists
// in case we want to persist them later.
export type { PlannerPlanSession };

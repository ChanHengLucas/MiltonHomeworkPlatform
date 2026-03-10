import { randomUUID } from 'crypto';
import { Router, Request } from 'express';
import { z } from 'zod';
import {
  getCourseAssignment,
  createCourse,
  listCoursesByTeacher,
  getCourseByCode,
  getCourse,
  addCourseMember,
  updateCourseAssignment,
  listAssignmentSubmissionsByAssignment,
  getAssignmentSubmissionById,
  listCourseMembers,
  createCourseAssignment,
  listCourseAssignmentsByCourse,
  createCourseAnnouncement,
  listCourseAnnouncementsByCourse,
  createGradingTask,
  listGradingTasksByTeacher,
  deleteGradingTask,
  createNotification,
  getCourseFeedbackSummary,
} from '@planner/db';
import { requireTeacher } from '../middleware/identity';

const createCourseSchema = z.object({
  name: z.string().min(1, 'Course name is required'),
});

const inviteSchema = z.object({
  emails: z.array(z.string().email()).min(1, 'At least one email required'),
});

const createAssignmentSchema = z.object({
  courseId: z.string().min(1, 'Course is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().nullable(),
  dueAtMs: z.number().int().optional().nullable(),
  estMinutes: z.number().int().min(5, 'Estimated time must be at least 5 minutes'),
  type: z.enum(['homework', 'quiz', 'test', 'project', 'reading', 'other']),
});

const createGradingTaskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  dueAtMs: z.number().int().optional().nullable(),
  estMinutes: z.number().int().min(5, 'Estimated time must be at least 5 minutes'),
});

const createAnnouncementSchema = z.object({
  title: z.string().min(1, 'Announcement title is required'),
  body: z.string().min(1, 'Announcement body is required'),
});

const updateAssignmentSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  dueAtMs: z.number().int().optional().nullable(),
  estMinutes: z.number().int().min(5).optional(),
  type: z.enum(['homework', 'quiz', 'test', 'project', 'reading', 'other']).optional(),
});

function generateCourseCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function createUniqueCourseCode(maxAttempts = 20): string {
  for (let i = 0; i < maxAttempts; i += 1) {
    const code = generateCourseCode();
    if (!getCourseByCode(code)) {
      return code;
    }
  }
  throw new Error('Failed to generate unique course code');
}

export const teacherRouter = Router();

teacherRouter.use(requireTeacher);

function getTeacherAssignmentOr404(assignmentId: string, teacherEmail: string) {
  const assignment = getCourseAssignment(assignmentId);
  if (!assignment) return null;
  const course = getCourse(assignment.courseId);
  if (!course || course.teacherEmail !== teacherEmail) return null;
  return { assignment, course };
}

teacherRouter.post('/courses', (req: Request, res, next) => {
  const parsed = createCourseSchema.safeParse(req.body);
  if (!parsed.success) {
    const err = new Error(parsed.error.errors.map((e) => e.message).join('; ')) as Error & { statusCode?: number };
    err.statusCode = 400;
    return next(err);
  }
  const teacherEmail = req.user!.email;
  const course = {
    id: randomUUID(),
    name: parsed.data.name,
    courseCode: createUniqueCourseCode(),
    teacherEmail,
    createdAt: new Date().toISOString(),
  };
  createCourse(course);
  res.status(201).json(course);
});

teacherRouter.get('/courses', (req: Request, res) => {
  const courses = listCoursesByTeacher(req.user!.email);
  res.json(courses);
});

teacherRouter.post('/courses/:id/invite', (req: Request, res, next) => {
  const course = getCourse(req.params.id);
  if (!course || course.teacherEmail !== req.user!.email) {
    return res.status(404).json({ error: 'Course not found' });
  }
  const parsed = inviteSchema.safeParse(req.body);
  if (!parsed.success) {
    const err = new Error(parsed.error.errors.map((e) => e.message).join('; ')) as Error & { statusCode?: number };
    err.statusCode = 400;
    return next(err);
  }
  for (const email of parsed.data.emails) {
    addCourseMember(course.id, email);
  }
  const members = listCourseMembers(course.id);
  res.json({ courseId: course.id, members });
});

teacherRouter.get('/courses/:id/members', (req: Request, res) => {
  const course = getCourse(req.params.id);
  if (!course || course.teacherEmail !== req.user!.email) {
    return res.status(404).json({ error: 'Course not found' });
  }
  const members = listCourseMembers(course.id);
  res.json({ courseId: course.id, members });
});

teacherRouter.post('/assignments', (req: Request, res, next) => {
  const parsed = createAssignmentSchema.safeParse(req.body);
  if (!parsed.success) {
    const err = new Error(parsed.error.errors.map((e) => e.message).join('; ')) as Error & { statusCode?: number };
    err.statusCode = 400;
    return next(err);
  }
  const course = getCourse(parsed.data.courseId);
  if (!course || course.teacherEmail !== req.user!.email) {
    return res.status(404).json({ error: 'Course not found' });
  }
  const a = {
    id: randomUUID(),
    courseId: parsed.data.courseId,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    dueAtMs: parsed.data.dueAtMs ?? null,
    estMinutes: parsed.data.estMinutes,
    type: parsed.data.type,
    createdByEmail: req.user!.email,
    createdAt: new Date().toISOString(),
  };
  createCourseAssignment(a);
  const members = listCourseMembers(course.id);
  for (const studentEmail of members) {
    try {
      createNotification({
        userEmail: studentEmail,
        type: 'assignment_posted',
        dedupeKey: `assignment_posted:${a.id}:${studentEmail.toLowerCase().trim()}`,
        payload: {
          assignmentId: a.id,
          courseId: course.id,
          courseName: course.name,
          title: a.title,
          dueAtMs: a.dueAtMs,
        },
      });
    } catch (err) {
      const log = (req as Request & { log?: { warn: (o: object, msg: string) => void } }).log;
      if (log) {
        log.warn({ err, courseId: course.id, studentEmail }, '[Teacher] Failed to create assignment notification');
      }
    }
  }
  res.status(201).json(a);
});

teacherRouter.get('/courses/:id/assignments', (req: Request, res) => {
  const course = getCourse(req.params.id);
  if (!course || course.teacherEmail !== req.user!.email) {
    return res.status(404).json({ error: 'Course not found' });
  }
  const assignments = listCourseAssignmentsByCourse(course.id);
  res.json(assignments);
});

teacherRouter.patch('/assignments/:id', (req: Request, res, next) => {
  const owned = getTeacherAssignmentOr404(req.params.id, req.user!.email);
  if (!owned) {
    return res.status(404).json({ error: 'Assignment not found' });
  }
  const parsed = updateAssignmentSchema.safeParse(req.body);
  if (!parsed.success) {
    const err = new Error(parsed.error.errors.map((e) => e.message).join('; ')) as Error & { statusCode?: number };
    err.statusCode = 400;
    return next(err);
  }
  const payload = parsed.data;
  if (Object.keys(payload).length === 0) {
    const err = new Error('At least one assignment field is required') as Error & { statusCode?: number };
    err.statusCode = 400;
    return next(err);
  }
  const updated = updateCourseAssignment(req.params.id, payload);
  if (!updated) {
    return res.status(404).json({ error: 'Assignment not found' });
  }
  res.json(updated);
});

teacherRouter.get('/assignments/:id/submissions', (req: Request, res) => {
  const owned = getTeacherAssignmentOr404(req.params.id, req.user!.email);
  if (!owned) {
    return res.status(404).json({ error: 'Assignment not found' });
  }
  const submissions = listAssignmentSubmissionsByAssignment(req.params.id);
  res.json({
    assignment: owned.assignment,
    submissions,
  });
});

teacherRouter.get('/assignments/:id/submissions/:submissionId', (req: Request, res) => {
  const owned = getTeacherAssignmentOr404(req.params.id, req.user!.email);
  if (!owned) {
    return res.status(404).json({ error: 'Assignment not found' });
  }
  const submission = getAssignmentSubmissionById(req.params.submissionId);
  if (!submission || submission.assignmentId !== req.params.id) {
    return res.status(404).json({ error: 'Submission not found' });
  }
  res.json(submission);
});

teacherRouter.post('/courses/:id/announcements', (req: Request, res, next) => {
  const course = getCourse(req.params.id);
  if (!course || course.teacherEmail !== req.user!.email) {
    return res.status(404).json({ error: 'Course not found' });
  }
  const parsed = createAnnouncementSchema.safeParse(req.body);
  if (!parsed.success) {
    const err = new Error(parsed.error.errors.map((e) => e.message).join('; ')) as Error & { statusCode?: number };
    err.statusCode = 400;
    return next(err);
  }
  const announcement = createCourseAnnouncement({
    id: randomUUID(),
    courseId: course.id,
    title: parsed.data.title.trim(),
    body: parsed.data.body.trim(),
    createdByEmail: req.user!.email,
    createdAt: new Date().toISOString(),
  });
  res.status(201).json(announcement);
});

teacherRouter.get('/courses/:id/announcements', (req: Request, res) => {
  const course = getCourse(req.params.id);
  if (!course || course.teacherEmail !== req.user!.email) {
    return res.status(404).json({ error: 'Course not found' });
  }
  const announcements = listCourseAnnouncementsByCourse(course.id);
  res.json(announcements);
});

teacherRouter.get('/courses/:id/feedback', (req: Request, res) => {
  const course = getCourse(req.params.id);
  if (!course || course.teacherEmail !== req.user!.email) {
    return res.status(404).json({ error: 'Course not found' });
  }
  const summary = getCourseFeedbackSummary(course.id);
  res.json(summary);
});

// Grading tasks

teacherRouter.post('/grading-tasks', (req: Request, res, next) => {
  const parsed = createGradingTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    const err = new Error(parsed.error.errors.map((e) => e.message).join('; ')) as Error & { statusCode?: number };
    err.statusCode = 400;
    return next(err);
  }
  const task = {
    id: randomUUID(),
    teacherEmail: req.user!.email,
    title: parsed.data.title,
    dueAtMs: parsed.data.dueAtMs ?? null,
    estMinutes: parsed.data.estMinutes,
    createdAt: new Date().toISOString(),
  };
  createGradingTask(task);
  res.status(201).json(task);
});

teacherRouter.get('/grading-tasks', (req: Request, res) => {
  const tasks = listGradingTasksByTeacher(req.user!.email);
  res.json(tasks);
});

teacherRouter.delete('/grading-tasks/:id', (req: Request, res) => {
  deleteGradingTask(req.params.id, req.user!.email);
  res.status(204).send();
});

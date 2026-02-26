import { randomUUID } from 'crypto';
import { Router, Request } from 'express';
import { z } from 'zod';
import {
  createCourse,
  listCoursesByTeacher,
  getCourse,
  addCourseMember,
  listCourseMembers,
  createCourseAssignment,
  listCourseAssignmentsByCourse,
  createGradingTask,
  listGradingTasksByTeacher,
  deleteGradingTask,
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

export const teacherRouter = Router();

teacherRouter.use(requireTeacher);

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

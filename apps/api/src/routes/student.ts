import { Router, Request } from 'express';
import { z } from 'zod';
import {
  addCourseMember,
  getCourse,
  getCourseByCode,
  getCourseFeedbackByStudent,
  isStudentInCourse,
  listCourseAnnouncementsByCourse,
  listCourseAssignmentsByCourse,
  listCourseAssignmentsForStudent,
  listCoursesByStudent,
  upsertCourseFeedback,
} from '@planner/db';
import { requireAuth } from '../middleware/identity';

export const studentRouter = Router();

studentRouter.use(requireAuth);

const joinByCodeSchema = z.object({
  courseCode: z.string().min(4, 'Course code is required'),
});

const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional().nullable(),
});

studentRouter.get('/assignments', (req: Request, res) => {
  const assignments = listCourseAssignmentsForStudent(req.user!.email);
  res.json(assignments);
});

studentRouter.get('/courses', (req: Request, res) => {
  const courses = listCoursesByStudent(req.user!.email);
  res.json(courses);
});

studentRouter.post('/courses/join-code', (req: Request, res, next) => {
  const parsed = joinByCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    const err = new Error(parsed.error.errors.map((e) => e.message).join('; ')) as Error & { statusCode?: number };
    err.statusCode = 400;
    return next(err);
  }
  const courseCode = parsed.data.courseCode.trim().toUpperCase();
  const course = getCourseByCode(courseCode);
  if (!course) {
    const err = new Error('Invalid course code') as Error & { statusCode?: number };
    err.statusCode = 404;
    return next(err);
  }
  addCourseMember(course.id, req.user!.email);
  res.json(course);
});

studentRouter.get('/courses/:id', (req: Request, res, next) => {
  const course = getCourse(req.params.id);
  if (!course) {
    const err = new Error('Course not found') as Error & { statusCode?: number };
    err.statusCode = 404;
    return next(err);
  }
  const allowed = isStudentInCourse(course.id, req.user!.email);
  if (!allowed) {
    const err = new Error('You are not enrolled in this course') as Error & { statusCode?: number };
    err.statusCode = 403;
    return next(err);
  }
  const assignments = listCourseAssignmentsByCourse(course.id);
  const announcements = listCourseAnnouncementsByCourse(course.id);
  res.json({ course, assignments, announcements });
});

studentRouter.get('/courses/:id/feedback', (req: Request, res, next) => {
  const course = getCourse(req.params.id);
  if (!course) {
    const err = new Error('Course not found') as Error & { statusCode?: number };
    err.statusCode = 404;
    return next(err);
  }
  const allowed = isStudentInCourse(course.id, req.user!.email);
  if (!allowed) {
    const err = new Error('You are not enrolled in this course') as Error & { statusCode?: number };
    err.statusCode = 403;
    return next(err);
  }
  const feedback = getCourseFeedbackByStudent(course.id, req.user!.email);
  res.json(feedback);
});

studentRouter.post('/courses/:id/feedback', (req: Request, res, next) => {
  const course = getCourse(req.params.id);
  if (!course) {
    const err = new Error('Course not found') as Error & { statusCode?: number };
    err.statusCode = 404;
    return next(err);
  }
  const allowed = isStudentInCourse(course.id, req.user!.email);
  if (!allowed) {
    const err = new Error('You are not enrolled in this course') as Error & { statusCode?: number };
    err.statusCode = 403;
    return next(err);
  }

  const parsed = feedbackSchema.safeParse(req.body);
  if (!parsed.success) {
    const err = new Error(parsed.error.errors.map((e) => e.message).join('; ')) as Error & { statusCode?: number };
    err.statusCode = 400;
    return next(err);
  }

  const feedback = upsertCourseFeedback(
    course.id,
    req.user!.email,
    parsed.data.rating,
    parsed.data.comment ?? null
  );
  res.status(201).json(feedback);
});

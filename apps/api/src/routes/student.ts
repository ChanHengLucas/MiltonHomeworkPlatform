import { Router, Request } from 'express';
import { z } from 'zod';
import {
  addCourseMember,
  addAssignmentSubmissionFile,
  getAssignmentSubmissionByStudent,
  getCourseAssignment,
  getCourse,
  getCourseByCode,
  getCourseFeedbackByStudent,
  isStudentInCourse,
  listAssignmentSubmissionsByStudent,
  listCourseAnnouncementsByCourse,
  listCourseAssignmentsByCourse,
  listCourseAssignmentsForStudent,
  listCoursesByStudent,
  upsertAssignmentSubmission,
  upsertCourseFeedback,
} from '@planner/db';
import { requireAuth } from '../middleware/identity';
import { saveBase64Upload } from '../utils/uploads';

export const studentRouter = Router();

studentRouter.use(requireAuth);

const joinByCodeSchema = z.object({
  courseCode: z.string().min(4, 'Course code is required'),
});

const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional().nullable(),
});

const submissionSchema = z.object({
  comment: z.string().max(4000).optional().nullable(),
  links: z.array(z.string().url('Submission links must be valid URLs')).max(8).optional(),
});

const submissionFileUploadSchema = z.object({
  fileName: z.string().min(1, 'File name is required').max(240),
  mimeType: z.string().max(120).optional().nullable(),
  contentBase64: z.string().min(1, 'File content is required'),
});

function httpError(message: string, statusCode: number): Error & { statusCode?: number } {
  const err = new Error(message) as Error & { statusCode?: number };
  err.statusCode = statusCode;
  return err;
}

function requireStudentAssignmentAccess(assignmentId: string, studentEmail: string): void {
  const assignment = getCourseAssignment(assignmentId);
  if (!assignment) {
    throw httpError('Assignment not found', 404);
  }
  const course = getCourse(assignment.courseId);
  if (!course || !isStudentInCourse(course.id, studentEmail)) {
    throw httpError('You are not enrolled in this assignment course', 403);
  }
}

studentRouter.get('/assignments', (req: Request, res) => {
  const assignments = listCourseAssignmentsForStudent(req.user!.email);
  res.json(assignments);
});

studentRouter.get('/assignments/submissions', (req: Request, res) => {
  const assignments = listCourseAssignmentsForStudent(req.user!.email);
  const visibleAssignmentIds = new Set(assignments.map((assignment) => assignment.id));
  const submissions = listAssignmentSubmissionsByStudent(req.user!.email)
    .filter((submission) => visibleAssignmentIds.has(submission.assignmentId));
  res.json(submissions);
});

studentRouter.get('/assignments/:assignmentId/submission', (req: Request, res, next) => {
  try {
    requireStudentAssignmentAccess(req.params.assignmentId, req.user!.email);
    const submission = getAssignmentSubmissionByStudent(req.params.assignmentId, req.user!.email);
    res.json(submission);
  } catch (err) {
    next(err);
  }
});

studentRouter.put('/assignments/:assignmentId/submission', (req: Request, res, next) => {
  try {
    requireStudentAssignmentAccess(req.params.assignmentId, req.user!.email);
    const parsed = submissionSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(httpError(parsed.error.errors.map((e) => e.message).join('; '), 400));
    }

    const submission = upsertAssignmentSubmission({
      assignmentId: req.params.assignmentId,
      studentEmail: req.user!.email,
      comment: parsed.data.comment ?? null,
      links: parsed.data.links ?? [],
    });
    res.json(submission);
  } catch (err) {
    next(err);
  }
});

studentRouter.post('/assignments/:assignmentId/submission/files', (req: Request, res, next) => {
  try {
    requireStudentAssignmentAccess(req.params.assignmentId, req.user!.email);
    const parsed = submissionFileUploadSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(httpError(parsed.error.errors.map((e) => e.message).join('; '), 400));
    }

    const submission = getAssignmentSubmissionByStudent(req.params.assignmentId, req.user!.email)
      ?? upsertAssignmentSubmission({
        assignmentId: req.params.assignmentId,
        studentEmail: req.user!.email,
        comment: null,
        links: [],
      });

    const saved = saveBase64Upload('assignment-submissions', {
      fileName: parsed.data.fileName,
      mimeType: parsed.data.mimeType ?? null,
      contentBase64: parsed.data.contentBase64,
    });

    addAssignmentSubmissionFile({
      submissionId: submission.id,
      originalName: saved.originalName,
      storedPath: saved.storedPath,
      mimeType: saved.mimeType ?? null,
      sizeBytes: saved.sizeBytes,
    });

    const updated = getAssignmentSubmissionByStudent(req.params.assignmentId, req.user!.email);
    res.status(201).json(updated);
  } catch (err) {
    next(err);
  }
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

import fs from 'fs';
import path from 'path';

import { Router, Request, Response, NextFunction } from 'express';
import {
  getAssignmentSubmissionById,
  getCourseAssignment,
  getCourse,
  getHelpRequestById,
  listHelpRequestResources,
} from '@planner/db';

import { requireAuth } from '../middleware/identity';
import { isTeacherEligible } from '../utils/identity';

export const uploadsRouter = Router();

uploadsRouter.use(requireAuth);

function uploadsRoot(): string {
  const configured = (process.env.UPLOADS_DIR || '').trim();
  return configured
    ? path.resolve(configured)
    : path.resolve(process.cwd(), 'data', 'uploads');
}

function safePath(storedPath: string): string | null {
  const resolved = path.resolve(uploadsRoot(), storedPath);
  if (!resolved.startsWith(uploadsRoot())) return null;
  if (!fs.existsSync(resolved)) return null;
  return resolved;
}

uploadsRouter.get('/submissions/:submissionId/files/:fileId', (req: Request, res: Response, next: NextFunction) => {
  const submission = getAssignmentSubmissionById(req.params.submissionId);
  if (!submission) {
    return res.status(404).json({ error: 'Submission not found' });
  }

  const userEmail = (req.user!.email || '').toLowerCase().trim();
  const isOwner = submission.studentEmail.toLowerCase().trim() === userEmail;
  const assignment = getCourseAssignment(submission.assignmentId);
  const course = assignment ? getCourse(assignment.courseId) : null;
  const isCoursTeacher = course && course.teacherEmail.toLowerCase().trim() === userEmail;

  if (!isOwner && !isCoursTeacher && !isTeacherEligible(userEmail)) {
    return res.status(403).json({ error: 'You do not have access to this file' });
  }

  const file = submission.files.find((f) => f.id === req.params.fileId);
  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }

  const absPath = safePath(file.storedPath);
  if (!absPath) {
    return res.status(404).json({ error: 'File not found on disk' });
  }

  const contentType = file.mimeType || 'application/octet-stream';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.originalName)}"`);
  fs.createReadStream(absPath).pipe(res);
});

uploadsRouter.get('/support-resources/:requestId/:resourceId', (req: Request, res: Response, next: NextFunction) => {
  const helpRequest = getHelpRequestById(req.params.requestId);
  if (!helpRequest) {
    return res.status(404).json({ error: 'Request not found' });
  }

  const userEmail = (req.user!.email || '').toLowerCase().trim();
  const creator = (helpRequest.createdByEmail || '').toLowerCase().trim();
  const claimer = (helpRequest.claimedByEmail || '').toLowerCase().trim();
  const canAccess =
    (creator && userEmail === creator) ||
    (claimer && userEmail === claimer) ||
    isTeacherEligible(userEmail);

  if (!canAccess) {
    return res.status(403).json({ error: 'You do not have access to this file' });
  }

  const resources = listHelpRequestResources(req.params.requestId);
  const resource = resources.find((r) => r.id === req.params.resourceId && r.kind === 'file');
  if (!resource || !resource.storedPath) {
    return res.status(404).json({ error: 'Resource not found' });
  }

  const absPath = safePath(resource.storedPath);
  if (!absPath) {
    return res.status(404).json({ error: 'File not found on disk' });
  }

  const contentType = resource.mimeType || 'application/octet-stream';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(resource.originalName || 'download')}"`);
  fs.createReadStream(absPath).pipe(res);
});

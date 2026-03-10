import { randomUUID } from 'crypto';

import { Router, Request } from 'express';
import { z } from 'zod';
import {
  createHelpRequest,
  listHelpRequestsVisibleTo,
  getHelpRequestById,
  claimHelpRequest,
  unclaimHelpRequest,
  closeHelpRequest,
  listCommentsForRequest,
  addComment,
  countActiveClaimsByEmail,
  countClaimsInLastHour,
  isBlocked,
  createReport,
  getRequestActivity,
  createNotification,
  addHelpRequestResource,
  listHelpRequestResources,
  type HelpRequest,
  type HelpComment,
  type HelpReport,
  type NotificationType,
} from '@planner/db';
import { isTeacherEligible } from '../utils/identity';
import { saveBase64Upload } from '../utils/uploads';

const MAX_ACTIVE_CLAIMS = parseInt(process.env.MAX_ACTIVE_CLAIMS ?? '2', 10) || 2;
const MAX_CLAIMS_PER_HOUR = parseInt(process.env.MAX_CLAIMS_PER_HOUR ?? '5', 10) || 5;

const createBodySchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  subject: z.string().min(1, 'Subject is required'),
  urgency: z.enum(['low', 'med', 'high']),
  linkedAssignmentId: z.string().uuid().optional().nullable(),
  claimMode: z.enum(['any', 'teacher_only']).default('any'),
  meetingAbout: z.string().max(240).optional().nullable(),
  meetingLocation: z.string().max(240).optional().nullable(),
  meetingLink: z.string().url('Meeting link must be a valid URL').max(400).optional().nullable(),
  proposedTimes: z.string().max(1000).optional().nullable(),
});

const claimBodySchema = z.object({
  claimedBy: z.string().min(1, 'claimedBy is required'),
});

const commentBodySchema = z.object({
  body: z.string().min(1, 'Body is required'),
});

const reportBodySchema = z.object({
  reason: z.enum(['spam', 'trolling', 'no_show', 'other']),
  details: z.string().optional(),
});

const resourceLinkBodySchema = z.object({
  url: z.string().url('Link must be a valid URL'),
  label: z.string().max(120).optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
});

const resourceFileBodySchema = z.object({
  fileName: z.string().min(1, 'File name is required').max(240),
  mimeType: z.string().max(120).optional().nullable(),
  contentBase64: z.string().min(1, 'File content is required'),
  label: z.string().max(120).optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
});

function getIdentity(req: Request): { email: string; name: string } {
  const email = (req.user?.email || '').trim();
  const name = (req.user?.name || '').trim();
  return {
    email,
    name,
  };
}

function displayNameFromEmail(email: string): string {
  const trimmed = email.trim();
  if (!trimmed) return '';
  const local = trimmed.slice(0, trimmed.indexOf('@'));
  return local || '';
}

function notifyUser(
  req: Request,
  userEmail: string | null | undefined,
  type: NotificationType,
  payload: Record<string, unknown>
): void {
  const normalized = (userEmail || '').toLowerCase().trim();
  if (!normalized) return;
  try {
    createNotification({
      userEmail: normalized,
      type,
      payload,
    });
  } catch (err) {
    const log = (req as Request & { log?: { warn: (o: object, msg: string) => void } }).log;
    if (log) {
      log.warn({ err, userEmail: normalized, type }, '[API] Failed to create request notification');
    }
  }
}

function canUserSeeRequest(req: HelpRequest, userEmail: string): boolean {
  const u = userEmail.toLowerCase().trim();
  if (!u) return false;
  if (req.status === 'open') return true;
  const creator = (req.createdByEmail || '').toLowerCase().trim();
  const claimer = (req.claimedByEmail || '').toLowerCase().trim();
  if (req.status === 'claimed') {
    return (creator && u === creator) || (claimer && u === claimer) || isTeacherEligible(u);
  }
  if (req.status === 'closed') {
    return (creator && u === creator) || isTeacherEligible(u);
  }
  return false;
}

function canUserModifyRequest(req: HelpRequest, userEmail: string): boolean {
  const normalized = userEmail.toLowerCase().trim();
  if (!normalized) return false;
  const creator = (req.createdByEmail || '').toLowerCase().trim();
  const claimer = (req.claimedByEmail || '').toLowerCase().trim();
  const isTeacher = isTeacherEligible(normalized);
  return Boolean(
    (creator && normalized === creator)
    || (claimer && normalized === claimer)
    || isTeacher
  );
}

export const requestsRouter = Router();

requestsRouter.get('/', (req, res) => {
  const identity = getIdentity(req);
  const userEmail = (identity.email || '').toLowerCase().trim();
  const isTeacher = userEmail && isTeacherEligible(userEmail);
  const subject = req.query.subject as string | undefined;
  const urgency = req.query.urgency as 'low' | 'med' | 'high' | undefined;
  const status = req.query.status as 'open' | 'claimed' | 'closed' | undefined;
  const showClosed = req.query.showClosed === 'true';

  const requests = listHelpRequestsVisibleTo(userEmail, !!isTeacher, {
    subject,
    urgency,
    status,
    excludeClosed: !showClosed && !status,
  });
  res.json(requests);
});

requestsRouter.get('/:id', (req, res, next) => {
  const identity = getIdentity(req);
  const userEmail = (identity.email || '').toLowerCase().trim();
  const request = getHelpRequestById(req.params.id);
  if (!request) {
    const err = new Error('Request not found') as Error & { statusCode?: number };
    err.statusCode = 404;
    return next(err);
  }
  if (!canUserSeeRequest(request, userEmail)) {
    return res.status(403).json({ error: 'This request is not available to you.' });
  }
  res.json(request);
});

requestsRouter.post('/', (req, res, next) => {
  const parsed = createBodySchema.safeParse(req.body);
  if (!parsed.success) {
    const err = new Error(parsed.error.errors.map((e) => e.message).join('; ')) as Error & {
      statusCode?: number;
    };
    err.statusCode = 400;
    return next(err);
  }

  const identity = getIdentity(req);
  if (process.env.NODE_ENV === 'development') {
    const log = (req as Request & { log?: { info: (o: object, msg: string) => void } }).log;
    if (log) log.info({ userEmail: identity.email, userName: identity.name }, '[API] Resolved request identity');
  }

  const data = parsed.data;
  const helpRequest: HelpRequest = {
    id: randomUUID(),
    title: data.title,
    description: data.description,
    subject: data.subject,
    urgency: data.urgency,
    status: 'open',
    createdAt: new Date().toISOString(),
    claimMode: data.claimMode,
    meetingAbout: data.meetingAbout?.trim() || null,
    meetingLocation: data.meetingLocation?.trim() || null,
    meetingLink: data.meetingLink?.trim() || null,
    proposedTimes: data.proposedTimes?.trim() || null,
    claimedBy: null,
    claimedByEmail: null,
    linkedAssignmentId: data.linkedAssignmentId ?? null,
    createdByEmail: identity.email || null,
  };

  createHelpRequest(helpRequest);
  res.status(201).json(helpRequest);
});

requestsRouter.post('/:id/claim', (req, res, next) => {
  const parsed = claimBodySchema.safeParse(req.body);
  if (!parsed.success) {
    const log = (req as Request & { log?: { warn: (o: object, msg: string) => void } }).log;
    if (log) log.warn({ errors: parsed.error.errors }, '[API] Claim validation failed');
    const err = new Error(parsed.error.errors.map((e) => e.message).join('; ')) as Error & {
      statusCode?: number;
    };
    err.statusCode = 400;
    return next(err);
  }

  const identity = getIdentity(req);
  const claimantEmail = identity.email?.toLowerCase().trim() || '';
  const request = getHelpRequestById(req.params.id);
  if (!request) {
    const err = new Error('Request not found') as Error & { statusCode?: number };
    err.statusCode = 404;
    return next(err);
  }
  const creatorEmail = (request.createdByEmail || '').toLowerCase().trim();
  if (creatorEmail && claimantEmail && creatorEmail === claimantEmail) {
    const log = (req as Request & { log?: { warn: (o: object, msg: string) => void } }).log;
    if (log) log.warn({ requestId: req.params.id }, '[API] Self-claim rejected');
    return res.status(400).json({ error: "You can't claim your own request." });
  }

  if (request.claimMode === 'teacher_only' && (!claimantEmail || !isTeacherEligible(claimantEmail))) {
    const log = (req as Request & { log?: { warn: (o: object, msg: string) => void } }).log;
    if (log) {
      log.warn({ requestId: req.params.id, claimantEmail }, '[API] Claim rejected by teacher-only mode');
    }
    return res.status(403).json({ error: 'This request is restricted to teacher/tutor claims.' });
  }

  if (isBlocked(claimantEmail)) {
    return res.status(403).json({ error: 'Your account is temporarily blocked from claiming requests.' });
  }

  const activeCount = countActiveClaimsByEmail(claimantEmail);
  if (activeCount >= MAX_ACTIVE_CLAIMS) {
    return res.status(429).json({
      error: `You can have at most ${MAX_ACTIVE_CLAIMS} active claimed requests. Release one before claiming another.`,
    });
  }

  const hourCount = countClaimsInLastHour(claimantEmail);
  if (hourCount >= MAX_CLAIMS_PER_HOUR) {
    return res.status(429).json({
      error: `You can claim at most ${MAX_CLAIMS_PER_HOUR} requests per hour. Please try again later.`,
    });
  }

  const updated = claimHelpRequest(
    req.params.id,
    parsed.data.claimedBy,
    claimantEmail || parsed.data.claimedBy
  );
  if (!updated || updated.status !== 'claimed') {
    const log = (req as Request & { log?: { info: (o: object, msg: string) => void } }).log;
    if (log) log.info({ requestId: req.params.id, claimedBy: parsed.data.claimedBy }, '[API] Claim failed: not found or already claimed');
    const err = new Error('Request not found or already claimed') as Error & {
      statusCode?: number;
    };
    err.statusCode = 404;
    return next(err);
  }
  const log = (req as Request & { log?: { info: (o: object, msg: string) => void } }).log;
  if (log) log.info({ requestId: req.params.id, claimedBy: parsed.data.claimedBy }, '[API] Request claimed');

  const requesterEmail = (updated.createdByEmail || '').toLowerCase().trim();
  if (requesterEmail && requesterEmail !== claimantEmail) {
    notifyUser(req, requesterEmail, 'request_claimed', {
      requestId: updated.id,
      title: updated.title,
      claimedBy: parsed.data.claimedBy,
      claimedByEmail: claimantEmail || null,
    });
  }
  res.json(updated);
});

requestsRouter.post('/:id/unclaim', (req, res, next) => {
  const identity = getIdentity(req);
  const userEmail = (identity.email || '').toLowerCase().trim();
  const request = getHelpRequestById(req.params.id);
  if (!request) {
    const err = new Error('Request not found') as Error & { statusCode?: number };
    err.statusCode = 404;
    return next(err);
  }
  if (request.status !== 'claimed') {
    return res.status(400).json({ error: 'Request is not claimed.' });
  }
  const creatorEmail = (request.createdByEmail || '').toLowerCase().trim();
  const claimerEmail = (request.claimedByEmail || '').toLowerCase().trim();
  const isRequester = userEmail && creatorEmail && userEmail === creatorEmail;
  const isClaimer = userEmail && claimerEmail && userEmail === claimerEmail;
  const isTeacher = userEmail && isTeacherEligible(userEmail);
  if (!isRequester && !isClaimer && !isTeacher) {
    return res.status(403).json({ error: 'Only the requester, claimer, or a teacher can release this claim.' });
  }
  const updated = unclaimHelpRequest(req.params.id);
  if (!updated) {
    const err = new Error('Request not found or not claimed') as Error & { statusCode?: number };
    err.statusCode = 404;
    return next(err);
  }

  const recipients = new Set<string>();
  if (creatorEmail) recipients.add(creatorEmail);
  if (claimerEmail) recipients.add(claimerEmail);
  recipients.delete(userEmail);
  for (const recipient of recipients) {
    notifyUser(req, recipient, 'request_unclaimed', {
      requestId: updated.id,
      title: updated.title,
      byEmail: userEmail || null,
    });
  }
  res.json(updated);
});

requestsRouter.post('/:id/close', (req, res, next) => {
  const identity = getIdentity(req);
  const userEmail = (identity.email || '').toLowerCase().trim();
  const request = getHelpRequestById(req.params.id);
  if (!request) {
    const err = new Error('Request not found') as Error & { statusCode?: number };
    err.statusCode = 404;
    return next(err);
  }
  const creatorEmail = (request.createdByEmail || '').toLowerCase().trim();
  const isRequester = userEmail && creatorEmail && userEmail === creatorEmail;
  const isTeacher = userEmail && isTeacherEligible(userEmail);
  if (!isRequester && !isTeacher) {
    return res.status(403).json({ error: 'Only the requester or a teacher can close this request.' });
  }
  const updated = closeHelpRequest(req.params.id);
  if (!updated) {
    const err = new Error('Request not found') as Error & { statusCode?: number };
    err.statusCode = 404;
    return next(err);
  }

  const claimerEmail = (request.claimedByEmail || '').toLowerCase().trim();
  const recipients = new Set<string>();
  if (creatorEmail) recipients.add(creatorEmail);
  if (claimerEmail) recipients.add(claimerEmail);
  recipients.delete(userEmail);
  for (const recipient of recipients) {
    notifyUser(req, recipient, 'request_closed', {
      requestId: updated.id,
      title: updated.title,
      byEmail: userEmail || null,
    });
  }
  res.json(updated);
});

requestsRouter.get('/:id/comments', (req, res, next) => {
  const identity = getIdentity(req);
  const userEmail = (identity.email || '').toLowerCase().trim();
  const request = getHelpRequestById(req.params.id);
  if (!request) {
    const err = new Error('Request not found') as Error & { statusCode?: number };
    err.statusCode = 404;
    return next(err);
  }
  if (!canUserSeeRequest(request, userEmail)) {
    return res.status(403).json({ error: 'This request is not available to you.' });
  }
  const comments = listCommentsForRequest(req.params.id);
  res.json(comments);
});

requestsRouter.get('/:id/resources', (req, res, next) => {
  const identity = getIdentity(req);
  const userEmail = (identity.email || '').toLowerCase().trim();
  const request = getHelpRequestById(req.params.id);
  if (!request) {
    const err = new Error('Request not found') as Error & { statusCode?: number };
    err.statusCode = 404;
    return next(err);
  }
  if (!canUserSeeRequest(request, userEmail)) {
    return res.status(403).json({ error: 'This request is not available to you.' });
  }
  const resources = listHelpRequestResources(req.params.id);
  res.json(resources);
});

requestsRouter.post('/:id/resources/link', (req, res, next) => {
  const parsed = resourceLinkBodySchema.safeParse(req.body);
  if (!parsed.success) {
    const err = new Error(parsed.error.errors.map((e) => e.message).join('; ')) as Error & {
      statusCode?: number;
    };
    err.statusCode = 400;
    return next(err);
  }

  const identity = getIdentity(req);
  const userEmail = (identity.email || '').toLowerCase().trim();
  const request = getHelpRequestById(req.params.id);
  if (!request) {
    const err = new Error('Request not found') as Error & { statusCode?: number };
    err.statusCode = 404;
    return next(err);
  }
  if (!canUserModifyRequest(request, userEmail)) {
    return res.status(403).json({ error: 'Only request participants can add resources.' });
  }

  const resource = addHelpRequestResource({
    requestId: request.id,
    kind: 'link',
    label: parsed.data.label ?? null,
    url: parsed.data.url,
    note: parsed.data.note ?? null,
    createdByEmail: userEmail || null,
  });
  res.status(201).json(resource);
});

requestsRouter.post('/:id/resources/file', (req, res, next) => {
  const parsed = resourceFileBodySchema.safeParse(req.body);
  if (!parsed.success) {
    const err = new Error(parsed.error.errors.map((e) => e.message).join('; ')) as Error & {
      statusCode?: number;
    };
    err.statusCode = 400;
    return next(err);
  }

  const identity = getIdentity(req);
  const userEmail = (identity.email || '').toLowerCase().trim();
  const request = getHelpRequestById(req.params.id);
  if (!request) {
    const err = new Error('Request not found') as Error & { statusCode?: number };
    err.statusCode = 404;
    return next(err);
  }
  if (!canUserModifyRequest(request, userEmail)) {
    return res.status(403).json({ error: 'Only request participants can add resources.' });
  }

  const saved = saveBase64Upload('support-resources', {
    fileName: parsed.data.fileName,
    mimeType: parsed.data.mimeType ?? null,
    contentBase64: parsed.data.contentBase64,
  });

  const resource = addHelpRequestResource({
    requestId: request.id,
    kind: 'file',
    label: parsed.data.label ?? null,
    note: parsed.data.note ?? null,
    originalName: saved.originalName,
    storedPath: saved.storedPath,
    mimeType: saved.mimeType ?? null,
    sizeBytes: saved.sizeBytes,
    createdByEmail: userEmail || null,
  });
  res.status(201).json(resource);
});

requestsRouter.post('/:id/comments', (req, res, next) => {
  const parsed = commentBodySchema.safeParse(req.body);
  if (!parsed.success) {
    const err = new Error(parsed.error.errors.map((e) => e.message).join('; ')) as Error & {
      statusCode?: number;
    };
    err.statusCode = 400;
    return next(err);
  }

  const identity = getIdentity(req);
  const commenterEmail = (identity.email || '').toLowerCase().trim();
  const commenterName = identity.name || displayNameFromEmail(identity.email || '');

  const request = getHelpRequestById(req.params.id);
  if (!request) {
    const err = new Error('Request not found') as Error & { statusCode?: number };
    err.statusCode = 404;
    return next(err);
  }
  if (!canUserSeeRequest(request, commenterEmail)) {
    return res.status(403).json({ error: 'This request is not available to you.' });
  }

  const creatorEmail = (request.createdByEmail || '').toLowerCase().trim();
  const claimedByEmail = (request.claimedByEmail || '').toLowerCase().trim();

  let authorLabel: 'requester' | 'helper' | 'teacher' | 'other' = 'other';
  if (commenterEmail && creatorEmail && commenterEmail === creatorEmail) {
    authorLabel = 'requester';
  } else if (commenterEmail && claimedByEmail && commenterEmail === claimedByEmail) {
    authorLabel = 'helper';
  } else if (commenterEmail && isTeacherEligible(commenterEmail)) {
    authorLabel = 'teacher';
  }

  const comment: HelpComment = {
    id: randomUUID(),
    requestId: req.params.id,
    authorLabel,
    authorDisplayName: commenterName || null,
    authorEmail: commenterEmail || null,
    body: parsed.data.body,
    createdAt: new Date().toISOString(),
  };

  addComment(comment);

  const recipients = new Set<string>();
  if (creatorEmail) recipients.add(creatorEmail);
  if (claimedByEmail) recipients.add(claimedByEmail);
  recipients.delete(commenterEmail);
  for (const recipient of recipients) {
    notifyUser(req, recipient, 'request_comment', {
      requestId: request.id,
      title: request.title,
      byEmail: commenterEmail || null,
      byName: commenterName || null,
      commentPreview: parsed.data.body.slice(0, 160),
    });
  }
  res.status(201).json(comment);
});

requestsRouter.post('/:id/report', (req, res, next) => {
  const parsed = reportBodySchema.safeParse(req.body);
  if (!parsed.success) {
    const err = new Error(parsed.error.errors.map((e) => e.message).join('; ')) as Error & { statusCode?: number };
    err.statusCode = 400;
    return next(err);
  }

  const identity = getIdentity(req);
  const reporterEmail = (identity.email || '').toLowerCase().trim();
  const request = getHelpRequestById(req.params.id);
  if (!request) {
    const err = new Error('Request not found') as Error & { statusCode?: number };
    err.statusCode = 404;
    return next(err);
  }
  if (request.status !== 'claimed') {
    return res.status(400).json({ error: 'Can only report claimed requests.' });
  }
  const creatorEmail = (request.createdByEmail || '').toLowerCase().trim();
  const claimerEmail = (request.claimedByEmail || '').toLowerCase().trim();
  const isRequester = reporterEmail && creatorEmail && reporterEmail === creatorEmail;
  const isTeacher = reporterEmail && isTeacherEligible(reporterEmail);
  if (!isRequester && !isTeacher) {
    return res.status(403).json({ error: 'Only the requester or a teacher can report.' });
  }

  const report: HelpReport = {
    id: randomUUID(),
    requestId: req.params.id,
    reportedEmail: claimerEmail || '',
    reason: parsed.data.reason,
    details: parsed.data.details ?? null,
    reportedByEmail: reporterEmail || '',
    createdAt: new Date().toISOString(),
  };
  createReport(report);
  res.status(201).json(report);
});

requestsRouter.get('/:id/activity', (req, res, next) => {
  const identity = getIdentity(req);
  const userEmail = (identity.email || '').toLowerCase().trim();
  const request = getHelpRequestById(req.params.id);
  if (!request) {
    const err = new Error('Request not found') as Error & { statusCode?: number };
    err.statusCode = 404;
    return next(err);
  }
  if (!canUserSeeRequest(request, userEmail)) {
    return res.status(403).json({ error: 'This request is not available to you.' });
  }
  const activity = getRequestActivity(request);
  res.json(activity);
});

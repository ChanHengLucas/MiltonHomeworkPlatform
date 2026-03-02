"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestsRouter = void 0;
const crypto_1 = require("crypto");
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("@planner/db");
const identity_1 = require("../utils/identity");
const MAX_ACTIVE_CLAIMS = parseInt(process.env.MAX_ACTIVE_CLAIMS ?? '2', 10) || 2;
const MAX_CLAIMS_PER_HOUR = parseInt(process.env.MAX_CLAIMS_PER_HOUR ?? '5', 10) || 5;
const createBodySchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Title is required'),
    description: zod_1.z.string().min(1, 'Description is required'),
    subject: zod_1.z.string().min(1, 'Subject is required'),
    urgency: zod_1.z.enum(['low', 'med', 'high']),
    linkedAssignmentId: zod_1.z.string().uuid().optional().nullable(),
    claimMode: zod_1.z.enum(['any', 'teacher_only']).default('any'),
    meetingAbout: zod_1.z.string().max(240).optional().nullable(),
    meetingLocation: zod_1.z.string().max(240).optional().nullable(),
    meetingLink: zod_1.z.string().url('Meeting link must be a valid URL').max(400).optional().nullable(),
    proposedTimes: zod_1.z.string().max(1000).optional().nullable(),
});
const claimBodySchema = zod_1.z.object({
    claimedBy: zod_1.z.string().min(1, 'claimedBy is required'),
});
const commentBodySchema = zod_1.z.object({
    body: zod_1.z.string().min(1, 'Body is required'),
});
const reportBodySchema = zod_1.z.object({
    reason: zod_1.z.enum(['spam', 'trolling', 'no_show', 'other']),
    details: zod_1.z.string().optional(),
});
function getIdentity(req) {
    const requestUserEmail = (req.user?.email || '').trim();
    const requestUserName = (req.user?.name || '').trim();
    const email = req.headers['x-user-email']?.trim() || '';
    const name = req.headers['x-user-name']?.trim() || '';
    return {
        email: requestUserEmail || email,
        name: requestUserName || name,
    };
}
function displayNameFromEmail(email) {
    const trimmed = email.trim();
    if (!trimmed)
        return '';
    const local = trimmed.slice(0, trimmed.indexOf('@'));
    return local || '';
}
function notifyUser(req, userEmail, type, payload) {
    const normalized = (userEmail || '').toLowerCase().trim();
    if (!normalized)
        return;
    try {
        (0, db_1.createNotification)({
            userEmail: normalized,
            type,
            payload,
        });
    }
    catch (err) {
        const log = req.log;
        if (log) {
            log.warn({ err, userEmail: normalized, type }, '[API] Failed to create request notification');
        }
    }
}
function canUserSeeRequest(req, userEmail) {
    const u = userEmail.toLowerCase().trim();
    if (!u)
        return false;
    if (req.status === 'open')
        return true;
    const creator = (req.createdByEmail || '').toLowerCase().trim();
    const claimer = (req.claimedByEmail || '').toLowerCase().trim();
    if (req.status === 'claimed') {
        return (creator && u === creator) || (claimer && u === claimer) || (0, identity_1.isTeacherEligible)(u);
    }
    if (req.status === 'closed') {
        return (creator && u === creator) || (0, identity_1.isTeacherEligible)(u);
    }
    return false;
}
exports.requestsRouter = (0, express_1.Router)();
exports.requestsRouter.get('/', (req, res) => {
    const identity = getIdentity(req);
    const userEmail = (identity.email || '').toLowerCase().trim();
    const isTeacher = userEmail && (0, identity_1.isTeacherEligible)(userEmail);
    const subject = req.query.subject;
    const urgency = req.query.urgency;
    const status = req.query.status;
    const showClosed = req.query.showClosed === 'true';
    const requests = (0, db_1.listHelpRequestsVisibleTo)(userEmail, !!isTeacher, {
        subject,
        urgency,
        status,
        excludeClosed: !showClosed && !status,
    });
    res.json(requests);
});
exports.requestsRouter.get('/:id', (req, res, next) => {
    const identity = getIdentity(req);
    const userEmail = (identity.email || '').toLowerCase().trim();
    const request = (0, db_1.getHelpRequestById)(req.params.id);
    if (!request) {
        const err = new Error('Request not found');
        err.statusCode = 404;
        return next(err);
    }
    if (!canUserSeeRequest(request, userEmail)) {
        return res.status(403).json({ error: 'This request is not available to you.' });
    }
    res.json(request);
});
exports.requestsRouter.post('/', (req, res, next) => {
    const parsed = createBodySchema.safeParse(req.body);
    if (!parsed.success) {
        const err = new Error(parsed.error.errors.map((e) => e.message).join('; '));
        err.statusCode = 400;
        return next(err);
    }
    const identity = getIdentity(req);
    if (process.env.NODE_ENV === 'development') {
        const log = req.log;
        if (log)
            log.info({ xUserEmail: identity.email, xUserName: identity.name }, '[API] Identity headers');
    }
    const data = parsed.data;
    const helpRequest = {
        id: (0, crypto_1.randomUUID)(),
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
    (0, db_1.createHelpRequest)(helpRequest);
    res.status(201).json(helpRequest);
});
exports.requestsRouter.post('/:id/claim', (req, res, next) => {
    const parsed = claimBodySchema.safeParse(req.body);
    if (!parsed.success) {
        const log = req.log;
        if (log)
            log.warn({ errors: parsed.error.errors }, '[API] Claim validation failed');
        const err = new Error(parsed.error.errors.map((e) => e.message).join('; '));
        err.statusCode = 400;
        return next(err);
    }
    const identity = getIdentity(req);
    const claimantEmail = identity.email?.toLowerCase().trim() || '';
    const request = (0, db_1.getHelpRequestById)(req.params.id);
    if (!request) {
        const err = new Error('Request not found');
        err.statusCode = 404;
        return next(err);
    }
    const creatorEmail = (request.createdByEmail || '').toLowerCase().trim();
    if (creatorEmail && claimantEmail && creatorEmail === claimantEmail) {
        const log = req.log;
        if (log)
            log.warn({ requestId: req.params.id }, '[API] Self-claim rejected');
        return res.status(400).json({ error: "You can't claim your own request." });
    }
    if (request.claimMode === 'teacher_only' && (!claimantEmail || !(0, identity_1.isTeacherEligible)(claimantEmail))) {
        const log = req.log;
        if (log) {
            log.warn({ requestId: req.params.id, claimantEmail }, '[API] Claim rejected by teacher-only mode');
        }
        return res.status(403).json({ error: 'This request is restricted to teacher/tutor claims.' });
    }
    if ((0, db_1.isBlocked)(claimantEmail)) {
        return res.status(403).json({ error: 'Your account is temporarily blocked from claiming requests.' });
    }
    const activeCount = (0, db_1.countActiveClaimsByEmail)(claimantEmail);
    if (activeCount >= MAX_ACTIVE_CLAIMS) {
        return res.status(429).json({
            error: `You can have at most ${MAX_ACTIVE_CLAIMS} active claimed requests. Release one before claiming another.`,
        });
    }
    const hourCount = (0, db_1.countClaimsInLastHour)(claimantEmail);
    if (hourCount >= MAX_CLAIMS_PER_HOUR) {
        return res.status(429).json({
            error: `You can claim at most ${MAX_CLAIMS_PER_HOUR} requests per hour. Please try again later.`,
        });
    }
    const updated = (0, db_1.claimHelpRequest)(req.params.id, parsed.data.claimedBy, claimantEmail || parsed.data.claimedBy);
    if (!updated || updated.status !== 'claimed') {
        const log = req.log;
        if (log)
            log.info({ requestId: req.params.id, claimedBy: parsed.data.claimedBy }, '[API] Claim failed: not found or already claimed');
        const err = new Error('Request not found or already claimed');
        err.statusCode = 404;
        return next(err);
    }
    const log = req.log;
    if (log)
        log.info({ requestId: req.params.id, claimedBy: parsed.data.claimedBy }, '[API] Request claimed');
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
exports.requestsRouter.post('/:id/unclaim', (req, res, next) => {
    const identity = getIdentity(req);
    const userEmail = (identity.email || '').toLowerCase().trim();
    const request = (0, db_1.getHelpRequestById)(req.params.id);
    if (!request) {
        const err = new Error('Request not found');
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
    const isTeacher = userEmail && (0, identity_1.isTeacherEligible)(userEmail);
    if (!isRequester && !isClaimer && !isTeacher) {
        return res.status(403).json({ error: 'Only the requester, claimer, or a teacher can release this claim.' });
    }
    const updated = (0, db_1.unclaimHelpRequest)(req.params.id);
    if (!updated) {
        const err = new Error('Request not found or not claimed');
        err.statusCode = 404;
        return next(err);
    }
    const recipients = new Set();
    if (creatorEmail)
        recipients.add(creatorEmail);
    if (claimerEmail)
        recipients.add(claimerEmail);
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
exports.requestsRouter.post('/:id/close', (req, res, next) => {
    const identity = getIdentity(req);
    const userEmail = (identity.email || '').toLowerCase().trim();
    const request = (0, db_1.getHelpRequestById)(req.params.id);
    if (!request) {
        const err = new Error('Request not found');
        err.statusCode = 404;
        return next(err);
    }
    const creatorEmail = (request.createdByEmail || '').toLowerCase().trim();
    const isRequester = userEmail && creatorEmail && userEmail === creatorEmail;
    const isTeacher = userEmail && (0, identity_1.isTeacherEligible)(userEmail);
    if (!isRequester && !isTeacher) {
        return res.status(403).json({ error: 'Only the requester or a teacher can close this request.' });
    }
    const updated = (0, db_1.closeHelpRequest)(req.params.id);
    if (!updated) {
        const err = new Error('Request not found');
        err.statusCode = 404;
        return next(err);
    }
    const claimerEmail = (request.claimedByEmail || '').toLowerCase().trim();
    const recipients = new Set();
    if (creatorEmail)
        recipients.add(creatorEmail);
    if (claimerEmail)
        recipients.add(claimerEmail);
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
exports.requestsRouter.get('/:id/comments', (req, res, next) => {
    const identity = getIdentity(req);
    const userEmail = (identity.email || '').toLowerCase().trim();
    const request = (0, db_1.getHelpRequestById)(req.params.id);
    if (!request) {
        const err = new Error('Request not found');
        err.statusCode = 404;
        return next(err);
    }
    if (!canUserSeeRequest(request, userEmail)) {
        return res.status(403).json({ error: 'This request is not available to you.' });
    }
    const comments = (0, db_1.listCommentsForRequest)(req.params.id);
    res.json(comments);
});
exports.requestsRouter.post('/:id/comments', (req, res, next) => {
    const parsed = commentBodySchema.safeParse(req.body);
    if (!parsed.success) {
        const err = new Error(parsed.error.errors.map((e) => e.message).join('; '));
        err.statusCode = 400;
        return next(err);
    }
    const identity = getIdentity(req);
    const commenterEmail = (identity.email || '').toLowerCase().trim();
    const commenterName = identity.name || displayNameFromEmail(identity.email || '');
    const request = (0, db_1.getHelpRequestById)(req.params.id);
    if (!request) {
        const err = new Error('Request not found');
        err.statusCode = 404;
        return next(err);
    }
    if (!canUserSeeRequest(request, commenterEmail)) {
        return res.status(403).json({ error: 'This request is not available to you.' });
    }
    const creatorEmail = (request.createdByEmail || '').toLowerCase().trim();
    const claimedByEmail = (request.claimedByEmail || '').toLowerCase().trim();
    let authorLabel = 'other';
    if (commenterEmail && creatorEmail && commenterEmail === creatorEmail) {
        authorLabel = 'requester';
    }
    else if (commenterEmail && claimedByEmail && commenterEmail === claimedByEmail) {
        authorLabel = 'helper';
    }
    else if (commenterEmail && (0, identity_1.isTeacherEligible)(commenterEmail)) {
        authorLabel = 'teacher';
    }
    const comment = {
        id: (0, crypto_1.randomUUID)(),
        requestId: req.params.id,
        authorLabel,
        authorDisplayName: commenterName || null,
        authorEmail: commenterEmail || null,
        body: parsed.data.body,
        createdAt: new Date().toISOString(),
    };
    (0, db_1.addComment)(comment);
    const recipients = new Set();
    if (creatorEmail)
        recipients.add(creatorEmail);
    if (claimedByEmail)
        recipients.add(claimedByEmail);
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
exports.requestsRouter.post('/:id/report', (req, res, next) => {
    const parsed = reportBodySchema.safeParse(req.body);
    if (!parsed.success) {
        const err = new Error(parsed.error.errors.map((e) => e.message).join('; '));
        err.statusCode = 400;
        return next(err);
    }
    const identity = getIdentity(req);
    const reporterEmail = (identity.email || '').toLowerCase().trim();
    const request = (0, db_1.getHelpRequestById)(req.params.id);
    if (!request) {
        const err = new Error('Request not found');
        err.statusCode = 404;
        return next(err);
    }
    if (request.status !== 'claimed') {
        return res.status(400).json({ error: 'Can only report claimed requests.' });
    }
    const creatorEmail = (request.createdByEmail || '').toLowerCase().trim();
    const claimerEmail = (request.claimedByEmail || '').toLowerCase().trim();
    const isRequester = reporterEmail && creatorEmail && reporterEmail === creatorEmail;
    const isTeacher = reporterEmail && (0, identity_1.isTeacherEligible)(reporterEmail);
    if (!isRequester && !isTeacher) {
        return res.status(403).json({ error: 'Only the requester or a teacher can report.' });
    }
    const report = {
        id: (0, crypto_1.randomUUID)(),
        requestId: req.params.id,
        reportedEmail: claimerEmail || '',
        reason: parsed.data.reason,
        details: parsed.data.details ?? null,
        reportedByEmail: reporterEmail || '',
        createdAt: new Date().toISOString(),
    };
    (0, db_1.createReport)(report);
    res.status(201).json(report);
});
exports.requestsRouter.get('/:id/activity', (req, res, next) => {
    const identity = getIdentity(req);
    const userEmail = (identity.email || '').toLowerCase().trim();
    const request = (0, db_1.getHelpRequestById)(req.params.id);
    if (!request) {
        const err = new Error('Request not found');
        err.statusCode = 404;
        return next(err);
    }
    if (!canUserSeeRequest(request, userEmail)) {
        return res.status(403).json({ error: 'This request is not available to you.' });
    }
    const activity = (0, db_1.getRequestActivity)(request);
    res.json(activity);
});

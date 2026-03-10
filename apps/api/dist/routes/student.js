"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.studentRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("@planner/db");
const identity_1 = require("../middleware/identity");
const uploads_1 = require("../utils/uploads");
exports.studentRouter = (0, express_1.Router)();
exports.studentRouter.use(identity_1.requireAuth);
const joinByCodeSchema = zod_1.z.object({
    courseCode: zod_1.z.string().min(4, 'Course code is required'),
});
const feedbackSchema = zod_1.z.object({
    rating: zod_1.z.number().int().min(1).max(5),
    comment: zod_1.z.string().max(1000).optional().nullable(),
});
const submissionSchema = zod_1.z.object({
    comment: zod_1.z.string().max(4000).optional().nullable(),
    links: zod_1.z.array(zod_1.z.string().url('Submission links must be valid URLs')).max(8).optional(),
});
const submissionFileUploadSchema = zod_1.z.object({
    fileName: zod_1.z.string().min(1, 'File name is required').max(240),
    mimeType: zod_1.z.string().max(120).optional().nullable(),
    contentBase64: zod_1.z.string().min(1, 'File content is required'),
});
function httpError(message, statusCode) {
    const err = new Error(message);
    err.statusCode = statusCode;
    return err;
}
function requireStudentAssignmentAccess(assignmentId, studentEmail) {
    const assignment = (0, db_1.getCourseAssignment)(assignmentId);
    if (!assignment) {
        throw httpError('Assignment not found', 404);
    }
    const course = (0, db_1.getCourse)(assignment.courseId);
    if (!course || !(0, db_1.isStudentInCourse)(course.id, studentEmail)) {
        throw httpError('You are not enrolled in this assignment course', 403);
    }
}
exports.studentRouter.get('/assignments', (req, res) => {
    const assignments = (0, db_1.listCourseAssignmentsForStudent)(req.user.email);
    res.json(assignments);
});
exports.studentRouter.get('/assignments/submissions', (req, res) => {
    const assignments = (0, db_1.listCourseAssignmentsForStudent)(req.user.email);
    const visibleAssignmentIds = new Set(assignments.map((assignment) => assignment.id));
    const submissions = (0, db_1.listAssignmentSubmissionsByStudent)(req.user.email)
        .filter((submission) => visibleAssignmentIds.has(submission.assignmentId));
    res.json(submissions);
});
exports.studentRouter.get('/assignments/:assignmentId/submission', (req, res, next) => {
    try {
        requireStudentAssignmentAccess(req.params.assignmentId, req.user.email);
        const submission = (0, db_1.getAssignmentSubmissionByStudent)(req.params.assignmentId, req.user.email);
        res.json(submission);
    }
    catch (err) {
        next(err);
    }
});
exports.studentRouter.put('/assignments/:assignmentId/submission', (req, res, next) => {
    try {
        requireStudentAssignmentAccess(req.params.assignmentId, req.user.email);
        const parsed = submissionSchema.safeParse(req.body);
        if (!parsed.success) {
            return next(httpError(parsed.error.errors.map((e) => e.message).join('; '), 400));
        }
        const submission = (0, db_1.upsertAssignmentSubmission)({
            assignmentId: req.params.assignmentId,
            studentEmail: req.user.email,
            comment: parsed.data.comment ?? null,
            links: parsed.data.links ?? [],
        });
        res.json(submission);
    }
    catch (err) {
        next(err);
    }
});
exports.studentRouter.post('/assignments/:assignmentId/submission/files', (req, res, next) => {
    try {
        requireStudentAssignmentAccess(req.params.assignmentId, req.user.email);
        const parsed = submissionFileUploadSchema.safeParse(req.body);
        if (!parsed.success) {
            return next(httpError(parsed.error.errors.map((e) => e.message).join('; '), 400));
        }
        const submission = (0, db_1.getAssignmentSubmissionByStudent)(req.params.assignmentId, req.user.email)
            ?? (0, db_1.upsertAssignmentSubmission)({
                assignmentId: req.params.assignmentId,
                studentEmail: req.user.email,
                comment: null,
                links: [],
            });
        const saved = (0, uploads_1.saveBase64Upload)('assignment-submissions', {
            fileName: parsed.data.fileName,
            mimeType: parsed.data.mimeType ?? null,
            contentBase64: parsed.data.contentBase64,
        });
        (0, db_1.addAssignmentSubmissionFile)({
            submissionId: submission.id,
            originalName: saved.originalName,
            storedPath: saved.storedPath,
            mimeType: saved.mimeType ?? null,
            sizeBytes: saved.sizeBytes,
        });
        const updated = (0, db_1.getAssignmentSubmissionByStudent)(req.params.assignmentId, req.user.email);
        res.status(201).json(updated);
    }
    catch (err) {
        next(err);
    }
});
exports.studentRouter.get('/courses', (req, res) => {
    const courses = (0, db_1.listCoursesByStudent)(req.user.email);
    res.json(courses);
});
exports.studentRouter.post('/courses/join-code', (req, res, next) => {
    const parsed = joinByCodeSchema.safeParse(req.body);
    if (!parsed.success) {
        const err = new Error(parsed.error.errors.map((e) => e.message).join('; '));
        err.statusCode = 400;
        return next(err);
    }
    const courseCode = parsed.data.courseCode.trim().toUpperCase();
    const course = (0, db_1.getCourseByCode)(courseCode);
    if (!course) {
        const err = new Error('Invalid course code');
        err.statusCode = 404;
        return next(err);
    }
    (0, db_1.addCourseMember)(course.id, req.user.email);
    res.json(course);
});
exports.studentRouter.get('/courses/:id', (req, res, next) => {
    const course = (0, db_1.getCourse)(req.params.id);
    if (!course) {
        const err = new Error('Course not found');
        err.statusCode = 404;
        return next(err);
    }
    const allowed = (0, db_1.isStudentInCourse)(course.id, req.user.email);
    if (!allowed) {
        const err = new Error('You are not enrolled in this course');
        err.statusCode = 403;
        return next(err);
    }
    const assignments = (0, db_1.listCourseAssignmentsByCourse)(course.id);
    const announcements = (0, db_1.listCourseAnnouncementsByCourse)(course.id);
    res.json({ course, assignments, announcements });
});
exports.studentRouter.get('/courses/:id/feedback', (req, res, next) => {
    const course = (0, db_1.getCourse)(req.params.id);
    if (!course) {
        const err = new Error('Course not found');
        err.statusCode = 404;
        return next(err);
    }
    const allowed = (0, db_1.isStudentInCourse)(course.id, req.user.email);
    if (!allowed) {
        const err = new Error('You are not enrolled in this course');
        err.statusCode = 403;
        return next(err);
    }
    const feedback = (0, db_1.getCourseFeedbackByStudent)(course.id, req.user.email);
    res.json(feedback);
});
exports.studentRouter.post('/courses/:id/feedback', (req, res, next) => {
    const course = (0, db_1.getCourse)(req.params.id);
    if (!course) {
        const err = new Error('Course not found');
        err.statusCode = 404;
        return next(err);
    }
    const allowed = (0, db_1.isStudentInCourse)(course.id, req.user.email);
    if (!allowed) {
        const err = new Error('You are not enrolled in this course');
        err.statusCode = 403;
        return next(err);
    }
    const parsed = feedbackSchema.safeParse(req.body);
    if (!parsed.success) {
        const err = new Error(parsed.error.errors.map((e) => e.message).join('; '));
        err.statusCode = 400;
        return next(err);
    }
    const feedback = (0, db_1.upsertCourseFeedback)(course.id, req.user.email, parsed.data.rating, parsed.data.comment ?? null);
    res.status(201).json(feedback);
});

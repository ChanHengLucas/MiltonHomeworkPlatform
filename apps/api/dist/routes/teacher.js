"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.teacherRouter = void 0;
const crypto_1 = require("crypto");
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("@planner/db");
const identity_1 = require("../middleware/identity");
const createCourseSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Course name is required'),
});
const inviteSchema = zod_1.z.object({
    emails: zod_1.z.array(zod_1.z.string().email()).min(1, 'At least one email required'),
});
const createAssignmentSchema = zod_1.z.object({
    courseId: zod_1.z.string().min(1, 'Course is required'),
    title: zod_1.z.string().min(1, 'Title is required'),
    description: zod_1.z.string().optional().nullable(),
    dueAtMs: zod_1.z.number().int().optional().nullable(),
    estMinutes: zod_1.z.number().int().min(5, 'Estimated time must be at least 5 minutes'),
    type: zod_1.z.enum(['homework', 'quiz', 'test', 'project', 'reading', 'other']),
});
const createGradingTaskSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Title is required'),
    dueAtMs: zod_1.z.number().int().optional().nullable(),
    estMinutes: zod_1.z.number().int().min(5, 'Estimated time must be at least 5 minutes'),
});
const createAnnouncementSchema = zod_1.z.object({
    title: zod_1.z.string().min(1, 'Announcement title is required'),
    body: zod_1.z.string().min(1, 'Announcement body is required'),
});
const updateAssignmentSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).optional(),
    description: zod_1.z.string().optional().nullable(),
    dueAtMs: zod_1.z.number().int().optional().nullable(),
    estMinutes: zod_1.z.number().int().min(5).optional(),
    type: zod_1.z.enum(['homework', 'quiz', 'test', 'project', 'reading', 'other']).optional(),
});
function generateCourseCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < 6; i += 1) {
        out += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return out;
}
function createUniqueCourseCode(maxAttempts = 20) {
    for (let i = 0; i < maxAttempts; i += 1) {
        const code = generateCourseCode();
        if (!(0, db_1.getCourseByCode)(code)) {
            return code;
        }
    }
    throw new Error('Failed to generate unique course code');
}
exports.teacherRouter = (0, express_1.Router)();
exports.teacherRouter.use(identity_1.requireTeacher);
function getTeacherAssignmentOr404(assignmentId, teacherEmail) {
    const assignment = (0, db_1.getCourseAssignment)(assignmentId);
    if (!assignment)
        return null;
    const course = (0, db_1.getCourse)(assignment.courseId);
    if (!course || course.teacherEmail !== teacherEmail)
        return null;
    return { assignment, course };
}
exports.teacherRouter.post('/courses', (req, res, next) => {
    const parsed = createCourseSchema.safeParse(req.body);
    if (!parsed.success) {
        const err = new Error(parsed.error.errors.map((e) => e.message).join('; '));
        err.statusCode = 400;
        return next(err);
    }
    const teacherEmail = req.user.email;
    const course = {
        id: (0, crypto_1.randomUUID)(),
        name: parsed.data.name,
        courseCode: createUniqueCourseCode(),
        teacherEmail,
        createdAt: new Date().toISOString(),
    };
    (0, db_1.createCourse)(course);
    res.status(201).json(course);
});
exports.teacherRouter.get('/courses', (req, res) => {
    const courses = (0, db_1.listCoursesByTeacher)(req.user.email);
    res.json(courses);
});
exports.teacherRouter.post('/courses/:id/invite', (req, res, next) => {
    const course = (0, db_1.getCourse)(req.params.id);
    if (!course || course.teacherEmail !== req.user.email) {
        return res.status(404).json({ error: 'Course not found' });
    }
    const parsed = inviteSchema.safeParse(req.body);
    if (!parsed.success) {
        const err = new Error(parsed.error.errors.map((e) => e.message).join('; '));
        err.statusCode = 400;
        return next(err);
    }
    for (const email of parsed.data.emails) {
        (0, db_1.addCourseMember)(course.id, email);
    }
    const members = (0, db_1.listCourseMembers)(course.id);
    res.json({ courseId: course.id, members });
});
exports.teacherRouter.get('/courses/:id/members', (req, res) => {
    const course = (0, db_1.getCourse)(req.params.id);
    if (!course || course.teacherEmail !== req.user.email) {
        return res.status(404).json({ error: 'Course not found' });
    }
    const members = (0, db_1.listCourseMembers)(course.id);
    res.json({ courseId: course.id, members });
});
exports.teacherRouter.post('/assignments', (req, res, next) => {
    const parsed = createAssignmentSchema.safeParse(req.body);
    if (!parsed.success) {
        const err = new Error(parsed.error.errors.map((e) => e.message).join('; '));
        err.statusCode = 400;
        return next(err);
    }
    const course = (0, db_1.getCourse)(parsed.data.courseId);
    if (!course || course.teacherEmail !== req.user.email) {
        return res.status(404).json({ error: 'Course not found' });
    }
    const a = {
        id: (0, crypto_1.randomUUID)(),
        courseId: parsed.data.courseId,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        dueAtMs: parsed.data.dueAtMs ?? null,
        estMinutes: parsed.data.estMinutes,
        type: parsed.data.type,
        createdByEmail: req.user.email,
        createdAt: new Date().toISOString(),
    };
    (0, db_1.createCourseAssignment)(a);
    const members = (0, db_1.listCourseMembers)(course.id);
    for (const studentEmail of members) {
        try {
            (0, db_1.createNotification)({
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
        }
        catch (err) {
            const log = req.log;
            if (log) {
                log.warn({ err, courseId: course.id, studentEmail }, '[Teacher] Failed to create assignment notification');
            }
        }
    }
    res.status(201).json(a);
});
exports.teacherRouter.get('/courses/:id/assignments', (req, res) => {
    const course = (0, db_1.getCourse)(req.params.id);
    if (!course || course.teacherEmail !== req.user.email) {
        return res.status(404).json({ error: 'Course not found' });
    }
    const assignments = (0, db_1.listCourseAssignmentsByCourse)(course.id);
    res.json(assignments);
});
exports.teacherRouter.patch('/assignments/:id', (req, res, next) => {
    const owned = getTeacherAssignmentOr404(req.params.id, req.user.email);
    if (!owned) {
        return res.status(404).json({ error: 'Assignment not found' });
    }
    const parsed = updateAssignmentSchema.safeParse(req.body);
    if (!parsed.success) {
        const err = new Error(parsed.error.errors.map((e) => e.message).join('; '));
        err.statusCode = 400;
        return next(err);
    }
    const payload = parsed.data;
    if (Object.keys(payload).length === 0) {
        const err = new Error('At least one assignment field is required');
        err.statusCode = 400;
        return next(err);
    }
    const updated = (0, db_1.updateCourseAssignment)(req.params.id, payload);
    if (!updated) {
        return res.status(404).json({ error: 'Assignment not found' });
    }
    res.json(updated);
});
exports.teacherRouter.get('/assignments/:id/submissions', (req, res) => {
    const owned = getTeacherAssignmentOr404(req.params.id, req.user.email);
    if (!owned) {
        return res.status(404).json({ error: 'Assignment not found' });
    }
    const submissions = (0, db_1.listAssignmentSubmissionsByAssignment)(req.params.id);
    res.json({
        assignment: owned.assignment,
        submissions,
    });
});
exports.teacherRouter.get('/assignments/:id/submissions/:submissionId', (req, res) => {
    const owned = getTeacherAssignmentOr404(req.params.id, req.user.email);
    if (!owned) {
        return res.status(404).json({ error: 'Assignment not found' });
    }
    const submission = (0, db_1.getAssignmentSubmissionById)(req.params.submissionId);
    if (!submission || submission.assignmentId !== req.params.id) {
        return res.status(404).json({ error: 'Submission not found' });
    }
    res.json(submission);
});
exports.teacherRouter.post('/courses/:id/announcements', (req, res, next) => {
    const course = (0, db_1.getCourse)(req.params.id);
    if (!course || course.teacherEmail !== req.user.email) {
        return res.status(404).json({ error: 'Course not found' });
    }
    const parsed = createAnnouncementSchema.safeParse(req.body);
    if (!parsed.success) {
        const err = new Error(parsed.error.errors.map((e) => e.message).join('; '));
        err.statusCode = 400;
        return next(err);
    }
    const announcement = (0, db_1.createCourseAnnouncement)({
        id: (0, crypto_1.randomUUID)(),
        courseId: course.id,
        title: parsed.data.title.trim(),
        body: parsed.data.body.trim(),
        createdByEmail: req.user.email,
        createdAt: new Date().toISOString(),
    });
    res.status(201).json(announcement);
});
exports.teacherRouter.get('/courses/:id/announcements', (req, res) => {
    const course = (0, db_1.getCourse)(req.params.id);
    if (!course || course.teacherEmail !== req.user.email) {
        return res.status(404).json({ error: 'Course not found' });
    }
    const announcements = (0, db_1.listCourseAnnouncementsByCourse)(course.id);
    res.json(announcements);
});
exports.teacherRouter.get('/courses/:id/feedback', (req, res) => {
    const course = (0, db_1.getCourse)(req.params.id);
    if (!course || course.teacherEmail !== req.user.email) {
        return res.status(404).json({ error: 'Course not found' });
    }
    const summary = (0, db_1.getCourseFeedbackSummary)(course.id);
    res.json(summary);
});
// Grading tasks
exports.teacherRouter.post('/grading-tasks', (req, res, next) => {
    const parsed = createGradingTaskSchema.safeParse(req.body);
    if (!parsed.success) {
        const err = new Error(parsed.error.errors.map((e) => e.message).join('; '));
        err.statusCode = 400;
        return next(err);
    }
    const task = {
        id: (0, crypto_1.randomUUID)(),
        teacherEmail: req.user.email,
        title: parsed.data.title,
        dueAtMs: parsed.data.dueAtMs ?? null,
        estMinutes: parsed.data.estMinutes,
        createdAt: new Date().toISOString(),
    };
    (0, db_1.createGradingTask)(task);
    res.status(201).json(task);
});
exports.teacherRouter.get('/grading-tasks', (req, res) => {
    const tasks = (0, db_1.listGradingTasksByTeacher)(req.user.email);
    res.json(tasks);
});
exports.teacherRouter.delete('/grading-tasks/:id', (req, res) => {
    (0, db_1.deleteGradingTask)(req.params.id, req.user.email);
    res.status(204).send();
});

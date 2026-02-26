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
exports.teacherRouter = (0, express_1.Router)();
exports.teacherRouter.use(identity_1.requireTeacher);
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

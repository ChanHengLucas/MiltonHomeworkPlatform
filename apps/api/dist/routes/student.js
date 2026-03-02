"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.studentRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("@planner/db");
const identity_1 = require("../middleware/identity");
exports.studentRouter = (0, express_1.Router)();
exports.studentRouter.use(identity_1.requireAuth);
const joinByCodeSchema = zod_1.z.object({
    courseCode: zod_1.z.string().min(4, 'Course code is required'),
});
const feedbackSchema = zod_1.z.object({
    rating: zod_1.z.number().int().min(1).max(5),
    comment: zod_1.z.string().max(1000).optional().nullable(),
});
exports.studentRouter.get('/assignments', (req, res) => {
    const assignments = (0, db_1.listCourseAssignmentsForStudent)(req.user.email);
    res.json(assignments);
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

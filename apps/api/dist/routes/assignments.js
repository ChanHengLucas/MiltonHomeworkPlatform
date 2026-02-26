"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignmentsRouter = void 0;
const crypto_1 = require("crypto");
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("@planner/db");
const core_1 = require("@planner/core");
const assignmentTypeEnum = zod_1.z.enum(['homework', 'quiz', 'test', 'project', 'reading', 'other']);
const prioritySchema = zod_1.z.number().int().min(1).max(5);
const createBodySchema = zod_1.z.object({
    course: zod_1.z.string().min(1, 'Course is required'),
    title: zod_1.z.string().min(1, 'Title is required'),
    dueAt: zod_1.z
        .number()
        .int()
        .refine((v) => v === undefined || v === null || (Number.isFinite(v) && v > 0), 'dueAt must be null or epoch ms > 0')
        .optional()
        .nullable(),
    estMinutes: zod_1.z.number().int().min(5, 'Estimated time must be at least 5 minutes'),
    priority: prioritySchema,
    type: assignmentTypeEnum,
});
const updateCompletionSchema = zod_1.z.object({
    completed: zod_1.z.boolean(),
});
const parseBodySchema = zod_1.z.object({
    text: zod_1.z.string(),
});
exports.assignmentsRouter = (0, express_1.Router)();
exports.assignmentsRouter.post('/parse', (req, res, next) => {
    const parsed = parseBodySchema.safeParse(req.body);
    if (!parsed.success) {
        const err = new Error(parsed.error.errors.map((e) => e.message).join('; '));
        err.statusCode = 400;
        return next(err);
    }
    const draft = (0, core_1.parseAssignmentText)(parsed.data.text);
    res.json(draft);
});
exports.assignmentsRouter.get('/', (_req, res) => {
    const assignments = (0, db_1.listAssignments)();
    res.json(assignments);
});
exports.assignmentsRouter.post('/', (req, res, next) => {
    const parsed = createBodySchema.safeParse(req.body);
    if (!parsed.success) {
        const log = req.log;
        if (log)
            log.warn({ errors: parsed.error.errors }, '[API] Assignment validation failed');
        const err = new Error(parsed.error.errors.map((e) => e.message).join('; '));
        err.statusCode = 400;
        return next(err);
    }
    const data = parsed.data;
    const dueAt = data.dueAt != null && Number.isFinite(data.dueAt) && data.dueAt > 0 ? data.dueAt : undefined;
    const assignment = {
        id: (0, crypto_1.randomUUID)(),
        course: data.course,
        title: data.title,
        dueAt,
        estMinutes: Math.max(5, data.estMinutes),
        priority: data.priority,
        type: data.type,
        completed: false,
    };
    (0, db_1.createAssignment)(assignment);
    res.status(201).json(assignment);
});
exports.assignmentsRouter.put('/:id', (req, res, next) => {
    const id = req.params.id;
    const parsed = updateCompletionSchema.safeParse(req.body);
    if (!parsed.success) {
        const err = new Error(parsed.error.errors.map((e) => e.message).join('; '));
        err.statusCode = 400;
        return next(err);
    }
    (0, db_1.updateAssignmentCompletion)(id, parsed.data.completed);
    const assignments = (0, db_1.listAssignments)();
    const updated = assignments.find((a) => a.id === id);
    res.json(updated ?? { id, completed: parsed.data.completed });
});
exports.assignmentsRouter.delete('/:id', (req, res) => {
    (0, db_1.deleteAssignment)(req.params.id);
    res.status(204).send();
});

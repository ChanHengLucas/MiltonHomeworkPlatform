import { randomUUID } from 'crypto';

import { Router, Request } from 'express';
import { z } from 'zod';
import {
  listAssignments,
  createAssignment,
  updateAssignmentCompletion,
  deleteAssignment,
} from '@planner/db';
import type { Assignment, AssignmentType } from '@planner/core';
import { parseAssignmentText } from '@planner/core';

const assignmentTypeEnum = z.enum(['homework', 'quiz', 'test', 'project', 'reading', 'other']);
const prioritySchema = z.number().int().min(1).max(5);

const createBodySchema = z.object({
  course: z.string().min(1, 'Course is required'),
  title: z.string().min(1, 'Title is required'),
  dueAt: z
    .number()
    .int()
    .refine((v) => v === undefined || v === null || (Number.isFinite(v) && v > 0), 'dueAt must be null or epoch ms > 0')
    .optional()
    .nullable(),
  estMinutes: z.number().int().min(5, 'Estimated time must be at least 5 minutes'),
  priority: prioritySchema,
  type: assignmentTypeEnum,
  optional: z.boolean().optional().default(false),
});

const updateCompletionSchema = z.object({
  completed: z.boolean(),
});

const parseBodySchema = z.object({
  text: z.string(),
});

export const assignmentsRouter = Router();

assignmentsRouter.post('/parse', (req, res, next) => {
  const parsed = parseBodySchema.safeParse(req.body);
  if (!parsed.success) {
    const err = new Error(parsed.error.errors.map((e) => e.message).join('; ')) as Error & {
      statusCode?: number;
    };
    err.statusCode = 400;
    return next(err);
  }
  const draft = parseAssignmentText(parsed.data.text);
  res.json(draft);
});

assignmentsRouter.get('/', (_req, res) => {
  const assignments = listAssignments();
  res.json(assignments);
});

assignmentsRouter.post('/', (req, res, next) => {
  const parsed = createBodySchema.safeParse(req.body);
  if (!parsed.success) {
    const log = (req as Request & { log?: { warn: (o: object, msg: string) => void } }).log;
    if (log) log.warn({ errors: parsed.error.errors }, '[API] Assignment validation failed');
    const err = new Error(parsed.error.errors.map((e) => e.message).join('; ')) as Error & {
      statusCode?: number;
    };
    err.statusCode = 400;
    return next(err);
  }

  const data = parsed.data;
  const dueAt = data.dueAt != null && Number.isFinite(data.dueAt) && data.dueAt > 0 ? data.dueAt : undefined;
  const assignment: Assignment = {
    id: randomUUID(),
    course: data.course,
    title: data.title,
    dueAt,
    estMinutes: Math.max(5, data.estMinutes),
    priority: data.priority as 1 | 2 | 3 | 4 | 5,
    type: data.type as AssignmentType,
    completed: false,
    optional: data.optional,
  };

  createAssignment(assignment);
  res.status(201).json(assignment);
});

assignmentsRouter.put('/:id', (req, res, next) => {
  const id = req.params.id;
  const parsed = updateCompletionSchema.safeParse(req.body);
  if (!parsed.success) {
    const err = new Error(parsed.error.errors.map((e) => e.message).join('; ')) as Error & {
      statusCode?: number;
    };
    err.statusCode = 400;
    return next(err);
  }

  updateAssignmentCompletion(id, parsed.data.completed);
  const assignments = listAssignments();
  const updated = assignments.find((a) => a.id === id);
  res.json(updated ?? { id, completed: parsed.data.completed });
});

assignmentsRouter.delete('/:id', (req, res) => {
  deleteAssignment(req.params.id);
  res.status(204).send();
});

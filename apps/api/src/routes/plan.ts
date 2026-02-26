import { randomUUID } from 'crypto';
import { Router, Request } from 'express';
import { z } from 'zod';
import {
  listAssignments,
  listAvailabilityBlocks,
  listCourseAssignmentsForStudent,
  listGradingTasksByTeacher,
} from '@planner/db';
import { makePlan } from '@planner/core';
import type { Assignment, AvailabilityBlock } from '@planner/core';
import { isTeacherEligible } from '../utils/identity';

const postBodySchema = z.object({
  sessionMin: z.number().int().min(5).max(120).optional(),
  now: z.string().datetime().optional(),
  busyBlocks: z.array(z.object({
    startMs: z.number(),
    endMs: z.number(),
  })).optional(),
});

function getMondayStart(d: Date): number {
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);
  return monday.getTime();
}

function subtractBusyFromAvailability(
  blocks: AvailabilityBlock[],
  busy: { startMs: number; endMs: number }[],
  weekStartMs: number
): AvailabilityBlock[] {
  const result: AvailabilityBlock[] = [];
  for (const block of blocks) {
    const blockStartMs = weekStartMs + block.startMin * 60 * 1000;
    const blockEndMs = weekStartMs + block.endMin * 60 * 1000;
    let segments: { start: number; end: number }[] = [{ start: blockStartMs, end: blockEndMs }];
    for (const b of busy) {
      const overlapStart = Math.max(b.startMs, blockStartMs);
      const overlapEnd = Math.min(b.endMs, blockEndMs);
      if (overlapStart < overlapEnd) {
        const next: { start: number; end: number }[] = [];
        for (const seg of segments) {
          if (b.startMs > seg.start) {
            next.push({ start: seg.start, end: Math.min(seg.end, b.startMs) });
          }
          if (b.endMs < seg.end) {
            next.push({ start: Math.max(seg.start, b.endMs), end: seg.end });
          }
        }
        segments = next.filter((s) => s.end > s.start);
      }
    }
    for (const seg of segments) {
      result.push({
        id: randomUUID(),
        startMin: Math.round((seg.start - weekStartMs) / 60000),
        endMin: Math.round((seg.end - weekStartMs) / 60000),
      });
    }
  }
  return result;
}

function toPlanAssignment(
  id: string,
  course: string,
  title: string,
  dueAtMs: number | null,
  estMinutes: number,
  type: string
): Assignment {
  return {
    id,
    course,
    title,
    dueAt: dueAtMs && dueAtMs > 0 ? dueAtMs : undefined,
    estMinutes,
    priority: 3,
    type: type as Assignment['type'],
    completed: false,
  };
}

export const planRouter = Router();

planRouter.post('/', async (req: Request, res, next) => {
  const parsed = postBodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    const err = new Error(parsed.error.errors.map((e) => e.message).join('; ')) as Error & {
      statusCode?: number;
    };
    err.statusCode = 400;
    return next(err);
  }

  const userEmail = req.user?.email || '';
  const isTeacher = isTeacherEligible(userEmail);

  let assignments: Assignment[] = [...listAssignments()];

  if (userEmail) {
    const courseAssignments = listCourseAssignmentsForStudent(userEmail);
    for (const ca of courseAssignments) {
      assignments.push(
        toPlanAssignment(ca.id, `[Course]`, ca.title, ca.dueAtMs, ca.estMinutes, ca.type)
      );
    }
    if (isTeacher) {
      const gradingTasks = listGradingTasksByTeacher(userEmail);
      for (const gt of gradingTasks) {
        assignments.push(
          toPlanAssignment(gt.id, 'Grading', gt.title, gt.dueAtMs, gt.estMinutes, 'other')
        );
      }
    }
  }

  let availability = listAvailabilityBlocks();

  const busyBlocks = parsed.data.busyBlocks;
  if (busyBlocks && busyBlocks.length > 0) {
    const now = parsed.data.now ? new Date(parsed.data.now) : new Date();
    const weekStartMs = getMondayStart(now);
    availability = subtractBusyFromAvailability(availability, busyBlocks, weekStartMs);
  }

  const result = makePlan({
    assignments,
    availability,
    sessionMin: parsed.data.sessionMin,
    now: parsed.data.now,
  });

  res.json(result);
});

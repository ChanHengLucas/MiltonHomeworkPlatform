import {
  Assignment,
  AvailabilityBlock,
  PlanRequest,
  PlanResult,
  PlannerPlanSession
} from './types';
import { computeUrgencyScore } from './urgencyScore';

interface Slot {
  startMin: number;
  endMin: number;
}

function buildSlots(blocks: AvailabilityBlock[], sessionMin: number): Slot[] {
  const slots: Slot[] = [];
  const sorted = [...blocks].sort((a, b) => a.startMin - b.startMin);

  for (const block of sorted) {
    let cursor = block.startMin;
    while (cursor + sessionMin <= block.endMin) {
      slots.push({ startMin: cursor, endMin: cursor + sessionMin });
      cursor += sessionMin;
    }
  }

  return slots;
}

export function makePlan(req: PlanRequest): PlanResult {
  const sessionMin = req.sessionMin && req.sessionMin > 0 ? req.sessionMin : 30;
  const warnings: string[] = [];

  const pendingAssignments: Assignment[] = req.assignments.filter((a) => !a.completed);

  if (pendingAssignments.length === 0) {
    return { sessions: [], warnings: ['No pending assignments to schedule.'] };
  }

  const slots = buildSlots(req.availability, sessionMin);
  if (slots.length === 0) {
    return {
      sessions: [],
      warnings: ['No availability blocks configured. Add availability to generate a plan.']
    };
  }

  const scoredAssignments = [...pendingAssignments].sort((a, b) => {
    const scoreA = computeUrgencyScore(a, req.now);
    const scoreB = computeUrgencyScore(b, req.now);
    // higher score first, break ties by due date then id for determinism
    if (scoreB !== scoreA) return scoreB - scoreA;

    const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY;
    const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY;
    if (aDue !== bDue) return aDue - bDue;

    return a.id.localeCompare(b.id);
  });

  const sessions: PlannerPlanSession[] = [];
  let slotIndex = 0;

  for (const assignment of scoredAssignments) {
    let remaining = assignment.estMinutes;

    while (remaining > 0 && slotIndex < slots.length) {
      const slot = slots[slotIndex];
      sessions.push({
        assignmentId: assignment.id,
        startMin: slot.startMin,
        endMin: slot.endMin
      });

      remaining -= sessionMin;
      slotIndex += 1;
    }

    if (remaining > 0) {
      warnings.push(
        `Insufficient time for "${assignment.title}". Short by approximately ${remaining} minutes.`
      );
    }
  }

  if (warnings.length === 0 && slotIndex < slots.length) {
    warnings.push('Plan generated with some free time remaining in your availability.');
  }

  return { sessions, warnings };
}


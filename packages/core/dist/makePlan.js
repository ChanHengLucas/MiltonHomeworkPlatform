"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makePlan = makePlan;
const urgencyScore_1 = require("./urgencyScore");
const MINUTES_PER_DAY = 24 * 60;
const LATE_NIGHT_START_MIN = 23 * 60;
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
function normalizeCourse(course) {
    return course.trim().toLowerCase();
}
function getCourseWeight(course, weights) {
    if (!weights)
        return 0;
    const key = normalizeCourse(course);
    const weighted = weights[key];
    if (!Number.isFinite(weighted))
        return 0;
    return weighted;
}
function applyAvailabilityPreferences(blocks, preferences) {
    if (!preferences)
        return blocks;
    const preferredStart = clamp(preferences.preferredStudyWindow?.startMin ?? 0, 0, MINUTES_PER_DAY - 1);
    const preferredEnd = clamp(preferences.preferredStudyWindow?.endMin ?? MINUTES_PER_DAY, 1, MINUTES_PER_DAY);
    if (preferredEnd <= preferredStart)
        return [];
    return blocks.flatMap((block) => {
        const dayStartMin = Math.floor(block.startMin / MINUTES_PER_DAY) * MINUTES_PER_DAY;
        const windowStartMin = dayStartMin + preferredStart;
        let windowEndMin = dayStartMin + preferredEnd;
        if (preferences.avoidLateNight) {
            windowEndMin = Math.min(windowEndMin, dayStartMin + LATE_NIGHT_START_MIN);
        }
        const startMin = Math.max(block.startMin, windowStartMin);
        const endMin = Math.min(block.endMin, windowEndMin);
        if (endMin <= startMin)
            return [];
        return [{ ...block, startMin, endMin }];
    });
}
function buildSlots(blocks, sessionMin, breakBetweenSessionsMin) {
    const slots = [];
    const sorted = [...blocks].sort((a, b) => a.startMin - b.startMin);
    for (const block of sorted) {
        let cursor = block.startMin;
        while (cursor + sessionMin <= block.endMin) {
            slots.push({ startMin: cursor, endMin: cursor + sessionMin });
            cursor += sessionMin + breakBetweenSessionsMin;
        }
    }
    return slots;
}
function makePlan(req) {
    const requestedSessionMin = req.sessionMin && req.sessionMin > 0 ? req.sessionMin : 30;
    const maxSessionMin = req.preferences?.maxSessionMin && req.preferences.maxSessionMin > 0
        ? req.preferences.maxSessionMin
        : 120;
    const sessionMin = Math.min(requestedSessionMin, maxSessionMin);
    const breakBetweenSessionsMin = clamp(req.preferences?.breakBetweenSessionsMin ?? 0, 0, 180);
    const warnings = [];
    if (requestedSessionMin > sessionMin) {
        warnings.push(`Session length capped at ${sessionMin} minutes based on your planner settings.`);
    }
    const pendingAssignments = req.assignments.filter((a) => !a.completed);
    if (pendingAssignments.length === 0) {
        return { sessions: [], warnings: ['No pending assignments to schedule.'] };
    }
    const preferredAvailability = applyAvailabilityPreferences(req.availability, req.preferences);
    const slots = buildSlots(preferredAvailability, sessionMin, breakBetweenSessionsMin);
    if (slots.length === 0) {
        if (req.availability.length > 0 && preferredAvailability.length === 0) {
            return {
                sessions: [],
                warnings: [
                    'No availability remains after applying your study window and late-night preferences.',
                ],
            };
        }
        return {
            sessions: [],
            warnings: ['No availability blocks configured. Add availability to generate a plan.']
        };
    }
    const scoredAssignments = [...pendingAssignments].sort((a, b) => {
        const aOptional = Boolean(a.optional);
        const bOptional = Boolean(b.optional);
        if (aOptional !== bOptional) {
            return aOptional ? 1 : -1;
        }
        const scoreA = (0, urgencyScore_1.computeUrgencyScore)(a, req.now) + getCourseWeight(a.course, req.preferences?.coursePriorityWeights);
        const scoreB = (0, urgencyScore_1.computeUrgencyScore)(b, req.now) + getCourseWeight(b.course, req.preferences?.coursePriorityWeights);
        // higher score first, break ties by due date then id for determinism
        if (scoreB !== scoreA)
            return scoreB - scoreA;
        const aDue = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY;
        const bDue = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY;
        if (aDue !== bDue)
            return aDue - bDue;
        return a.id.localeCompare(b.id);
    });
    const sessions = [];
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
            if (assignment.optional) {
                warnings.push(`Optional task "${assignment.title}" was not fully scheduled (${remaining} minutes unscheduled).`);
            }
            else {
                warnings.push(`Insufficient time for "${assignment.title}". Short by approximately ${remaining} minutes.`);
            }
        }
    }
    if (warnings.length === 0 && slotIndex < slots.length) {
        warnings.push('Plan generated with some free time remaining in your availability.');
    }
    return { sessions, warnings };
}

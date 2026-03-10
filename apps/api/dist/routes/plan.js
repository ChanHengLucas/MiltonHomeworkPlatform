"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.planRouter = void 0;
const crypto_1 = require("crypto");
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("@planner/db");
const core_1 = require("@planner/core");
const identity_1 = require("../utils/identity");
const identity_2 = require("../middleware/identity");
const postBodySchema = zod_1.z.object({
    sessionMin: zod_1.z.number().int().min(5).max(120).optional(),
    now: zod_1.z.string().datetime().optional(),
    busyBlocks: zod_1.z.array(zod_1.z.object({
        startMs: zod_1.z.number(),
        endMs: zod_1.z.number(),
    })).optional(),
});
function getMondayStart(d) {
    const day = d.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);
    return monday.getTime();
}
function subtractBusyFromAvailability(blocks, busy, weekStartMs) {
    const result = [];
    for (const block of blocks) {
        const blockStartMs = weekStartMs + block.startMin * 60 * 1000;
        const blockEndMs = weekStartMs + block.endMin * 60 * 1000;
        let segments = [{ start: blockStartMs, end: blockEndMs }];
        for (const b of busy) {
            const overlapStart = Math.max(b.startMs, blockStartMs);
            const overlapEnd = Math.min(b.endMs, blockEndMs);
            if (overlapStart < overlapEnd) {
                const next = [];
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
                id: (0, crypto_1.randomUUID)(),
                startMin: Math.round((seg.start - weekStartMs) / 60000),
                endMin: Math.round((seg.end - weekStartMs) / 60000),
            });
        }
    }
    return result;
}
function toPlanAssignment(id, course, title, dueAtMs, estMinutes, type) {
    return {
        id,
        course,
        title,
        dueAt: dueAtMs && dueAtMs > 0 ? dueAtMs : undefined,
        estMinutes,
        priority: 3,
        type: type,
        completed: false,
    };
}
exports.planRouter = (0, express_1.Router)();
exports.planRouter.use(identity_2.requireAuth);
exports.planRouter.post('/', async (req, res, next) => {
    const parsed = postBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
        const err = new Error(parsed.error.errors.map((e) => e.message).join('; '));
        err.statusCode = 400;
        return next(err);
    }
    const userEmail = req.user?.email || '';
    const isTeacher = (0, identity_1.isTeacherEligible)(userEmail);
    const preferences = userEmail ? (0, db_1.getPlannerPreferences)(userEmail) : null;
    let assignments = [...(0, db_1.listAssignments)(userEmail)];
    if (userEmail) {
        const courseAssignments = (0, db_1.listCourseAssignmentsForStudent)(userEmail);
        for (const ca of courseAssignments) {
            assignments.push(toPlanAssignment(ca.id, ca.courseName || 'Course', ca.title, ca.dueAtMs, ca.estMinutes, ca.type));
        }
        if (isTeacher) {
            const gradingTasks = (0, db_1.listGradingTasksByTeacher)(userEmail);
            for (const gt of gradingTasks) {
                assignments.push(toPlanAssignment(gt.id, 'Grading', gt.title, gt.dueAtMs, gt.estMinutes, 'other'));
            }
        }
    }
    let availability = (0, db_1.listAvailabilityBlocks)(userEmail);
    const busyBlocks = parsed.data.busyBlocks;
    if (busyBlocks && busyBlocks.length > 0) {
        const now = parsed.data.now ? new Date(parsed.data.now) : new Date();
        const weekStartMs = getMondayStart(now);
        availability = subtractBusyFromAvailability(availability, busyBlocks, weekStartMs);
    }
    const result = (0, core_1.makePlan)({
        assignments,
        availability,
        sessionMin: parsed.data.sessionMin,
        now: parsed.data.now,
        preferences: preferences
            ? {
                preferredStudyWindow: {
                    startMin: preferences.studyWindowStartMin,
                    endMin: preferences.studyWindowEndMin,
                },
                maxSessionMin: preferences.maxSessionMin,
                breakBetweenSessionsMin: preferences.breakBetweenSessionsMin,
                avoidLateNight: preferences.avoidLateNight,
                coursePriorityWeights: preferences.coursePriorityWeights,
            }
            : undefined,
    });
    const log = req.log;
    if (log) {
        log.info({
            userEmail,
            assignmentCount: assignments.length,
            availabilityCount: availability.length,
            busyBlocks: busyBlocks?.length ?? 0,
            sessionMin: parsed.data.sessionMin ?? null,
        }, '[Plan] Generated plan');
    }
    res.json(result);
});

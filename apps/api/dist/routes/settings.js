"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settingsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("@planner/db");
const identity_1 = require("../middleware/identity");
const plannerPreferencesSchema = zod_1.z
    .object({
    studyWindowStartMin: zod_1.z.number().int().min(0).max(1439),
    studyWindowEndMin: zod_1.z.number().int().min(1).max(1440),
    maxSessionMin: zod_1.z.number().int().min(5).max(180),
    breakBetweenSessionsMin: zod_1.z.number().int().min(0).max(120),
    avoidLateNight: zod_1.z.boolean(),
    coursePriorityWeights: zod_1.z.record(zod_1.z.number().min(-5).max(5)).default({}),
})
    .refine((value) => value.studyWindowEndMin > value.studyWindowStartMin, {
    message: 'Preferred study window end must be after start.',
    path: ['studyWindowEndMin'],
});
exports.settingsRouter = (0, express_1.Router)();
exports.settingsRouter.use(identity_1.requireAuth);
exports.settingsRouter.get('/planner-preferences', (req, res) => {
    const email = req.user.email;
    const preferences = (0, db_1.getPlannerPreferences)(email);
    res.json(preferences);
});
exports.settingsRouter.put('/planner-preferences', (req, res, next) => {
    const parsed = plannerPreferencesSchema.safeParse(req.body);
    if (!parsed.success) {
        const err = new Error(parsed.error.errors.map((e) => e.message).join('; '));
        err.statusCode = 400;
        return next(err);
    }
    const saved = (0, db_1.upsertPlannerPreferences)(req.user.email, parsed.data);
    const log = req.log;
    if (log) {
        log.info({
            userEmail: req.user.email,
            maxSessionMin: saved.maxSessionMin,
            breakBetweenSessionsMin: saved.breakBetweenSessionsMin,
        }, '[Settings] Updated planner preferences');
    }
    res.json(saved);
});

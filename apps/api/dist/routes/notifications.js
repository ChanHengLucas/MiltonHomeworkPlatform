"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationsRouter = void 0;
const express_1 = require("express");
const db_1 = require("@planner/db");
const zod_1 = require("zod");
const identity_1 = require("../middleware/identity");
const querySchema = zod_1.z.object({
    limit: zod_1.z.coerce.number().int().min(1).max(200).optional(),
});
exports.notificationsRouter = (0, express_1.Router)();
exports.notificationsRouter.use(identity_1.requireAuth);
exports.notificationsRouter.get('/', (req, res, next) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
        const err = new Error('Invalid query params');
        err.statusCode = 400;
        return next(err);
    }
    const limit = parsed.data.limit ?? 50;
    const notifications = (0, db_1.listNotificationsByUser)(req.user.email, limit);
    res.json(notifications);
});
exports.notificationsRouter.get('/unread-count', (req, res) => {
    const count = (0, db_1.getUnreadNotificationCount)(req.user.email);
    res.json({ count });
});
exports.notificationsRouter.post('/:id/read', (req, res) => {
    const updated = (0, db_1.markNotificationRead)(req.user.email, req.params.id);
    res.json({ ok: true, updated });
});
exports.notificationsRouter.post('/read-all', (req, res) => {
    const updated = (0, db_1.markAllNotificationsRead)(req.user.email);
    res.json({ ok: true, updated });
});

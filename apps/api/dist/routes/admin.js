"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRouter = void 0;
const crypto_1 = require("crypto");
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("@planner/db");
const identity_1 = require("../middleware/identity");
exports.adminRouter = (0, express_1.Router)();
const blocklistBodySchema = zod_1.z.object({
    blockedEmail: zod_1.z.string().email(),
    blockedUntil: zod_1.z.string().min(1), // ISO date
});
exports.adminRouter.post('/cleanup-closed', identity_1.requireTeacher, (req, res) => {
    const isProd = process.env.NODE_ENV === 'production';
    const token = process.env.ADMIN_CLEANUP_TOKEN;
    if (isProd && !token) {
        return res.status(403).json({ error: 'Cleanup disabled in production' });
    }
    const authHeader = req.headers.authorization;
    if (isProd && token && authHeader !== `Bearer ${token}`) {
        return res.status(403).json({ error: 'Invalid token' });
    }
    const daysParam = req.query.days;
    const days = daysParam ? parseInt(daysParam, 10) : 7;
    if (Number.isNaN(days) || days < 0) {
        return res.status(400).json({ error: 'Invalid days parameter' });
    }
    const logger = req.log;
    const result = days === 0 && !isProd
        ? (0, db_1.deleteAllClosedRequests)(logger)
        : (0, db_1.deleteClosedRequestsOlderThanDays)(days < 1 ? 7 : days, logger);
    res.json(result);
});
exports.adminRouter.get('/blocklist', identity_1.requireTeacher, (_req, res) => {
    const entries = (0, db_1.listBlocklistEntries)();
    res.json(entries);
});
exports.adminRouter.post('/blocklist', identity_1.requireTeacher, (req, res) => {
    const parsed = blocklistBodySchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors.map((e) => e.message).join('; ') });
    }
    const entry = {
        id: (0, crypto_1.randomUUID)(),
        blockedEmail: parsed.data.blockedEmail.toLowerCase().trim(),
        blockedUntil: parsed.data.blockedUntil,
        blockedByEmail: req.user?.email || '',
        createdAt: new Date().toISOString(),
    };
    (0, db_1.addBlocklistEntry)(entry);
    res.status(201).json(entry);
});

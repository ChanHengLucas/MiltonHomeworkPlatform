"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insightsRouter = void 0;
const express_1 = require("express");
const db_1 = require("@planner/db");
const identity_1 = require("../utils/identity");
exports.insightsRouter = (0, express_1.Router)();
function requireTeacher(req, res, next) {
    const email = req.headers['x-user-email']?.trim() || '';
    const userEmail = email.toLowerCase();
    if (!userEmail || !(0, identity_1.isTeacherEligible)(userEmail)) {
        res.status(403).json({ error: 'Teacher dashboard only. Access restricted.' });
        return;
    }
    next();
}
exports.insightsRouter.use(requireTeacher);
exports.insightsRouter.get('/requests-summary', (_req, res) => {
    const summary = (0, db_1.getRequestsSummary)();
    res.json(summary);
});
exports.insightsRouter.get('/stats', (_req, res) => {
    const stats = (0, db_1.getInsightsStats)();
    res.json(stats);
});
exports.insightsRouter.get('/reports', (_req, res) => {
    const { reports, countsByReportedEmail } = (0, db_1.listReports)();
    res.json({ reports, countsByReportedEmail });
});

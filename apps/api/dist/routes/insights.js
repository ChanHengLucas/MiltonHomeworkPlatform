"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.insightsRouter = void 0;
const express_1 = require("express");
const db_1 = require("@planner/db");
const identity_1 = require("../middleware/identity");
exports.insightsRouter = (0, express_1.Router)();
exports.insightsRouter.use(identity_1.requireTeacher);
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

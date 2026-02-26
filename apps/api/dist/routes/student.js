"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.studentRouter = void 0;
const express_1 = require("express");
const db_1 = require("@planner/db");
const identity_1 = require("../middleware/identity");
exports.studentRouter = (0, express_1.Router)();
exports.studentRouter.use(identity_1.requireAuth);
exports.studentRouter.get('/assignments', (req, res) => {
    const assignments = (0, db_1.listCourseAssignmentsForStudent)(req.user.email);
    res.json(assignments);
});

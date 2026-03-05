"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbRouter = void 0;
const express_1 = require("express");
const db_1 = require("@planner/db");
exports.dbRouter = (0, express_1.Router)();
exports.dbRouter.get('/health', (req, res, next) => {
    try {
        const result = (0, db_1.runDbHealthCheck)();
        res.json(result);
    }
    catch (err) {
        const log = req.log;
        if (log) {
            const e = err;
            log.error({
                code: e.code ?? 'UNKNOWN',
                message: e.message ?? String(err),
                dbFile: (0, db_1.getDatabaseFilePath)(),
            }, '[DB] Health check failed');
        }
        const error = new Error('Database health check failed');
        error.statusCode = 500;
        next(error);
    }
});

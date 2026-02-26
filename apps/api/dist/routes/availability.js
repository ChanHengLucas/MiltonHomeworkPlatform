"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.availabilityRouter = void 0;
const crypto_1 = require("crypto");
const express_1 = require("express");
const zod_1 = require("zod");
const db_1 = require("@planner/db");
const createBodySchema = zod_1.z.object({
    startMin: zod_1.z.number().int().min(0),
    endMin: zod_1.z.number().int().min(0),
});
exports.availabilityRouter = (0, express_1.Router)();
exports.availabilityRouter.get('/', (_req, res) => {
    const blocks = (0, db_1.listAvailabilityBlocks)();
    res.json(blocks);
});
exports.availabilityRouter.post('/', (req, res, next) => {
    const parsed = createBodySchema.safeParse(req.body);
    if (!parsed.success) {
        const err = new Error(parsed.error.errors.map((e) => e.message).join('; '));
        err.statusCode = 400;
        return next(err);
    }
    const { startMin, endMin } = parsed.data;
    if (endMin <= startMin) {
        const err = new Error('endMin must be greater than startMin');
        err.statusCode = 400;
        return next(err);
    }
    const block = {
        id: (0, crypto_1.randomUUID)(),
        startMin,
        endMin,
    };
    (0, db_1.createAvailabilityBlock)(block);
    res.status(201).json(block);
});
exports.availabilityRouter.delete('/:id', (req, res) => {
    (0, db_1.deleteAvailabilityBlock)(req.params.id);
    res.status(204).send();
});

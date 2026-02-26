"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const makePlan_1 = require("../src/makePlan");
const baseAssignment = {
    course: 'Math',
    title: 'Default',
    dueAt: undefined,
    estMinutes: 60,
    priority: 3,
    type: 'homework',
    completed: false
};
const mkAssignment = (id, overrides = {}) => ({
    id,
    ...baseAssignment,
    ...overrides
});
const mkAvailability = (id, startMin, endMin) => ({
    id,
    startMin,
    endMin
});
(0, vitest_1.describe)('makePlan', () => {
    (0, vitest_1.it)('returns warning when no assignments', () => {
        const result = (0, makePlan_1.makePlan)({
            assignments: [],
            availability: [mkAvailability('a1', 60, 120)],
            sessionMin: 30,
            now: '2024-01-01T00:00:00Z'
        });
        (0, vitest_1.expect)(result.sessions).toHaveLength(0);
        (0, vitest_1.expect)(result.warnings[0]).toMatch(/No pending assignments/i);
    });
    (0, vitest_1.it)('returns warning when no availability', () => {
        const result = (0, makePlan_1.makePlan)({
            assignments: [mkAssignment('as1')],
            availability: [],
            sessionMin: 30,
            now: '2024-01-01T00:00:00Z'
        });
        (0, vitest_1.expect)(result.sessions).toHaveLength(0);
        (0, vitest_1.expect)(result.warnings[0]).toMatch(/No availability blocks/i);
    });
    (0, vitest_1.it)('allocates sessions greedily into availability slots', () => {
        const assignments = [
            mkAssignment('as1', { estMinutes: 60, priority: 5 }),
            mkAssignment('as2', { estMinutes: 30, priority: 1 })
        ];
        const availability = [mkAvailability('a1', 0, 120)];
        const result = (0, makePlan_1.makePlan)({
            assignments,
            availability,
            sessionMin: 30,
            now: '2024-01-01T00:00:00Z'
        });
        // Total slots: 4 (0-30,30-60,60-90,90-120)
        (0, vitest_1.expect)(result.sessions).toHaveLength(3);
        const first = result.sessions[0];
        (0, vitest_1.expect)(first.assignmentId).toBe('as1');
        (0, vitest_1.expect)(first.startMin).toBe(0);
        (0, vitest_1.expect)(first.endMin).toBe(30);
    });
    (0, vitest_1.it)('adds warning when time is insufficient', () => {
        const assignments = [mkAssignment('as1', { estMinutes: 120 })];
        const availability = [mkAvailability('a1', 0, 60)];
        const result = (0, makePlan_1.makePlan)({
            assignments,
            availability,
            sessionMin: 30,
            now: '2024-01-01T00:00:00Z'
        });
        (0, vitest_1.expect)(result.sessions).toHaveLength(2);
        (0, vitest_1.expect)(result.warnings.length).toBeGreaterThan(0);
        (0, vitest_1.expect)(result.warnings[0]).toMatch(/Insufficient time/i);
    });
});

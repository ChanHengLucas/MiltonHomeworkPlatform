"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const parseAssignmentText_1 = require("../src/parseAssignmentText");
(0, vitest_1.describe)('parseAssignmentText', () => {
    (0, vitest_1.it)('uses first line as title', () => {
        const input = 'Read Chapter 3\nDetails about the assignment';
        const result = (0, parseAssignmentText_1.parseAssignmentText)(input);
        (0, vitest_1.expect)(result.title).toBe('Read Chapter 3');
    });
    (0, vitest_1.it)('parses hours into minutes', () => {
        const input = 'Project\nThis will take about 2 hours to complete.';
        const result = (0, parseAssignmentText_1.parseAssignmentText)(input);
        (0, vitest_1.expect)(result.estMinutes).toBe(120);
    });
    (0, vitest_1.it)('parses minutes', () => {
        const input = 'Quiz 1\nEstimated time: 30 min';
        const result = (0, parseAssignmentText_1.parseAssignmentText)(input);
        (0, vitest_1.expect)(result.estMinutes).toBe(30);
    });
    (0, vitest_1.it)('detects type by keyword', () => {
        const input = 'Midterm Exam\nFull midterm test on chapters 1-4';
        const result = (0, parseAssignmentText_1.parseAssignmentText)(input);
        (0, vitest_1.expect)(result.type).toBe('test');
    });
    (0, vitest_1.it)('falls back to other when no keyword found', () => {
        const input = 'Reflection\nWrite a short reflection.';
        const result = (0, parseAssignmentText_1.parseAssignmentText)(input);
        (0, vitest_1.expect)(result.type).toBe('other');
    });
});

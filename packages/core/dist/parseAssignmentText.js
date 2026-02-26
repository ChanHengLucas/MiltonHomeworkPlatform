"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseAssignmentText = parseAssignmentText;
const HOURS_PATTERN = /(\d+(?:\.\d+)?)\s*(hours?|hrs?|h)\b/i;
const MINUTES_PATTERN = /(\d+)\s*(minutes?|mins?|min)\b/i;
const TYPE_KEYWORDS = [
    {
        type: 'quiz',
        patterns: [/quiz\b/i]
    },
    {
        type: 'test',
        patterns: [/test\b/i, /\bexam\b/i, /\bmidterm\b/i, /\bfinal\b/i]
    },
    {
        type: 'project',
        patterns: [/project\b/i, /\bassignment\b/i, /\bessay\b/i]
    },
    {
        type: 'reading',
        patterns: [/read(ing)?\b/i, /\bchapters?\b/i, /\bpages?\b/i]
    },
    {
        type: 'homework',
        patterns: [/homework\b/i, /\bhw\b/i, /\bproblem set\b/i]
    }
];
function parseAssignmentText(input) {
    const normalized = input.trim();
    const lines = normalized.split(/\r?\n/).map((l) => l.trim());
    const title = lines[0] ?? '';
    const lower = normalized.toLowerCase();
    let estMinutes = null;
    const hoursMatch = lower.match(HOURS_PATTERN);
    if (hoursMatch) {
        const hours = parseFloat(hoursMatch[1]);
        if (!Number.isNaN(hours) && hours > 0) {
            estMinutes = Math.round(hours * 60);
        }
    }
    if (estMinutes === null) {
        const minutesMatch = lower.match(MINUTES_PATTERN);
        if (minutesMatch) {
            const mins = parseInt(minutesMatch[1], 10);
            if (!Number.isNaN(mins) && mins > 0) {
                estMinutes = mins;
            }
        }
    }
    let type = 'other';
    for (const entry of TYPE_KEYWORDS) {
        if (entry.patterns.some((re) => re.test(normalized))) {
            type = entry.type;
            break;
        }
    }
    return {
        title,
        estMinutes,
        type
    };
}

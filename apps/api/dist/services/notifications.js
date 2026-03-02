"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDueReminderScan = runDueReminderScan;
const db_1 = require("@planner/db");
const DUE_REMINDER_WINDOW_MS = 20 * 60 * 1000; // +/- 20 min
function dueType(hoursBeforeDue) {
    return hoursBeforeDue === 6 ? 'due_reminder_6h' : 'due_reminder_24h';
}
function runDueReminderScan(logger) {
    const now = Date.now();
    let created = 0;
    for (const hoursBeforeDue of [24, 6]) {
        const targetMs = now + hoursBeforeDue * 60 * 60 * 1000;
        const candidates = (0, db_1.listCourseAssignmentDueReminderCandidates)(targetMs - DUE_REMINDER_WINDOW_MS, targetMs + DUE_REMINDER_WINDOW_MS);
        for (const item of candidates) {
            try {
                const notification = (0, db_1.createNotification)({
                    userEmail: item.studentEmail,
                    type: dueType(hoursBeforeDue),
                    dedupeKey: `due:${hoursBeforeDue}:${item.assignmentId}:${item.studentEmail.toLowerCase().trim()}`,
                    payload: {
                        assignmentId: item.assignmentId,
                        courseId: item.courseId,
                        courseName: item.courseName,
                        title: item.title,
                        dueAtMs: item.dueAtMs,
                        hoursBeforeDue,
                    },
                });
                if (notification)
                    created += 1;
            }
            catch (err) {
                if (logger?.error) {
                    logger.error({ err, assignmentId: item.assignmentId, studentEmail: item.studentEmail, hoursBeforeDue }, '[Notifications] Failed to create due reminder');
                }
            }
        }
    }
    if (logger?.info) {
        logger.info({ created }, '[Notifications] Due reminder scan complete');
    }
}

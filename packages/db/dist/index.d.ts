import { Database } from 'better-sqlite3';
import type { Assignment, AvailabilityBlock, PlannerPlanSession } from '@planner/core';
export interface HelpRequest {
    id: string;
    title: string;
    description: string;
    subject: string;
    urgency: 'low' | 'med' | 'high';
    status: 'open' | 'claimed' | 'closed';
    createdAt: string;
    claimMode?: 'any' | 'teacher_only' | null;
    meetingAbout?: string | null;
    meetingLocation?: string | null;
    meetingLink?: string | null;
    proposedTimes?: string | null;
    claimedBy?: string | null;
    claimedByEmail?: string | null;
    claimedAt?: string | null;
    unclaimedAt?: string | null;
    unclaimedByEmail?: string | null;
    linkedAssignmentId?: string | null;
    closedAt?: string | null;
    createdByEmail?: string | null;
}
export interface HelpReport {
    id: string;
    requestId: string;
    reportedEmail: string;
    reason: 'spam' | 'trolling' | 'no_show' | 'other';
    details?: string | null;
    reportedByEmail: string;
    createdAt: string;
}
export interface ClaimBlocklistEntry {
    id: string;
    blockedEmail: string;
    blockedUntil: string;
    blockedByEmail: string;
    createdAt: string;
}
export interface RequestActivityEntry {
    type: 'created' | 'claimed' | 'unclaimed' | 'closed';
    at: string;
    byEmail?: string | null;
    label?: string | null;
}
export interface HelpComment {
    id: string;
    requestId: string;
    authorLabel: 'requester' | 'helper' | 'teacher' | 'other';
    authorDisplayName?: string | null;
    authorEmail?: string | null;
    body: string;
    createdAt: string;
}
export interface AssignmentSubmissionFile {
    id: string;
    submissionId: string;
    originalName: string;
    storedPath: string;
    mimeType: string | null;
    sizeBytes: number;
    createdAt: string;
}
export interface AssignmentSubmission {
    id: string;
    assignmentId: string;
    studentEmail: string;
    comment: string | null;
    links: string[];
    createdAt: string;
    updatedAt: string;
    files: AssignmentSubmissionFile[];
}
export interface HelpRequestResource {
    id: string;
    requestId: string;
    kind: 'link' | 'file';
    label: string | null;
    url: string | null;
    originalName: string | null;
    storedPath: string | null;
    mimeType: string | null;
    sizeBytes: number | null;
    note: string | null;
    createdAt: string;
    createdByEmail: string | null;
}
export interface RequestsSummaryRow {
    subject: string;
    urgency: string;
    status: string;
    count: number;
}
export declare function getDatabaseFilePath(): string;
export declare function getDb(): Database;
export declare function applyMigrations(): void;
export declare function initDb(): Database;
export interface DbHealthCheckResult {
    ok: boolean;
    dbFile: string;
    checkedAt: string;
}
export declare function runDbHealthCheck(): DbHealthCheckResult;
export declare function listAssignments(userEmail: string): Assignment[];
export declare function createAssignment(assignment: Assignment, userEmail: string): Assignment;
export declare function updateAssignmentCompletion(id: string, completed: boolean, userEmail: string): void;
export declare function deleteAssignment(id: string, userEmail: string): void;
export declare function listAvailabilityBlocks(userEmail: string): AvailabilityBlock[];
export declare function createAvailabilityBlock(block: AvailabilityBlock, userEmail: string): AvailabilityBlock;
export declare function deleteAvailabilityBlock(id: string, userEmail: string): void;
export interface Course {
    id: string;
    name: string;
    courseCode: string;
    teacherEmail: string;
    createdAt: string;
}
export interface CourseMember {
    courseId: string;
    studentEmail: string;
}
export interface CourseAssignment {
    id: string;
    courseId: string;
    title: string;
    description: string | null;
    dueAtMs: number | null;
    estMinutes: number;
    type: string;
    createdByEmail: string;
    createdAt: string;
}
export interface GradingTask {
    id: string;
    teacherEmail: string;
    title: string;
    dueAtMs: number | null;
    estMinutes: number;
    createdAt: string;
}
export interface CourseAnnouncement {
    id: string;
    courseId: string;
    title: string;
    body: string;
    createdByEmail: string;
    createdAt: string;
}
export type NotificationType = 'assignment_posted' | 'request_claimed' | 'request_unclaimed' | 'request_closed' | 'request_comment' | 'due_reminder_24h' | 'due_reminder_6h';
export interface NotificationRecord {
    id: string;
    userEmail: string;
    type: NotificationType;
    payload: Record<string, unknown> | null;
    dedupeKey: string | null;
    createdAt: string;
    readAt: string | null;
}
export interface CourseFeedbackSubmission {
    id: string;
    courseId: string;
    studentEmail: string;
    rating: number;
    comment: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface CourseFeedbackSummary {
    courseId: string;
    totalResponses: number;
    averageRating: number | null;
    ratingBreakdown: {
        rating: number;
        count: number;
    }[];
    recentComments: {
        rating: number;
        comment: string;
        createdAt: string;
    }[];
}
export interface DueReminderCandidate {
    assignmentId: string;
    courseId: string;
    courseName: string;
    title: string;
    dueAtMs: number;
    studentEmail: string;
}
export interface PlannerPreferences {
    userEmail: string;
    studyWindowStartMin: number;
    studyWindowEndMin: number;
    maxSessionMin: number;
    breakBetweenSessionsMin: number;
    avoidLateNight: boolean;
    coursePriorityWeights: Record<string, number>;
    updatedAt: string;
}
export declare function createCourse(course: Course): Course;
export declare function listCoursesByTeacher(teacherEmail: string): Course[];
export declare function getCourse(id: string): Course | null;
export declare function getCourseByCode(code: string): Course | null;
export declare function addCourseMember(courseId: string, studentEmail: string): void;
export declare function listCourseMembers(courseId: string): string[];
export declare function isStudentInCourse(courseId: string, studentEmail: string): boolean;
export declare function listCoursesByStudent(studentEmail: string): Course[];
export declare function createCourseAssignment(a: CourseAssignment): CourseAssignment;
export interface CourseAssignmentWithCourse extends CourseAssignment {
    courseName: string;
}
export declare function listCourseAssignmentsForStudent(studentEmail: string): CourseAssignmentWithCourse[];
export declare function listCourseAssignmentsByCourse(courseId: string): CourseAssignment[];
export declare function getCourseAssignment(id: string): CourseAssignment | null;
export declare function updateCourseAssignment(id: string, updates: {
    title?: string;
    description?: string | null;
    dueAtMs?: number | null;
    estMinutes?: number;
    type?: string;
}): CourseAssignment | null;
export declare function upsertAssignmentSubmission(input: {
    assignmentId: string;
    studentEmail: string;
    comment?: string | null;
    links?: string[];
}): AssignmentSubmission;
export declare function listAssignmentSubmissionFiles(submissionId: string): AssignmentSubmissionFile[];
export declare function addAssignmentSubmissionFile(input: {
    submissionId: string;
    originalName: string;
    storedPath: string;
    mimeType?: string | null;
    sizeBytes: number;
}): AssignmentSubmissionFile;
export declare function getAssignmentSubmissionById(id: string): AssignmentSubmission | null;
export declare function getAssignmentSubmissionByStudent(assignmentId: string, studentEmail: string): AssignmentSubmission | null;
export declare function listAssignmentSubmissionsByStudent(studentEmail: string): AssignmentSubmission[];
export declare function listAssignmentSubmissionsByAssignment(assignmentId: string): AssignmentSubmission[];
export declare function createCourseAnnouncement(announcement: CourseAnnouncement): CourseAnnouncement;
export declare function listCourseAnnouncementsByCourse(courseId: string): CourseAnnouncement[];
export declare function createGradingTask(task: GradingTask): GradingTask;
export declare function listGradingTasksByTeacher(teacherEmail: string): GradingTask[];
export declare function deleteGradingTask(id: string, teacherEmail: string): void;
export declare function getPlannerPreferences(userEmail: string): PlannerPreferences;
export declare function upsertPlannerPreferences(userEmail: string, update: {
    studyWindowStartMin: number;
    studyWindowEndMin: number;
    maxSessionMin: number;
    breakBetweenSessionsMin: number;
    avoidLateNight: boolean;
    coursePriorityWeights: Record<string, number>;
}): PlannerPreferences;
export declare function createNotification(input: {
    userEmail: string;
    type: NotificationType;
    payload?: Record<string, unknown> | null;
    dedupeKey?: string | null;
    createdAt?: string;
}): NotificationRecord | null;
export declare function listNotificationsByUser(userEmail: string, limit?: number): NotificationRecord[];
export declare function getUnreadNotificationCount(userEmail: string): number;
export declare function markNotificationRead(userEmail: string, notificationId: string): boolean;
export declare function markAllNotificationsRead(userEmail: string): number;
export declare function listCourseAssignmentDueReminderCandidates(minDueAtMs: number, maxDueAtMs: number): DueReminderCandidate[];
export declare function upsertCourseFeedback(courseId: string, studentEmail: string, rating: number, comment?: string | null): CourseFeedbackSubmission;
export declare function getCourseFeedbackByStudent(courseId: string, studentEmail: string): CourseFeedbackSubmission | null;
export declare function getCourseFeedbackSummary(courseId: string): CourseFeedbackSummary;
export declare function createHelpRequest(req: HelpRequest): HelpRequest;
export interface HelpRequestFilter {
    subject?: string;
    urgency?: 'low' | 'med' | 'high';
    status?: 'open' | 'claimed' | 'closed';
    excludeClosed?: boolean;
}
export declare function listHelpRequests(filter?: HelpRequestFilter): HelpRequest[];
export declare function listHelpRequestsVisibleTo(userEmail: string, isTeacher: boolean, filter?: HelpRequestFilter): HelpRequest[];
export declare function getHelpRequestById(id: string): HelpRequest | null;
export declare function claimHelpRequest(id: string, claimedBy: string, claimedByEmail: string): HelpRequest | null;
export declare function unclaimHelpRequest(id: string): HelpRequest | null;
export declare function closeHelpRequest(id: string): HelpRequest | null;
/**
 * Delete ALL closed requests (for dev/test when days=0).
 */
export declare function deleteAllClosedRequests(logger?: {
    info: (o: object, msg: string) => void;
}): {
    deletedRequests: number;
    deletedComments: number;
};
export declare function deleteClosedRequestsOlderThanDays(days: number, logger?: {
    info: (o: object, msg: string) => void;
}): {
    deletedRequests: number;
    deletedComments: number;
};
export declare function listCommentsForRequest(requestId: string): HelpComment[];
export declare function addComment(comment: HelpComment): HelpComment;
export declare function addHelpRequestResource(input: {
    requestId: string;
    kind: 'link' | 'file';
    label?: string | null;
    url?: string | null;
    originalName?: string | null;
    storedPath?: string | null;
    mimeType?: string | null;
    sizeBytes?: number | null;
    note?: string | null;
    createdByEmail?: string | null;
}): HelpRequestResource;
export declare function listHelpRequestResources(requestId: string): HelpRequestResource[];
export declare function countActiveClaimsByEmail(email: string): number;
export declare function countClaimsInLastHour(email: string): number;
export declare function recordClaimEvent(requestId: string, claimedByEmail: string): void;
export declare function isBlocked(email: string): boolean;
export declare function addBlocklistEntry(entry: ClaimBlocklistEntry): void;
export declare function listBlocklistEntries(): ClaimBlocklistEntry[];
export declare function createReport(report: HelpReport): HelpReport;
export declare function listReports(): {
    reports: HelpReport[];
    countsByReportedEmail: {
        reportedEmail: string;
        count: number;
    }[];
};
export declare function getRequestActivity(request: HelpRequest): RequestActivityEntry[];
export declare function getRequestsSummary(): RequestsSummaryRow[];
export declare function getInsightsStats(): {
    totalOpen: number;
    totalClaimed: number;
    totalClosed: number;
    topSubjectsByOpen: {
        subject: string;
        count: number;
    }[];
};
export type { PlannerPlanSession };

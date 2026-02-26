export type AssignmentType = 'homework' | 'quiz' | 'test' | 'project' | 'reading' | 'other';
export interface Assignment {
    id: string;
    course: string;
    title: string;
    dueAt?: number;
    estMinutes: number;
    priority: 1 | 2 | 3 | 4 | 5;
    type: AssignmentType;
    completed: boolean;
}
export interface AvailabilityBlock {
    id: string;
    startMin: number;
    endMin: number;
}
export interface PlannerPlanSession {
    assignmentId: string;
    startMin: number;
    endMin: number;
}
export interface PlanPreferences {
    preferredStudyWindow?: {
        startMin: number;
        endMin: number;
    };
    maxSessionMin?: number;
    breakBetweenSessionsMin?: number;
    avoidLateNight?: boolean;
    coursePriorityWeights?: Record<string, number>;
}
export interface PlanRequest {
    assignments: Assignment[];
    availability: AvailabilityBlock[];
    sessionMin?: number;
    now?: string;
    preferences?: PlanPreferences;
}
export interface PlanResult {
    sessions: PlannerPlanSession[];
    warnings: string[];
}

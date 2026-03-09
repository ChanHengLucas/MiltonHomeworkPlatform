export type AssignmentType = 'homework' | 'quiz' | 'test' | 'project' | 'reading' | 'other';

export interface Assignment {
  id: string;
  course: string;
  title: string;
  dueAt?: number; // epoch ms (Unix timestamp), optional for MVP
  estMinutes: number;
  priority: 1 | 2 | 3 | 4 | 5;
  type: AssignmentType;
  completed: boolean;
  optional?: boolean;
}

export interface AvailabilityBlock {
  id: string;
  startMin: number; // minutes since week start (Mon 00:00)
  endMin: number;
}

export interface PlannerPlanSession {
  assignmentId: string;
  startMin: number;
  endMin: number;
}

export interface PlanPreferences {
  preferredStudyWindow?: {
    startMin: number; // minutes from start of day (0-1439)
    endMin: number; // minutes from start of day (1-1440)
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
  now?: string; // ISO datetime used for urgency scoring
  preferences?: PlanPreferences;
}

export interface PlanResult {
  sessions: PlannerPlanSession[];
  warnings: string[];
}

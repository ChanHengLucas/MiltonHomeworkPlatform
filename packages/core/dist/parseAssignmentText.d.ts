import { AssignmentType } from './types';
export interface ParsedAssignmentDraft {
    title: string;
    estMinutes: number | null;
    type: AssignmentType;
}
export declare function parseAssignmentText(input: string): ParsedAssignmentDraft;

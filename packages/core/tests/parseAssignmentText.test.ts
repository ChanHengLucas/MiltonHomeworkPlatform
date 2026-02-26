import { describe, it, expect } from 'vitest';

import { parseAssignmentText } from '../src/parseAssignmentText';

describe('parseAssignmentText', () => {
  it('uses first line as title', () => {
    const input = 'Read Chapter 3\nDetails about the assignment';
    const result = parseAssignmentText(input);
    expect(result.title).toBe('Read Chapter 3');
  });

  it('parses hours into minutes', () => {
    const input = 'Project\nThis will take about 2 hours to complete.';
    const result = parseAssignmentText(input);
    expect(result.estMinutes).toBe(120);
  });

  it('parses minutes', () => {
    const input = 'Quiz 1\nEstimated time: 30 min';
    const result = parseAssignmentText(input);
    expect(result.estMinutes).toBe(30);
  });

  it('detects type by keyword', () => {
    const input = 'Midterm Exam\nFull midterm test on chapters 1-4';
    const result = parseAssignmentText(input);
    expect(result.type).toBe('test');
  });

  it('falls back to other when no keyword found', () => {
    const input = 'Reflection\nWrite a short reflection.';
    const result = parseAssignmentText(input);
    expect(result.type).toBe('other');
  });
});


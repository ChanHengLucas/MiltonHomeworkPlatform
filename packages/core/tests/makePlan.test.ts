import { describe, it, expect } from 'vitest';

import { makePlan } from '../src/makePlan';
import { Assignment, AvailabilityBlock } from '../src/types';

const baseAssignment: Omit<Assignment, 'id'> = {
  course: 'Math',
  title: 'Default',
  dueAt: undefined,
  estMinutes: 60,
  priority: 3,
  type: 'homework',
  completed: false
};

const mkAssignment = (id: string, overrides: Partial<Assignment> = {}): Assignment => ({
  id,
  ...baseAssignment,
  ...overrides
});

const mkAvailability = (id: string, startMin: number, endMin: number): AvailabilityBlock => ({
  id,
  startMin,
  endMin
});

describe('makePlan', () => {
  it('returns warning when no assignments', () => {
    const result = makePlan({
      assignments: [],
      availability: [mkAvailability('a1', 60, 120)],
      sessionMin: 30,
      now: '2024-01-01T00:00:00Z'
    });

    expect(result.sessions).toHaveLength(0);
    expect(result.warnings[0]).toMatch(/No pending assignments/i);
  });

  it('returns warning when no availability', () => {
    const result = makePlan({
      assignments: [mkAssignment('as1')],
      availability: [],
      sessionMin: 30,
      now: '2024-01-01T00:00:00Z'
    });

    expect(result.sessions).toHaveLength(0);
    expect(result.warnings[0]).toMatch(/No availability blocks/i);
  });

  it('allocates sessions greedily into availability slots', () => {
    const assignments = [
      mkAssignment('as1', { estMinutes: 60, priority: 5 }),
      mkAssignment('as2', { estMinutes: 30, priority: 1 })
    ];

    const availability = [mkAvailability('a1', 0, 120)];

    const result = makePlan({
      assignments,
      availability,
      sessionMin: 30,
      now: '2024-01-01T00:00:00Z'
    });

    // Total slots: 4 (0-30,30-60,60-90,90-120)
    expect(result.sessions).toHaveLength(3);
    const first = result.sessions[0];
    expect(first.assignmentId).toBe('as1');
    expect(first.startMin).toBe(0);
    expect(first.endMin).toBe(30);
  });

  it('adds warning when time is insufficient', () => {
    const assignments = [mkAssignment('as1', { estMinutes: 120 })];
    const availability = [mkAvailability('a1', 0, 60)];

    const result = makePlan({
      assignments,
      availability,
      sessionMin: 30,
      now: '2024-01-01T00:00:00Z'
    });

    expect(result.sessions).toHaveLength(2);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toMatch(/Insufficient time/i);
  });
});


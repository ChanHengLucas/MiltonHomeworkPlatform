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

  it('caps session length and inserts breaks when preferences are set', () => {
    const result = makePlan({
      assignments: [mkAssignment('as1', { estMinutes: 90 })],
      availability: [mkAvailability('a1', 0, 120)],
      sessionMin: 60,
      preferences: {
        maxSessionMin: 30,
        breakBetweenSessionsMin: 10,
      },
      now: '2024-01-01T00:00:00Z',
    });

    expect(result.sessions).toHaveLength(3);
    expect(result.sessions[0]).toMatchObject({ startMin: 0, endMin: 30 });
    expect(result.sessions[1]).toMatchObject({ startMin: 40, endMin: 70 });
    expect(result.warnings.some((w) => /capped/i.test(w))).toBeTruthy();
  });

  it('filters late-night time when avoidLateNight preference is enabled', () => {
    const result = makePlan({
      assignments: [mkAssignment('as1', { estMinutes: 180 })],
      availability: [mkAvailability('a1', 20 * 60, 23 * 60)],
      sessionMin: 30,
      preferences: {
        avoidLateNight: true,
      },
      now: '2024-01-01T00:00:00Z',
    });

    expect(result.sessions).toHaveLength(6);
    expect(result.sessions[result.sessions.length - 1]).toMatchObject({
      startMin: 22 * 60 + 30,
      endMin: 23 * 60,
    });
  });

  it('applies course priority weights deterministically', () => {
    const assignments = [
      mkAssignment('as1', {
        course: 'Math',
        title: 'Math worksheet',
        dueAt: new Date('2026-02-10T20:00:00Z').getTime(),
        estMinutes: 30,
      }),
      mkAssignment('as2', {
        course: 'History',
        title: 'History essay',
        dueAt: new Date('2026-02-10T20:00:00Z').getTime(),
        estMinutes: 30,
      }),
    ];
    const availability = [mkAvailability('a1', 0, 120)];

    const result = makePlan({
      assignments,
      availability,
      sessionMin: 30,
      preferences: {
        coursePriorityWeights: {
          history: 2,
        },
      },
      now: '2024-01-01T00:00:00Z',
    });

    expect(result.sessions[0].assignmentId).toBe('as2');
  });

  it('schedules required assignments before optional tasks', () => {
    const assignments = [
      mkAssignment('opt', { title: 'Optional reading', estMinutes: 60, optional: true }),
      mkAssignment('req', { title: 'Required worksheet', estMinutes: 30, optional: false }),
    ];
    const availability = [mkAvailability('a1', 0, 60)];

    const result = makePlan({
      assignments,
      availability,
      sessionMin: 30,
      now: '2024-01-01T00:00:00Z',
    });

    expect(result.sessions).toHaveLength(2);
    expect(result.sessions[0].assignmentId).toBe('req');
    expect(result.warnings.some((w) => w.includes('Optional task'))).toBeTruthy();
  });
});

import { Assignment } from './types';

export function computeUrgencyScore(assignment: Assignment, nowIso?: string): number {
  const now = nowIso ? new Date(nowIso) : new Date();

  let score = 0;

  // Priority carries strong weight
  score += assignment.priority * 3;

  // Size factor: larger tasks are slightly more urgent
  const sizeHours = assignment.estMinutes / 60;
  score += Math.min(sizeHours, 5); // cap impact

  // Due date factor: tasks due sooner are more urgent
  if (assignment.dueAt) {
    const due = new Date(assignment.dueAt);
    const msUntilDue = due.getTime() - now.getTime();
    const hoursUntilDue = msUntilDue / (1000 * 60 * 60);

    // Anything overdue or within next 24h gets a strong boost
    if (hoursUntilDue <= 0) {
      score += 10;
    } else if (hoursUntilDue <= 24) {
      score += 8;
    } else if (hoursUntilDue <= 72) {
      score += 5;
    } else if (hoursUntilDue <= 168) {
      // within a week
      score += 2;
    }
  }

  return score;
}


import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

import { api, type PlanResult, type Assignment } from '../api';
import { useAppState } from '../context/AppContext';
import { Button, Card, Callout } from '../components/ui';
import { formatDueDate } from '../utils/datetime';

const MINUTES_PER_DAY = 24 * 60;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatSession(startMin: number, endMin: number): string {
  const h = Math.floor((startMin % MINUTES_PER_DAY) / 60);
  const m = startMin % 60;
  const eh = Math.floor((endMin % MINUTES_PER_DAY) / 60);
  const em = endMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}–${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
}

function getDuration(startMin: number, endMin: number): number {
  return endMin - startMin;
}

export function PlanPage() {
  const { calendarBusyBlocks, calendarBusyUpdatedAt } = useAppState();
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionMin, setSessionMin] = useState(30);

  useEffect(() => {
    loadAssignments();
  }, []);

  async function loadAssignments() {
    try {
      const list = await api.listAssignments();
      setAssignments(list);
    } catch {
      // ignore
    }
  }

  async function handleGenerate() {
    try {
      setLoading(true);
      setError(null);
      const busyBlocks = calendarBusyBlocks.length > 0
        ? calendarBusyBlocks.map((b) => ({ startMs: b.startMs, endMs: b.endMs }))
        : undefined;
      console.log('[Plan] Generating plan', { sessionMin, busyCount: busyBlocks?.length ?? 0 });
      const result = await api.createPlan(sessionMin, undefined, busyBlocks);
      setPlan(result);
      await loadAssignments();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to generate plan';
      setError(msg);
      setPlan(null);
      console.error('[Planner] [API]', msg);
    } finally {
      setLoading(false);
    }
  }

  const assignmentMap = new Map(assignments.map((a) => [a.id, a]));
  const todayIndex = (new Date().getDay() + 6) % 7;

  const sessionsByDay = (plan?.sessions ?? []).reduce(
    (acc, s) => {
      const dayIndex = Math.floor(s.startMin / MINUTES_PER_DAY);
      if (!acc[dayIndex]) acc[dayIndex] = [];
      acc[dayIndex].push(s);
      return acc;
    },
    {} as Record<number, { assignmentId: string; startMin: number; endMin: number }[]>,
  );

  const overloadWarning = plan?.warnings.find((w) => w.includes('Insufficient time for')) ?? null;
  const overloadTitleMatch = overloadWarning?.match(/"(.+?)"/);
  const overloadTitle = overloadTitleMatch?.[1] ?? null;
  const overloadAssignment = overloadTitle
    ? assignments.find((assignment) => assignment.title === overloadTitle) ?? null
    : null;
  const extensionMailto = overloadAssignment
    ? (() => {
      const subject = `Extension request: ${overloadAssignment.title}`;
      const due = overloadAssignment.dueAt ? formatDueDate(overloadAssignment.dueAt) : 'No due date listed';
      const body = [
        'Hello,',
        '',
        `I am requesting an extension for "${overloadAssignment.title}" in ${overloadAssignment.course}.`,
        `Current due date: ${due}.`,
        '',
        'Reason:',
        '- My current planner shows an overload this week and not enough available study time.',
        '- I have already started the assignment and need additional time to complete quality work.',
        '',
        'Requested new due date:',
        '[Please suggest date]',
        '',
        'Thank you,',
        '[Your name]',
      ].join('\n');
      const params = new URLSearchParams({ subject, body });
      return `mailto:?${params.toString()}`;
    })()
    : null;

  return (
    <div className="page">
      <h1 className="page-title">Plan</h1>
      <div className="plan-primary">
        <div className="form-group" style={{ display: 'inline-block', marginRight: '1rem', marginBottom: 0 }}>
          <label>Session length (min)</label>
          <input
            type="number"
            min={5}
            max={120}
            className="ui-input"
            value={sessionMin}
            onChange={(e) => setSessionMin(parseInt(e.target.value, 10) || 30)}
            style={{ width: 80 }}
          />
          <small className="form-hint">Length of each study block (5–120). Default 30.</small>
        </div>
        <Button onClick={handleGenerate} disabled={loading}>
          {loading ? 'Generating…' : 'Generate Plan'}
        </Button>
      </div>
      <p className="form-hint" style={{ marginTop: 0, marginBottom: '0.25rem' }}>
        {calendarBusyBlocks.length > 0
          ? `Using ${calendarBusyBlocks.length} imported Google Calendar busy blocks${calendarBusyUpdatedAt ? ` (synced ${new Date(calendarBusyUpdatedAt).toLocaleTimeString()})` : ''}.`
          : 'No calendar busy blocks imported yet.'}{' '}
        <Link to="/availability" className="link">Import in Availability</Link>.
      </p>

      {error && (
        <Callout variant="error" onRetry={handleGenerate}>
          {error}
        </Callout>
      )}

      {plan && (
        <Card>
          {plan.warnings.length > 0 && (
            <div className="callout-warn-simple" style={{ marginBottom: '1rem' }}>
              {plan.warnings.map((w, i) => (
                <p key={i}>{w}</p>
              ))}
              {extensionMailto && (
                <p style={{ marginTop: '0.85rem' }}>
                  <a className="link" href={extensionMailto}>
                    Request extension email draft
                  </a>
                </p>
              )}
            </div>
          )}
          {plan.sessions.length === 0 ? (
            <p className="empty-state">
              {plan.warnings.some((w) => w.includes('availability'))
                ? 'Add availability blocks to generate a plan.'
                : 'Add assignments and availability first, then generate a plan.'}
            </p>
          ) : (
            <div className="plan-by-day">
              {Object.entries(sessionsByDay)
                .sort(([a], [b]) => parseInt(a, 10) - parseInt(b, 10))
                .map(([dayStr, sess]) => {
                  const day = parseInt(dayStr, 10);
                  const isToday = day === todayIndex;
                  return (
                    <div key={day} className="plan-day-group">
                      <h3 className={`plan-day-title ${isToday ? 'today' : ''}`}>
                        {isToday ? 'Today' : DAYS[day]}
                      </h3>
                      {sess.map(({ assignmentId, startMin, endMin }) => {
                        const a = assignmentMap.get(assignmentId);
                        const duration = getDuration(startMin, endMin);
                        return (
                          <div key={`${assignmentId}-${startMin}`} className="plan-session-card">
                            <div className="plan-session-title">{a?.title ?? assignmentId}</div>
                            <div className="plan-session-meta">
                              {duration} min · {formatSession(startMin, endMin)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

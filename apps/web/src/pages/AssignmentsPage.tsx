import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { api, type Assignment, type CourseAssignment } from '../api';
import { Button, Card, Callout } from '../components/ui';
import { fromDateTimeLocalValue, formatDueDate } from '../utils/datetime';

const PRIORITY_OPTIONS = [
  { value: 1, label: 'Low' },
  { value: 2, label: 'Low' },
  { value: 3, label: 'Medium' },
  { value: 4, label: 'High' },
  { value: 5, label: 'High' },
];

export function AssignmentsPage() {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [teacherAssignments, setTeacherAssignments] = useState<CourseAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [parseText, setParseText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [confirmForm, setConfirmForm] = useState({
    course: '',
    title: '',
    dueAt: '', // datetime-local string or ''
    estMinutes: '' as string | number,
    priority: 3,
    type: 'homework',
  });

  const courses = [...new Set(assignments.map((a) => a.course).filter(Boolean))].sort();
  const addAssignmentFormId = 'add-assignment-form';

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const [personal, fromTeachers] = await Promise.all([
        api.listAssignments(),
        api.listStudentAssignments().catch(() => []),
      ]);
      setAssignments(personal);
      setTeacherAssignments(fromTeachers);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load assignments';
      setError(msg);
      console.error('[Planner] [API]', msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleParse() {
    if (!parseText.trim()) return;
    try {
      setParsing(true);
      setError(null);
      const result = await api.parseAssignmentText(parseText);
      setConfirmForm((f) => ({
        ...f,
        title: result.title,
        estMinutes: result.estMinutes ?? 30,
        type: result.type,
        course: courses[0] ?? '',
      }));
      console.log('[Planner][API] Parsed assignment', result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to parse';
      setError(msg);
      console.error('[Planner] [API]', msg);
    } finally {
      setParsing(false);
    }
  }

  async function handleSave(genPlan: boolean) {
    if (!confirmForm.course.trim() || !confirmForm.title.trim()) {
      setError('Course and title are required');
      return;
    }
    const est = typeof confirmForm.estMinutes === 'string'
      ? parseInt(confirmForm.estMinutes, 10)
      : confirmForm.estMinutes;
    if (Number.isNaN(est) || est < 5) {
      setError('Estimated time must be at least 5 minutes');
      return;
    }
    try {
      setError(null);
      const dueAtRaw = fromDateTimeLocalValue(confirmForm.dueAt);
      const dueAt = Number.isNaN(dueAtRaw) || dueAtRaw <= 0 ? undefined : dueAtRaw;
      await api.createAssignment({
        course: confirmForm.course.trim(),
        title: confirmForm.title.trim(),
        dueAt,
        estMinutes: est,
        priority: confirmForm.priority as 1 | 2 | 3 | 4 | 5,
        type: confirmForm.type,
      });
      console.log('[Planner][API] Created assignment');
      setConfirmForm({ course: '', title: '', dueAt: '', estMinutes: 30 as const, priority: 3, type: 'homework' });
      setParseText('');
      await load();
      if (genPlan) navigate('/plan');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to save';
      setError(msg);
      console.error('[Planner] [API]', msg);
    }
  }

  async function handleToggleComplete(a: Assignment) {
    try {
      await api.updateAssignment(a.id, !a.completed);
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to update';
      setError(msg);
      console.error('[Planner] [API]', msg);
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.deleteAssignment(id);
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to delete';
      setError(msg);
      console.error('[Planner] [API]', msg);
    }
  }

  return (
    <div className="page">
      <h1 className="page-title">Assignments</h1>
      <p className="page-subtitle">Track personal assignments and teacher-published work in one place.</p>

      <Card>
        <div className="split-header">
          <div>
            <h2 className="section-title" style={{ marginBottom: '0.25rem' }}>Quick add</h2>
            <p className="form-hint" style={{ margin: 0 }}>Paste assignment text or fill the form manually.</p>
          </div>
          <Button
            onClick={() => {
              document.getElementById(addAssignmentFormId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          >
            Add assignment
          </Button>
        </div>
      </Card>

      <Card>
        <h2 className="section-title">Paste assignment</h2>
        <textarea
          className="ui-textarea"
          placeholder="Paste from Schoology, email, or syllabus..."
          value={parseText}
          onChange={(e) => setParseText(e.target.value)}
          style={{ minHeight: 100 }}
        />
        <Button onClick={handleParse} disabled={parsing || !parseText.trim()}>
          {parsing ? 'Parsing…' : 'Parse'}
        </Button>
      </Card>

      <Card>
        <h2 className="section-title" id={addAssignmentFormId}>Personal assignment details</h2>
        <div className="form-grid">
          <div className="form-group">
            <label>Title</label>
            <input
              className="ui-input"
              value={confirmForm.title}
              onChange={(e) => setConfirmForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Assignment title"
            />
          </div>
          <div className="form-group">
            <label>Course</label>
            <input
              className="ui-input"
              value={confirmForm.course}
              onChange={(e) => setConfirmForm((f) => ({ ...f, course: e.target.value }))}
              placeholder="e.g. Math 101"
              list="course-list"
            />
            <datalist id="course-list">
              {courses.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="form-group">
            <label>Due datetime</label>
            <input
              type="datetime-local"
              className="ui-input"
              value={confirmForm.dueAt}
              onChange={(e) =>
                setConfirmForm((f) => ({
                  ...f,
                  dueAt: e.target.value || '',
                }))
              }
            />
          </div>
          <div className="form-group">
            <label>Estimated minutes</label>
            <input
              type="number"
              min={1}
              className="ui-input"
              placeholder="e.g. 30"
              value={confirmForm.estMinutes}
              onChange={(e) =>
                setConfirmForm((f) => ({
                  ...f,
                  estMinutes: e.target.value === '' ? '' : parseInt(e.target.value, 10) || 0,
                }))
              }
            />
            {(confirmForm.estMinutes === '' || (typeof confirmForm.estMinutes === 'number' && confirmForm.estMinutes < 5)) && (
              <small className="form-hint">Minimum 5 minutes required</small>
            )}
          </div>
          <div className="form-group">
            <label>Priority</label>
            <select
              className="ui-select"
              value={confirmForm.priority}
              onChange={(e) => setConfirmForm((f) => ({ ...f, priority: parseInt(e.target.value, 10) }))}
            >
              {PRIORITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        <Button onClick={() => handleSave(false)}>Add assignment</Button>
      </Card>

      {error && (
        <Callout variant="error" onRetry={load}>
          {error}
        </Callout>
      )}

      <Card>
        <div className="split-header">
          <h2 className="section-title" style={{ marginBottom: 0 }}>From teachers</h2>
          <span className="form-hint">Read-only assignments shared from your enrolled courses.</span>
        </div>
        {teacherAssignments.length === 0 ? (
          <p className="empty-state" style={{ marginTop: '0.75rem' }}>
            Nothing published yet. Your teacher assignments will appear here.
          </p>
        ) : (
          <div className="assignment-list" style={{ marginTop: '0.75rem' }}>
            {teacherAssignments.map((a) => (
              <div key={a.id} className="assignment-card">
                <div className="assignment-card-content">
                  <div className="assignment-card-title">{a.title}</div>
                  <div className="assignment-card-meta">
                    {a.courseName ?? a.courseId} · {a.estMinutes} min
                    {a.dueAtMs
                      ? ` · Due ${formatDueDate(a.dueAtMs)}`
                      : ' · No due date'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div className="split-header">
          <h2 className="section-title" style={{ marginBottom: 0 }}>Personal assignments</h2>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              document.getElementById(addAssignmentFormId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          >
            Add assignment
          </Button>
        </div>
        {loading ? (
          <p>Loading…</p>
        ) : assignments.length === 0 ? (
          <p className="empty-state" style={{ marginTop: '0.75rem' }}>
            No personal assignments yet. Use "Add assignment" to create your first one.
          </p>
        ) : (
          <div className="assignment-list" style={{ marginTop: '0.75rem' }}>
            {assignments.map((a) => (
              <div
                key={a.id}
                className={`assignment-card ${a.completed ? 'completed' : ''}`}
              >
                <div className="assignment-card-content">
                  <div className="assignment-card-title">{a.title}</div>
                  <div className="assignment-card-meta">
                    {a.course} · {a.estMinutes} min · {a.type}
                    {formatDueDate(a.dueAt) === 'No due date'
                      ? ' · No due date'
                      : ` · Due ${formatDueDate(a.dueAt)}`}
                  </div>
                </div>
                <div className="assignment-card-actions">
                  <Button variant="secondary" size="sm" onClick={() => handleToggleComplete(a)}>
                    {a.completed ? 'Undo' : 'Done'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      navigate(
                        `/support?new=true&title=${encodeURIComponent('Help with: ' + a.title)}&linkedAssignmentId=${a.id}`,
                      )
                    }
                  >
                    Need help
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => handleDelete(a.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

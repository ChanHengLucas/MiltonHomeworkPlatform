import { useState, useEffect } from 'react';
import { api, type CourseAssignment, type GradingTask } from '../api';
import { Button, Card, Callout } from '../components/ui';
import { fromDateTimeLocalValue, formatDueDate } from '../utils/datetime';

interface Course {
  id: string;
  name: string;
  teacherEmail: string;
  createdAt: string;
}

export function TeacherDashboardPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [gradingTasks, setGradingTasks] = useState<GradingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newCourseName, setNewCourseName] = useState('');
  const [inviteEmails, setInviteEmails] = useState<Record<string, string>>({});
  const [assignForm, setAssignForm] = useState<Record<string, { courseId: string; title: string; dueAt: string; estMinutes: string; type: string }>>({});
  const [newGradingTitle, setNewGradingTitle] = useState('');
  const [newGradingDueAt, setNewGradingDueAt] = useState('');
  const [newGradingEst, setNewGradingEst] = useState('60');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const [c, g] = await Promise.all([
        api.listTeacherCourses(),
        api.listGradingTasks(),
      ]);
      setCourses(c);
      setGradingTasks(g);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateCourse() {
    if (!newCourseName.trim()) return;
    try {
      setError(null);
      await api.createTeacherCourse(newCourseName.trim());
      setNewCourseName('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create course');
    }
  }

  async function handleInvite(courseId: string) {
    const raw = inviteEmails[courseId]?.trim();
    if (!raw) return;
    const emails = raw.split(/[\s,;]+/).filter(Boolean);
    if (emails.length === 0) return;
    try {
      setError(null);
      await api.inviteToCourse(courseId, emails);
      setInviteEmails((prev) => ({ ...prev, [courseId]: '' }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to invite');
    }
  }

  async function handlePublishAssignment(courseId: string) {
    const form = assignForm[courseId];
    if (!form?.title.trim()) return;
    const est = parseInt(form.estMinutes, 10);
    if (Number.isNaN(est) || est < 5) return;
    try {
      setError(null);
      const dueAtRaw = fromDateTimeLocalValue(form.dueAt);
      const dueAtMs = Number.isFinite(dueAtRaw) && dueAtRaw > 0 ? dueAtRaw : null;
      await api.createTeacherAssignment({
        courseId,
        title: form.title.trim(),
        dueAtMs,
        estMinutes: est,
        type: form.type || 'homework',
      });
      setAssignForm((prev) => ({ ...prev, [courseId]: { courseId, title: '', dueAt: '', estMinutes: '30', type: 'homework' } }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to publish');
    }
  }

  async function handleCreateGradingTask() {
    if (!newGradingTitle.trim()) return;
    const est = parseInt(newGradingEst, 10);
    if (Number.isNaN(est) || est < 5) return;
    try {
      setError(null);
      const dueAtRaw = fromDateTimeLocalValue(newGradingDueAt);
      const dueAtMs = Number.isFinite(dueAtRaw) && dueAtRaw > 0 ? dueAtRaw : null;
      await api.createGradingTask({
        title: newGradingTitle.trim(),
        dueAtMs,
        estMinutes: est,
      });
      setNewGradingTitle('');
      setNewGradingDueAt('');
      setNewGradingEst('60');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create grading task');
    }
  }

  async function handleDeleteGrading(id: string) {
    try {
      await api.deleteGradingTask(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  }

  const [courseAssignments, setCourseAssignments] = useState<Record<string, CourseAssignment[]>>({});
  useEffect(() => {
    if (courses.length === 0) return;
    Promise.all(courses.map((c) => api.listCourseAssignments(c.id)))
      .then((lists) => {
        const map: Record<string, CourseAssignment[]> = {};
        courses.forEach((c, i) => {
          map[c.id] = lists[i] ?? [];
        });
        setCourseAssignments(map);
      })
      .catch(() => {});
  }, [courses]);

  return (
    <div className="page">
      <h1 className="page-title">Teacher Dashboard</h1>
      <p className="page-subtitle">Create courses, invite students, publish assignments, and manage grading tasks.</p>

      {error && (
        <Callout variant="error" onRetry={load}>
          {error}
        </Callout>
      )}

      <Card>
        <h2 className="section-title">Create course</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            className="ui-input"
            placeholder="Course name"
            value={newCourseName}
            onChange={(e) => setNewCourseName(e.target.value)}
            style={{ flex: 1, maxWidth: 240 }}
          />
          <Button onClick={handleCreateCourse} disabled={!newCourseName.trim()}>
            Create
          </Button>
        </div>
      </Card>

      {courses.length > 0 && (
        <Card>
          <h2 className="section-title">Courses</h2>
          {loading ? (
            <p>Loading…</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {courses.map((c) => (
                <div key={c.id} className="card-inner" style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: '1rem' }}>
                  <h3 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem' }}>{c.name}</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <input
                      className="ui-input"
                      placeholder="Student emails (comma-separated)"
                      value={inviteEmails[c.id] ?? ''}
                      onChange={(e) => setInviteEmails((prev) => ({ ...prev, [c.id]: e.target.value }))}
                      style={{ flex: 1, minWidth: 200, maxWidth: 320 }}
                    />
                    <Button variant="secondary" size="sm" onClick={() => handleInvite(c.id)}>
                      Invite
                    </Button>
                  </div>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <strong>Publish assignment</strong>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
                      <input
                        className="ui-input"
                        placeholder="Title"
                        value={assignForm[c.id]?.title ?? ''}
                        onChange={(e) =>
                          setAssignForm((prev) => ({
                            ...prev,
                            [c.id]: { ...(prev[c.id] ?? { courseId: c.id, title: '', dueAt: '', estMinutes: '30', type: 'homework' }), title: e.target.value },
                          }))
                        }
                        style={{ minWidth: 140 }}
                      />
                      <input
                        type="datetime-local"
                        className="ui-input"
                        placeholder="Due"
                        value={assignForm[c.id]?.dueAt ?? ''}
                        onChange={(e) =>
                          setAssignForm((prev) => ({
                            ...prev,
                            [c.id]: { ...(prev[c.id] ?? { courseId: c.id, title: '', dueAt: '', estMinutes: '30', type: 'homework' }), dueAt: e.target.value },
                          }))
                        }
                        style={{ minWidth: 180 }}
                      />
                      <input
                        type="number"
                        min={5}
                        className="ui-input"
                        placeholder="Est min"
                        value={assignForm[c.id]?.estMinutes ?? '30'}
                        onChange={(e) =>
                          setAssignForm((prev) => ({
                            ...prev,
                            [c.id]: { ...(prev[c.id] ?? { courseId: c.id, title: '', dueAt: '', estMinutes: '30', type: 'homework' }), estMinutes: e.target.value },
                          }))
                        }
                        style={{ width: 80 }}
                      />
                      <select
                        className="ui-select"
                        value={assignForm[c.id]?.type ?? 'homework'}
                        onChange={(e) =>
                          setAssignForm((prev) => ({
                            ...prev,
                            [c.id]: { ...(prev[c.id] ?? { courseId: c.id, title: '', dueAt: '', estMinutes: '30', type: 'homework' }), type: e.target.value },
                          }))
                        }
                        style={{ width: 110 }}
                      >
                        <option value="homework">Homework</option>
                        <option value="quiz">Quiz</option>
                        <option value="test">Test</option>
                        <option value="project">Project</option>
                        <option value="reading">Reading</option>
                        <option value="other">Other</option>
                      </select>
                      <Button size="sm" onClick={() => handlePublishAssignment(c.id)}>
                        Publish
                      </Button>
                    </div>
                  </div>
                  {(courseAssignments[c.id]?.length ?? 0) > 0 && (
                    <div style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
                      Published: {courseAssignments[c.id].map((a) => a.title).join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Card>
        <h2 className="section-title">Grading tasks</h2>
        <p className="page-subtitle" style={{ marginBottom: '0.75rem' }}>
          Add grading tasks for your plan. They appear in Plan alongside your assignments.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '1rem' }}>
          <input
            className="ui-input"
            placeholder="Task title"
            value={newGradingTitle}
            onChange={(e) => setNewGradingTitle(e.target.value)}
            style={{ minWidth: 160 }}
          />
          <input
            type="datetime-local"
            className="ui-input"
            placeholder="Due"
            value={newGradingDueAt}
            onChange={(e) => setNewGradingDueAt(e.target.value)}
            style={{ minWidth: 180 }}
          />
          <input
            type="number"
            min={5}
            className="ui-input"
            placeholder="Est min"
            value={newGradingEst}
            onChange={(e) => setNewGradingEst(e.target.value)}
            style={{ width: 80 }}
          />
          <Button onClick={handleCreateGradingTask} disabled={!newGradingTitle.trim()}>
            Add grading task
          </Button>
        </div>
        {gradingTasks.length > 0 ? (
          <div className="assignment-list">
            {gradingTasks.map((t) => (
              <div key={t.id} className="assignment-card">
                <div className="assignment-card-content">
                  <div className="assignment-card-title">{t.title}</div>
                  <div className="assignment-card-meta">
                    {t.estMinutes} min
                    {t.dueAtMs ? ` · Due ${formatDueDate(t.dueAtMs)}` : ' · No due date'}
                  </div>
                </div>
                <Button variant="danger" size="sm" onClick={() => handleDeleteGrading(t.id)}>
                  Delete
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-state">No grading tasks yet.</p>
        )}
      </Card>
    </div>
  );
}

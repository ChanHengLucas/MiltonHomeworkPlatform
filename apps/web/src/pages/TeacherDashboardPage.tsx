import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  api,
  type AssignmentSubmission,
  type CourseAssignment,
  type GradingTask,
  type PlannerCourse,
} from '../api';
import { useAppState } from '../context/AppContext';
import { Button, Card, Callout } from '../components/ui';
import { useAuthGate } from '../hooks/useAuthGate';
import { fromDateTimeLocalValue, formatDueDate, toDateTimeLocalValue } from '../utils/datetime';

interface PublishForm {
  courseId: string;
  title: string;
  description: string;
  dueAt: string;
  estMinutes: string;
  type: string;
}

interface EditAssignmentForm {
  title: string;
  description: string;
  dueAt: string;
  estMinutes: string;
  type: string;
}

function defaultDueAtLocal(): string {
  const due = new Date();
  due.setDate(due.getDate() + 2);
  due.setHours(17, 0, 0, 0);
  return toDateTimeLocalValue(due.getTime());
}

function defaultPublishForm(courseId: string): PublishForm {
  return {
    courseId,
    title: '',
    description: '',
    dueAt: defaultDueAtLocal(),
    estMinutes: '45',
    type: 'homework',
  };
}

function defaultEditAssignmentForm(assignment: CourseAssignment): EditAssignmentForm {
  return {
    title: assignment.title,
    description: assignment.description ?? '',
    dueAt: assignment.dueAtMs ? toDateTimeLocalValue(assignment.dueAtMs) : '',
    estMinutes: String(assignment.estMinutes),
    type: assignment.type || 'homework',
  };
}

export function TeacherDashboardPage() {
  const { teacherEligible } = useAppState();
  const { isSignedIn } = useAuthGate();
  const [courses, setCourses] = useState<PlannerCourse[]>([]);
  const [courseMembers, setCourseMembers] = useState<Record<string, string[]>>({});
  const [courseAssignments, setCourseAssignments] = useState<Record<string, CourseAssignment[]>>({});
  const [assignmentSubmissions, setAssignmentSubmissions] = useState<Record<string, AssignmentSubmission[]>>({});
  const [activeSubmissionAssignmentId, setActiveSubmissionAssignmentId] = useState<string | null>(null);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [editAssignmentForms, setEditAssignmentForms] = useState<Record<string, EditAssignmentForm>>({});
  const [gradingTasks, setGradingTasks] = useState<GradingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newCourseName, setNewCourseName] = useState('');
  const [inviteEmails, setInviteEmails] = useState<Record<string, string>>({});
  const [assignForm, setAssignForm] = useState<Record<string, PublishForm>>({});
  const [newGradingTitle, setNewGradingTitle] = useState('');
  const [newGradingDueAt, setNewGradingDueAt] = useState(defaultDueAtLocal());
  const [newGradingEst, setNewGradingEst] = useState('60');

  useEffect(() => {
    if (!isSignedIn) {
      setLoading(false);
      setCourses([]);
      setCourseAssignments({});
      setCourseMembers({});
      setAssignmentSubmissions({});
      setActiveSubmissionAssignmentId(null);
      setEditingAssignmentId(null);
      setGradingTasks([]);
      setError(null);
      return;
    }
    load();
  }, [isSignedIn]);

  async function load() {
    if (!isSignedIn) return;
    try {
      setLoading(true);
      setError(null);
      const [fetchedCourses, fetchedGrading] = await Promise.all([
        api.listTeacherCourses(),
        api.listGradingTasks(),
      ]);
      setCourses(fetchedCourses);
      setGradingTasks(fetchedGrading);
      setAssignForm((prev) => {
        const next = { ...prev };
        for (const course of fetchedCourses) {
          if (!next[course.id]) next[course.id] = defaultPublishForm(course.id);
        }
        return next;
      });
      setActiveSubmissionAssignmentId(null);
      setEditingAssignmentId(null);
      setAssignmentSubmissions({});
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isSignedIn) return;
    if (courses.length === 0) {
      setCourseAssignments({});
      setCourseMembers({});
      return;
    }
    Promise.all(courses.map((course) => api.listCourseAssignments(course.id)))
      .then((lists) => {
        const map: Record<string, CourseAssignment[]> = {};
        courses.forEach((course, i) => {
          map[course.id] = lists[i] ?? [];
        });
        setCourseAssignments(map);
        setEditAssignmentForms((prev) => {
          const next = { ...prev };
          Object.values(map).forEach((items) => {
            items.forEach((assignment) => {
              if (!next[assignment.id]) {
                next[assignment.id] = defaultEditAssignmentForm(assignment);
              }
            });
          });
          return next;
        });
      })
      .catch(() => {
        setCourseAssignments({});
      });

    Promise.all(courses.map((course) => api.listCourseMembers(course.id)))
      .then((lists) => {
        const map: Record<string, string[]> = {};
        courses.forEach((course, i) => {
          map[course.id] = lists[i]?.members ?? [];
        });
        setCourseMembers(map);
      })
      .catch(() => {
        setCourseMembers({});
      });
  }, [courses, isSignedIn]);

  async function handleCreateCourse() {
    if (!isSignedIn) return;
    if (!newCourseName.trim()) {
      setError('Course name is required.');
      return;
    }
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
    if (!isSignedIn) return;
    const raw = inviteEmails[courseId]?.trim();
    if (!raw) {
      setError('Enter at least one student email to invite.');
      return;
    }
    const emails = raw.split(/[\s,;]+/).filter(Boolean);
    if (emails.length === 0) {
      setError('Enter at least one valid student email.');
      return;
    }
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
    if (!isSignedIn) return;
    const form = assignForm[courseId] ?? defaultPublishForm(courseId);
    if (!form.title.trim()) {
      setError('Assignment title is required.');
      return;
    }
    const est = parseInt(form.estMinutes, 10);
    if (Number.isNaN(est) || est < 5) {
      setError('Estimated minutes must be at least 5.');
      return;
    }
    try {
      setError(null);
      const dueAtRaw = fromDateTimeLocalValue(form.dueAt);
      const dueAtMs = Number.isFinite(dueAtRaw) && dueAtRaw > 0 ? dueAtRaw : null;
      await api.createTeacherAssignment({
        courseId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        dueAtMs,
        estMinutes: est,
        type: form.type || 'homework',
      });
      setAssignForm((prev) => ({ ...prev, [courseId]: defaultPublishForm(courseId) }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to publish');
    }
  }

  async function handleSaveAssignmentEdit(assignmentId: string) {
    if (!isSignedIn) return;
    const form = editAssignmentForms[assignmentId];
    if (!form) return;
    if (!form.title.trim()) {
      setError('Assignment title is required.');
      return;
    }
    const est = parseInt(form.estMinutes, 10);
    if (Number.isNaN(est) || est < 5) {
      setError('Estimated minutes must be at least 5.');
      return;
    }
    try {
      setError(null);
      const dueAtRaw = fromDateTimeLocalValue(form.dueAt);
      const dueAtMs = Number.isFinite(dueAtRaw) && dueAtRaw > 0 ? dueAtRaw : null;
      await api.updateTeacherAssignment(assignmentId, {
        title: form.title.trim(),
        description: form.description.trim() || null,
        dueAtMs,
        estMinutes: est,
        type: form.type || 'homework',
      });
      setEditingAssignmentId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update assignment');
    }
  }

  async function handleToggleSubmissions(assignmentId: string) {
    if (!isSignedIn) return;
    if (activeSubmissionAssignmentId === assignmentId) {
      setActiveSubmissionAssignmentId(null);
      return;
    }
    try {
      setError(null);
      const result = await api.listTeacherAssignmentSubmissions(assignmentId);
      setAssignmentSubmissions((prev) => ({ ...prev, [assignmentId]: result.submissions }));
      setActiveSubmissionAssignmentId(assignmentId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load submissions');
    }
  }

  async function handleCreateGradingTask() {
    if (!isSignedIn) return;
    if (!newGradingTitle.trim()) {
      setError('Grading task title is required.');
      return;
    }
    const est = parseInt(newGradingEst, 10);
    if (Number.isNaN(est) || est < 5) {
      setError('Grading task estimate must be at least 5 minutes.');
      return;
    }
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
      setNewGradingDueAt(defaultDueAtLocal());
      setNewGradingEst('60');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create grading task');
    }
  }

  async function handleDeleteGrading(id: string) {
    if (!isSignedIn) return;
    try {
      await api.deleteGradingTask(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  }

  if (!teacherEligible) {
    return (
      <div className="page">
        <h1 className="page-title">Teacher dashboard only</h1>
        <p className="page-subtitle">This page is available to teacher and staff accounts only.</p>
        <p style={{ marginTop: '1rem' }}>
          <Link to="/assignments" className="link">← Back to Assignments</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="page-title">Teacher Dashboard</h1>
      <p className="page-subtitle">Create courses, invite students, and publish assignments with clear defaults.</p>

      {error && (
        <Callout variant="error" onRetry={load}>
          {error}
        </Callout>
      )}

      <Card>
        <h2 className="section-title">Create course</h2>
        <div className="form-actions">
          <input
            className="ui-input"
            placeholder="Course name (e.g. Algebra II)"
            value={newCourseName}
            onChange={(e) => setNewCourseName(e.target.value)}
            style={{ maxWidth: 360 }}
          />
          <Button onClick={handleCreateCourse} disabled={!newCourseName.trim()}>
            Create course
          </Button>
        </div>
      </Card>

      {courses.length > 0 && (
        <Card>
          <div className="split-header">
            <h2 className="section-title" style={{ marginBottom: 0 }}>Courses</h2>
            <span className="form-hint">{courses.length} total</span>
          </div>
          {loading ? (
            <p style={{ marginTop: '0.75rem' }}>Loading…</p>
          ) : (
            <div className="teacher-course-grid" style={{ marginTop: '0.85rem' }}>
              {courses.map((course) => (
                <div key={course.id} className="teacher-course-card">
                  <div className="split-header">
                    <h3 style={{ margin: 0, fontSize: '1rem' }}>{course.name}</h3>
                    <span className="form-hint">
                      Code: <strong>{course.courseCode}</strong> · {courseMembers[course.id]?.length ?? 0} students
                    </span>
                  </div>
                  <div className="two-column" style={{ marginTop: '0.75rem' }}>
                    <div>
                      <h4 style={{ margin: '0 0 0.45rem 0', fontSize: '0.95rem' }}>Invite students</h4>
                      <div className="form-actions">
                        <input
                          className="ui-input"
                          placeholder="student@milton.edu, student2@milton.edu"
                          value={inviteEmails[course.id] ?? ''}
                          onChange={(e) => setInviteEmails((prev) => ({ ...prev, [course.id]: e.target.value }))}
                        />
                        <Button variant="secondary" size="sm" onClick={() => handleInvite(course.id)}>
                          Send invites
                        </Button>
                      </div>
                      {(courseMembers[course.id]?.length ?? 0) > 0 && (
                        <p className="form-hint" style={{ marginTop: '0.45rem' }}>
                          {courseMembers[course.id].join(', ')}
                        </p>
                      )}
                    </div>
                    <div>
                      <h4 style={{ margin: '0 0 0.45rem 0', fontSize: '0.95rem' }}>Publish assignment</h4>
                      <div className="form-grid">
                        <div className="form-group">
                          <label>Title</label>
                          <input
                            className="ui-input"
                            placeholder="Unit 3 practice"
                            value={assignForm[course.id]?.title ?? ''}
                            onChange={(e) =>
                              setAssignForm((prev) => ({
                                ...prev,
                                [course.id]: { ...(prev[course.id] ?? defaultPublishForm(course.id)), title: e.target.value },
                              }))
                            }
                          />
                        </div>
                        <div className="form-group form-group-wide">
                          <label>Description (optional)</label>
                          <textarea
                            className="ui-textarea"
                            placeholder="Assignment details and submission instructions"
                            value={assignForm[course.id]?.description ?? ''}
                            onChange={(e) =>
                              setAssignForm((prev) => ({
                                ...prev,
                                [course.id]: { ...(prev[course.id] ?? defaultPublishForm(course.id)), description: e.target.value },
                              }))
                            }
                            style={{ minHeight: 72 }}
                          />
                        </div>
                        <div className="form-group">
                          <label>Due</label>
                          <input
                            type="datetime-local"
                            className="ui-input"
                            value={assignForm[course.id]?.dueAt ?? defaultDueAtLocal()}
                            onChange={(e) =>
                              setAssignForm((prev) => ({
                                ...prev,
                                [course.id]: { ...(prev[course.id] ?? defaultPublishForm(course.id)), dueAt: e.target.value },
                              }))
                            }
                          />
                        </div>
                        <div className="form-group">
                          <label>Estimate (min)</label>
                          <input
                            type="number"
                            min={5}
                            className="ui-input"
                            value={assignForm[course.id]?.estMinutes ?? '45'}
                            onChange={(e) =>
                              setAssignForm((prev) => ({
                                ...prev,
                                [course.id]: { ...(prev[course.id] ?? defaultPublishForm(course.id)), estMinutes: e.target.value },
                              }))
                            }
                          />
                        </div>
                        <div className="form-group">
                          <label>Type</label>
                          <select
                            className="ui-select"
                            value={assignForm[course.id]?.type ?? 'homework'}
                            onChange={(e) =>
                              setAssignForm((prev) => ({
                                ...prev,
                                [course.id]: { ...(prev[course.id] ?? defaultPublishForm(course.id)), type: e.target.value },
                              }))
                            }
                          >
                            <option value="homework">Homework</option>
                            <option value="quiz">Quiz</option>
                            <option value="test">Test</option>
                            <option value="project">Project</option>
                            <option value="reading">Reading</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                      </div>
                      <Button size="sm" onClick={() => handlePublishAssignment(course.id)}>
                        Publish assignment
                      </Button>
                    </div>
                  </div>
                  {(courseAssignments[course.id]?.length ?? 0) > 0 ? (
                    <div style={{ marginTop: '0.9rem' }}>
                      <h4 style={{ margin: '0 0 0.45rem 0', fontSize: '0.95rem' }}>Published assignments</h4>
                      <div className="assignment-list">
                        {courseAssignments[course.id].map((assignment) => {
                          const isEditing = editingAssignmentId === assignment.id;
                          const editForm = editAssignmentForms[assignment.id] ?? defaultEditAssignmentForm(assignment);
                          const submissions = assignmentSubmissions[assignment.id] ?? [];
                          const showingSubmissions = activeSubmissionAssignmentId === assignment.id;

                          return (
                            <div key={assignment.id} className="assignment-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                              <div className="split-header">
                                <div className="assignment-card-title">{assignment.title}</div>
                                <span className="assignment-card-meta">
                                  {assignment.estMinutes} min
                                  {assignment.dueAtMs ? ` · Due ${formatDueDate(assignment.dueAtMs)}` : ' · No due date'}
                                </span>
                              </div>
                              {assignment.description && (
                                <p className="form-hint" style={{ margin: '0.35rem 0 0 0' }}>
                                  {assignment.description}
                                </p>
                              )}
                              <div className="assignment-card-actions" style={{ marginTop: '0.6rem' }}>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => {
                                    setEditingAssignmentId((prev) => (prev === assignment.id ? null : assignment.id));
                                    setEditAssignmentForms((prev) => ({
                                      ...prev,
                                      [assignment.id]: prev[assignment.id] ?? defaultEditAssignmentForm(assignment),
                                    }));
                                  }}
                                >
                                  {isEditing ? 'Cancel edit' : 'Edit details'}
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleToggleSubmissions(assignment.id)}
                                >
                                  {showingSubmissions ? 'Hide submissions' : 'View submissions'}
                                </Button>
                              </div>
                              {isEditing && (
                                <div style={{ marginTop: '0.8rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.8rem' }}>
                                  <div className="form-grid">
                                    <div className="form-group">
                                      <label>Title</label>
                                      <input
                                        className="ui-input"
                                        value={editForm.title}
                                        onChange={(e) =>
                                          setEditAssignmentForms((prev) => ({
                                            ...prev,
                                            [assignment.id]: { ...editForm, title: e.target.value },
                                          }))
                                        }
                                      />
                                    </div>
                                    <div className="form-group">
                                      <label>Due</label>
                                      <input
                                        type="datetime-local"
                                        className="ui-input"
                                        value={editForm.dueAt}
                                        onChange={(e) =>
                                          setEditAssignmentForms((prev) => ({
                                            ...prev,
                                            [assignment.id]: { ...editForm, dueAt: e.target.value },
                                          }))
                                        }
                                      />
                                    </div>
                                    <div className="form-group">
                                      <label>Estimate (min)</label>
                                      <input
                                        type="number"
                                        min={5}
                                        className="ui-input"
                                        value={editForm.estMinutes}
                                        onChange={(e) =>
                                          setEditAssignmentForms((prev) => ({
                                            ...prev,
                                            [assignment.id]: { ...editForm, estMinutes: e.target.value },
                                          }))
                                        }
                                      />
                                    </div>
                                    <div className="form-group">
                                      <label>Type</label>
                                      <select
                                        className="ui-select"
                                        value={editForm.type}
                                        onChange={(e) =>
                                          setEditAssignmentForms((prev) => ({
                                            ...prev,
                                            [assignment.id]: { ...editForm, type: e.target.value },
                                          }))
                                        }
                                      >
                                        <option value="homework">Homework</option>
                                        <option value="quiz">Quiz</option>
                                        <option value="test">Test</option>
                                        <option value="project">Project</option>
                                        <option value="reading">Reading</option>
                                        <option value="other">Other</option>
                                      </select>
                                    </div>
                                    <div className="form-group form-group-wide">
                                      <label>Description</label>
                                      <textarea
                                        className="ui-textarea"
                                        value={editForm.description}
                                        onChange={(e) =>
                                          setEditAssignmentForms((prev) => ({
                                            ...prev,
                                            [assignment.id]: { ...editForm, description: e.target.value },
                                          }))
                                        }
                                        style={{ minHeight: 72 }}
                                      />
                                    </div>
                                  </div>
                                  <Button size="sm" onClick={() => handleSaveAssignmentEdit(assignment.id)}>
                                    Save assignment
                                  </Button>
                                </div>
                              )}
                              {showingSubmissions && (
                                <div style={{ marginTop: '0.8rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.8rem' }}>
                                  {submissions.length === 0 ? (
                                    <p className="empty-state">No student submissions yet.</p>
                                  ) : (
                                    <div className="assignment-list">
                                      {submissions.map((submission) => (
                                        <div key={submission.id} className="request-card">
                                          <div className="request-card-title">{submission.studentEmail}</div>
                                          <div className="request-card-meta">
                                            Updated {new Date(submission.updatedAt).toLocaleString()}
                                          </div>
                                          {submission.comment && (
                                            <p style={{ margin: '0.45rem 0', whiteSpace: 'pre-wrap' }}>{submission.comment}</p>
                                          )}
                                          {submission.links.length > 0 && (
                                            <div style={{ marginTop: '0.25rem' }}>
                                              <p className="form-hint" style={{ margin: '0 0 0.25rem 0' }}>Links</p>
                                              <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                                                {submission.links.map((link) => (
                                                  <li key={link}>
                                                    <a className="link" href={link} target="_blank" rel="noreferrer">{link}</a>
                                                  </li>
                                                ))}
                                              </ul>
                                            </div>
                                          )}
                                          {submission.files.length > 0 && (
                                            <div style={{ marginTop: '0.35rem' }}>
                                              <p className="form-hint" style={{ margin: '0 0 0.25rem 0' }}>Files</p>
                                              <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                                                {submission.files.map((file) => (
                                                  <li key={file.id} className="form-hint">
                                                    <a
                                                      className="link"
                                                      href={`/api/uploads/submissions/${submission.id}/files/${file.id}`}
                                                      target="_blank"
                                                      rel="noreferrer"
                                                    >
                                                      {file.originalName}
                                                    </a>{' '}
                                                    ({Math.round(file.sizeBytes / 1024)} KB)
                                                  </li>
                                                ))}
                                              </ul>
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="empty-state" style={{ marginTop: '0.75rem' }}>No assignments published yet.</p>
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
          Add grading tasks to include teacher work in your planner.
        </p>
        <div className="form-grid">
          <div className="form-group">
            <label>Task title</label>
            <input
              className="ui-input"
              placeholder="Grade Unit 4 quizzes"
              value={newGradingTitle}
              onChange={(e) => setNewGradingTitle(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Due</label>
            <input
              type="datetime-local"
              className="ui-input"
              value={newGradingDueAt}
              onChange={(e) => setNewGradingDueAt(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Estimate (min)</label>
            <input
              type="number"
              min={5}
              className="ui-input"
              value={newGradingEst}
              onChange={(e) => setNewGradingEst(e.target.value)}
            />
          </div>
        </div>
        <Button onClick={handleCreateGradingTask} disabled={!newGradingTitle.trim()}>
          Add grading task
        </Button>
        {gradingTasks.length > 0 ? (
          <div className="assignment-list" style={{ marginTop: '0.9rem' }}>
            {gradingTasks.map((task) => (
              <div key={task.id} className="assignment-card">
                <div className="assignment-card-content">
                  <div className="assignment-card-title">{task.title}</div>
                  <div className="assignment-card-meta">
                    {task.estMinutes} min
                    {task.dueAtMs ? ` · Due ${formatDueDate(task.dueAtMs)}` : ' · No due date'}
                  </div>
                </div>
                <Button variant="danger" size="sm" onClick={() => handleDeleteGrading(task.id)}>
                  Delete
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-state" style={{ marginTop: '0.85rem' }}>No grading tasks yet.</p>
        )}
      </Card>
    </div>
  );
}

import { useState, useEffect, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  api,
  type Assignment,
  type AssignmentSubmission,
  type CourseAssignment,
} from '../api';
import { Button, Card, Callout } from '../components/ui';
import { useAuthGate } from '../hooks/useAuthGate';
import { fromDateTimeLocalValue, formatDueDate } from '../utils/datetime';

const PRIORITY_OPTIONS = [
  { value: 1, label: 'Low' },
  { value: 2, label: 'Low' },
  { value: 3, label: 'Medium' },
  { value: 4, label: 'High' },
  { value: 5, label: 'High' },
];

interface SubmissionDraft {
  comment: string;
  linksText: string;
  file: File | null;
}

function linksToText(links: string[]): string {
  return links.join('\n');
}

function parseLinks(linksText: string): string[] {
  return Array.from(
    new Set(
      linksText
        .split(/\n|,/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ).slice(0, 8);
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Failed to process file'));
        return;
      }
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.readAsDataURL(file);
  });
}

export function AssignmentsPage() {
  const navigate = useNavigate();
  const { isSignedIn } = useAuthGate();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [teacherAssignments, setTeacherAssignments] = useState<CourseAssignment[]>([]);
  const [submissionByAssignment, setSubmissionByAssignment] = useState<Record<string, AssignmentSubmission>>({});
  const [submissionDrafts, setSubmissionDrafts] = useState<Record<string, SubmissionDraft>>({});
  const [openSubmissionId, setOpenSubmissionId] = useState<string | null>(null);
  const [submissionBusyId, setSubmissionBusyId] = useState<string | null>(null);
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
    optional: false,
  });

  const courses = [...new Set(assignments.map((a) => a.course).filter(Boolean))].sort();
  const addAssignmentFormId = 'add-assignment-form';

  useEffect(() => {
    if (!isSignedIn) {
      setLoading(false);
      setAssignments([]);
      setTeacherAssignments([]);
      setSubmissionByAssignment({});
      setSubmissionDrafts({});
      setOpenSubmissionId(null);
      setError(null);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  async function load() {
    if (!isSignedIn) return;
    try {
      setLoading(true);
      setError(null);
      const [personal, fromTeachers, submissions] = await Promise.all([
        api.listAssignments(),
        api.listStudentAssignments().catch(() => []),
        api.listStudentAssignmentSubmissions().catch(() => []),
      ]);
      setAssignments(personal);
      setTeacherAssignments(fromTeachers);
      const submissionMap: Record<string, AssignmentSubmission> = {};
      submissions.forEach((submission) => {
        submissionMap[submission.assignmentId] = submission;
      });
      setSubmissionByAssignment(submissionMap);
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
        optional: confirmForm.optional,
      });
      console.log('[Planner][API] Created assignment');
      setConfirmForm({
        course: '',
        title: '',
        dueAt: '',
        estMinutes: 30 as const,
        priority: 3,
        type: 'homework',
        optional: false,
      });
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

  function ensureSubmissionDraft(assignmentId: string) {
    setSubmissionDrafts((prev) => {
      if (prev[assignmentId]) return prev;
      const existing = submissionByAssignment[assignmentId];
      return {
        ...prev,
        [assignmentId]: {
          comment: existing?.comment ?? '',
          linksText: linksToText(existing?.links ?? []),
          file: null,
        },
      };
    });
  }

  function updateSubmissionDraft(
    assignmentId: string,
    update: Partial<SubmissionDraft>
  ) {
    setSubmissionDrafts((prev) => {
      const current = prev[assignmentId] ?? { comment: '', linksText: '', file: null };
      return {
        ...prev,
        [assignmentId]: { ...current, ...update },
      };
    });
  }

  async function handleSaveSubmission(assignment: CourseAssignment) {
    const draft = submissionDrafts[assignment.id] ?? { comment: '', linksText: '', file: null };
    try {
      setSubmissionBusyId(assignment.id);
      setError(null);
      const saved = await api.submitStudentAssignment(assignment.id, {
        comment: draft.comment.trim() || null,
        links: parseLinks(draft.linksText),
      });
      setSubmissionByAssignment((prev) => ({ ...prev, [assignment.id]: saved }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save submission');
    } finally {
      setSubmissionBusyId(null);
    }
  }

  async function handleUploadSubmissionFile(assignment: CourseAssignment) {
    const draft = submissionDrafts[assignment.id];
    if (!draft?.file) {
      setError('Choose a file before uploading.');
      return;
    }
    try {
      setSubmissionBusyId(assignment.id);
      setError(null);
      const contentBase64 = await toBase64(draft.file);
      const updated = await api.uploadStudentAssignmentFile(assignment.id, {
        fileName: draft.file.name,
        mimeType: draft.file.type || null,
        contentBase64,
      });
      setSubmissionByAssignment((prev) => ({ ...prev, [assignment.id]: updated }));
      updateSubmissionDraft(assignment.id, { file: null });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to upload file');
    } finally {
      setSubmissionBusyId(null);
    }
  }

  function handleSubmissionFileChange(assignmentId: string, event: ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    updateSubmissionDraft(assignmentId, { file: nextFile });
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
          <div className="form-group">
            <label className="toggle-row" style={{ marginTop: '1.65rem' }}>
              <input
                type="checkbox"
                checked={confirmForm.optional}
                onChange={(e) => setConfirmForm((f) => ({ ...f, optional: e.target.checked }))}
              />
              <span>Optional assignment</span>
            </label>
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
            {teacherAssignments.map((assignment) => {
              const submission = submissionByAssignment[assignment.id];
              const isOpen = openSubmissionId === assignment.id;
              const draft = submissionDrafts[assignment.id] ?? {
                comment: submission?.comment ?? '',
                linksText: linksToText(submission?.links ?? []),
                file: null,
              };
              return (
                <div key={assignment.id} className="assignment-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <div className="split-header">
                    <div className="assignment-card-title">{assignment.title}</div>
                    <span className={`status-chip ${submission ? 'status-claimed' : 'status-open'}`}>
                      {submission ? 'Submitted' : 'Not submitted'}
                    </span>
                  </div>
                  <div className="assignment-card-meta">
                    {assignment.courseName ?? assignment.courseId} · {assignment.estMinutes} min
                    {assignment.dueAtMs
                      ? ` · Due ${formatDueDate(assignment.dueAtMs)}`
                      : ' · No due date'}
                  </div>
                  {submission && (
                    <div style={{ marginTop: '0.45rem' }}>
                      {submission.comment && (
                        <p className="form-hint" style={{ margin: '0.25rem 0' }}>
                          Latest note: {submission.comment}
                        </p>
                      )}
                      {submission.links.length > 0 && (
                        <p className="form-hint" style={{ margin: '0.25rem 0' }}>
                          Links: {submission.links.length}
                        </p>
                      )}
                      {submission.files.length > 0 && (
                        <p className="form-hint" style={{ margin: '0.25rem 0' }}>
                          Files: {submission.files.length}
                        </p>
                      )}
                    </div>
                  )}
                  <div className="assignment-card-actions" style={{ marginTop: '0.65rem' }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        ensureSubmissionDraft(assignment.id);
                        setOpenSubmissionId((prev) => (prev === assignment.id ? null : assignment.id));
                      }}
                    >
                      {isOpen ? 'Hide submission' : submission ? 'Edit submission' : 'Submit work'}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        navigate(
                          `/support?new=true&title=${encodeURIComponent(`Help with: ${assignment.title}`)}&linkedAssignmentId=${assignment.id}`,
                        )
                      }
                    >
                      Need help
                    </Button>
                  </div>
                  {isOpen && (
                    <div style={{ marginTop: '0.85rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.85rem' }}>
                      <div className="form-grid form-grid-wide">
                        <div className="form-group form-group-wide">
                          <label>Comment/notes</label>
                          <textarea
                            className="ui-textarea"
                            aria-label="Comment/notes"
                            value={draft.comment}
                            onChange={(e) => updateSubmissionDraft(assignment.id, { comment: e.target.value })}
                            placeholder="What did you complete? Any notes for your teacher?"
                            style={{ minHeight: 88 }}
                          />
                        </div>
                        <div className="form-group form-group-wide">
                          <label>Links (one per line)</label>
                          <textarea
                            className="ui-textarea"
                            aria-label="Links (one per line)"
                            value={draft.linksText}
                            onChange={(e) => updateSubmissionDraft(assignment.id, { linksText: e.target.value })}
                            placeholder="https://docs.google.com/..."
                            style={{ minHeight: 72 }}
                          />
                        </div>
                        <div className="form-group form-group-wide">
                          <label>Upload file (optional)</label>
                          <input
                            type="file"
                            className="ui-input"
                            aria-label="Upload file"
                            onChange={(event) => handleSubmissionFileChange(assignment.id, event)}
                          />
                          {draft.file && (
                            <small className="form-hint">
                              Selected: {draft.file.name} ({Math.round(draft.file.size / 1024)} KB)
                            </small>
                          )}
                        </div>
                      </div>
                      <div className="form-actions">
                        <Button
                          size="sm"
                          onClick={() => handleSaveSubmission(assignment)}
                          disabled={submissionBusyId === assignment.id}
                        >
                          {submissionBusyId === assignment.id ? 'Saving…' : 'Save submission'}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleUploadSubmissionFile(assignment)}
                          disabled={submissionBusyId === assignment.id || !draft.file}
                        >
                          {submissionBusyId === assignment.id ? 'Uploading…' : 'Upload file'}
                        </Button>
                      </div>
                      {submission?.files && submission.files.length > 0 && (
                        <div style={{ marginTop: '0.55rem' }}>
                          <p className="form-hint" style={{ margin: '0 0 0.25rem 0' }}>Uploaded files</p>
                          <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                            {submission.files.map((file) => (
                              <li key={file.id} className="form-hint">
                                {file.originalName} ({Math.round(file.sizeBytes / 1024)} KB)
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
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
                  <div className="split-header" style={{ marginBottom: '0.15rem' }}>
                    <div className="assignment-card-title">{a.title}</div>
                    {a.optional && <span className="status-chip status-claimed">Optional</span>}
                  </div>
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

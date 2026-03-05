import { useEffect, useMemo, useState } from 'react';
import {
  api,
  type CourseAnnouncement,
  type CourseAssignment,
  type CourseFeedbackSubmission,
  type CourseFeedbackSummary,
  type PlannerCourse,
} from '../api';
import { useAppState } from '../context/AppContext';
import { Button, Card, Callout } from '../components/ui';
import { useAuthGate } from '../hooks/useAuthGate';
import { formatDueDate } from '../utils/datetime';

interface CourseDetailState {
  assignments: CourseAssignment[];
  announcements: CourseAnnouncement[];
}

export function CoursesPage() {
  const { teacherEligible } = useAppState();
  const { isSignedIn } = useAuthGate();
  const [courses, setCourses] = useState<PlannerCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [details, setDetails] = useState<Record<string, CourseDetailState>>({});
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [joinCode, setJoinCode] = useState('');
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');
  const [feedbackSummaries, setFeedbackSummaries] = useState<Record<string, CourseFeedbackSummary>>({});
  const [studentFeedback, setStudentFeedback] = useState<Record<string, CourseFeedbackSubmission | null>>({});
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [feedbackSaving, setFeedbackSaving] = useState(false);

  useEffect(() => {
    if (!isSignedIn) {
      setLoading(false);
      setCourses([]);
      setSelectedCourseId('');
      setDetails({});
      setError(null);
      return;
    }
    loadCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherEligible, isSignedIn]);

  useEffect(() => {
    if (!isSignedIn) return;
    if (!selectedCourseId) return;
    if (details[selectedCourseId]) return;
    loadCourseDetail(selectedCourseId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourseId, isSignedIn]);

  useEffect(() => {
    if (!selectedCourseId || teacherEligible) return;
    const existing = studentFeedback[selectedCourseId];
    if (!existing) {
      setFeedbackRating(5);
      setFeedbackComment('');
      return;
    }
    setFeedbackRating(existing.rating);
    setFeedbackComment(existing.comment ?? '');
  }, [selectedCourseId, studentFeedback, teacherEligible]);

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) ?? null,
    [courses, selectedCourseId]
  );

  async function loadCourses() {
    if (!isSignedIn) return;
    try {
      setLoading(true);
      setError(null);
      const list = teacherEligible
        ? await api.listTeacherCourses()
        : await api.listStudentCourses();
      setCourses(list);
      if (list.length > 0) {
        setSelectedCourseId((prev) => prev || list[0].id);
      } else {
        setSelectedCourseId('');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  }

  async function loadCourseDetail(courseId: string) {
    if (!isSignedIn) return;
    try {
      setLoadingDetail(true);
      setError(null);
      if (teacherEligible) {
        const [assignments, announcements, feedback] = await Promise.all([
          api.listCourseAssignments(courseId),
          api.listCourseAnnouncements(courseId),
          api.getTeacherCourseFeedbackSummary(courseId),
        ]);
        setDetails((prev) => ({ ...prev, [courseId]: { assignments, announcements } }));
        setFeedbackSummaries((prev) => ({ ...prev, [courseId]: feedback }));
        return;
      }
      const [detail, mine] = await Promise.all([
        api.getStudentCourseDetail(courseId),
        api.getStudentCourseFeedback(courseId),
      ]);
      setDetails((prev) => ({
        ...prev,
        [courseId]: {
          assignments: detail.assignments,
          announcements: detail.announcements,
        },
      }));
      setStudentFeedback((prev) => ({ ...prev, [courseId]: mine }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load course detail');
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleJoinByCode() {
    if (!isSignedIn) return;
    if (!joinCode.trim()) return;
    try {
      setError(null);
      const course = await api.joinCourseByCode(joinCode.trim().toUpperCase());
      setJoinCode('');
      await loadCourses();
      setSelectedCourseId(course.id);
      await loadCourseDetail(course.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join course');
    }
  }

  async function handleCreateAnnouncement() {
    if (!isSignedIn) return;
    if (!selectedCourseId || !announcementTitle.trim() || !announcementBody.trim()) return;
    try {
      setError(null);
      await api.createCourseAnnouncement(selectedCourseId, {
        title: announcementTitle.trim(),
        body: announcementBody.trim(),
      });
      setAnnouncementTitle('');
      setAnnouncementBody('');
      await loadCourseDetail(selectedCourseId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create announcement');
    }
  }

  async function handleSubmitFeedback() {
    if (!isSignedIn) return;
    if (!selectedCourseId) return;
    try {
      setFeedbackSaving(true);
      setError(null);
      const saved = await api.submitStudentCourseFeedback(selectedCourseId, {
        rating: feedbackRating,
        comment: feedbackComment.trim() || null,
      });
      setStudentFeedback((prev) => ({ ...prev, [selectedCourseId]: saved }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit feedback');
    } finally {
      setFeedbackSaving(false);
    }
  }

  const activeDetail = selectedCourseId ? details[selectedCourseId] : undefined;
  const activeFeedbackSummary = selectedCourseId ? feedbackSummaries[selectedCourseId] : undefined;
  const activeStudentFeedback = selectedCourseId ? studentFeedback[selectedCourseId] : null;

  return (
    <div className="page">
      <h1 className="page-title">Courses</h1>
      <p className="page-subtitle">
        {teacherEligible
          ? 'Share your course code, publish assignments, and post announcements.'
          : 'Join courses with a code and see assignments and announcements in one place.'}
      </p>

      {!teacherEligible && (
        <Card>
          <h2 className="section-title">Join with course code</h2>
          <div className="form-actions">
            <input
              className="ui-input"
              placeholder="Enter code (e.g. A1B2C3)"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              style={{ maxWidth: 220, textTransform: 'uppercase' }}
            />
            <Button onClick={handleJoinByCode} disabled={!joinCode.trim()}>
              Join course
            </Button>
          </div>
        </Card>
      )}

      {error && <Callout variant="error">{error}</Callout>}

      <div className="courses-layout">
        <Card>
          <h2 className="section-title">My courses</h2>
          {loading ? (
            <p>Loading…</p>
          ) : courses.length === 0 ? (
            <p className="empty-state">
              {teacherEligible
                ? 'No courses yet. Create one in Teacher Dashboard.'
                : 'You are not enrolled in any courses yet.'}
            </p>
          ) : (
            <div className="course-list">
              {courses.map((course) => (
                <button
                  key={course.id}
                  type="button"
                  className={`course-list-item ${selectedCourseId === course.id ? 'active' : ''}`}
                  onClick={() => setSelectedCourseId(course.id)}
                >
                  <div className="course-list-title">{course.name}</div>
                  <div className="course-list-meta">
                    Code: {course.courseCode} · Teacher: {course.teacherEmail}
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="section-title">Course feed</h2>
          {!selectedCourse ? (
            <p className="empty-state">Select a course to view details.</p>
          ) : loadingDetail && !activeDetail ? (
            <p>Loading…</p>
          ) : (
            <>
              <div className="split-header">
                <h3 style={{ margin: 0 }}>{selectedCourse.name}</h3>
                <span className="form-hint">Code: {selectedCourse.courseCode}</span>
              </div>

              {teacherEligible && (
                <div style={{ marginTop: '0.85rem' }}>
                  <h4 style={{ margin: '0 0 0.45rem 0' }}>New announcement</h4>
                  <div className="form-grid">
                    <div className="form-group form-group-wide">
                      <label>Title</label>
                      <input
                        className="ui-input"
                        value={announcementTitle}
                        onChange={(e) => setAnnouncementTitle(e.target.value)}
                        placeholder="Announcement title"
                      />
                    </div>
                    <div className="form-group form-group-wide">
                      <label>Body</label>
                      <textarea
                        className="ui-textarea"
                        value={announcementBody}
                        onChange={(e) => setAnnouncementBody(e.target.value)}
                        placeholder="Announcement details"
                        style={{ minHeight: 90 }}
                      />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleCreateAnnouncement}
                    disabled={!announcementTitle.trim() || !announcementBody.trim()}
                  >
                    Post announcement
                  </Button>
                </div>
              )}

              <div style={{ marginTop: '1rem' }}>
                <h4 style={{ margin: '0 0 0.45rem 0' }}>Announcements</h4>
                {!activeDetail || activeDetail.announcements.length === 0 ? (
                  <p className="empty-state">No announcements yet.</p>
                ) : (
                  <div className="assignment-list">
                    {activeDetail.announcements.map((announcement) => (
                      <div key={announcement.id} className="assignment-card">
                        <div className="assignment-card-content">
                          <div className="assignment-card-title">{announcement.title}</div>
                          <div className="assignment-card-meta">
                            {new Date(announcement.createdAt).toLocaleString()} · {announcement.createdByEmail}
                          </div>
                          <p style={{ margin: '0.5rem 0 0 0', whiteSpace: 'pre-wrap' }}>{announcement.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ marginTop: '1rem' }}>
                <h4 style={{ margin: '0 0 0.45rem 0' }}>Assignments</h4>
                {!activeDetail || activeDetail.assignments.length === 0 ? (
                  <p className="empty-state">No assignments published yet.</p>
                ) : (
                  <div className="assignment-list">
                    {activeDetail.assignments.map((assignment) => (
                      <div key={assignment.id} className="assignment-card">
                        <div className="assignment-card-content">
                          <div className="assignment-card-title">{assignment.title}</div>
                          <div className="assignment-card-meta">
                            {assignment.estMinutes} min · {assignment.type}
                            {assignment.dueAtMs
                              ? ` · Due ${formatDueDate(assignment.dueAtMs)}`
                              : ' · No due date'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ marginTop: '1rem' }}>
                <h4 style={{ margin: '0 0 0.45rem 0' }}>Course feedback</h4>
                {teacherEligible ? (
                  !activeFeedbackSummary || activeFeedbackSummary.totalResponses === 0 ? (
                    <p className="empty-state">No feedback submitted yet.</p>
                  ) : (
                    <>
                      <p className="form-hint" style={{ marginTop: 0 }}>
                        Average rating: {activeFeedbackSummary.averageRating?.toFixed(2)} / 5 from {activeFeedbackSummary.totalResponses} response(s).
                      </p>
                      <div className="form-actions" style={{ marginBottom: '0.75rem' }}>
                        {activeFeedbackSummary.ratingBreakdown.map((row) => (
                          <span key={row.rating} className="status-chip status-claimed">
                            {row.rating}★: {row.count}
                          </span>
                        ))}
                      </div>
                      {activeFeedbackSummary.recentComments.length === 0 ? (
                        <p className="empty-state">No written comments yet.</p>
                      ) : (
                        <div className="assignment-list">
                          {activeFeedbackSummary.recentComments.map((entry, idx) => (
                            <div key={`${entry.createdAt}-${idx}`} className="assignment-card">
                              <div className="assignment-card-content">
                                <div className="assignment-card-title">{entry.rating} / 5</div>
                                <div className="assignment-card-meta">{new Date(entry.createdAt).toLocaleString()}</div>
                                <p style={{ margin: '0.35rem 0 0 0', whiteSpace: 'pre-wrap' }}>{entry.comment}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )
                ) : (
                  <>
                    <p className="form-hint" style={{ marginTop: 0 }}>
                      Anonymous feedback helps teachers improve pacing and workload.
                    </p>
                    <div className="form-grid">
                      <div className="form-group">
                        <label>Rating</label>
                        <select
                          className="ui-select"
                          value={feedbackRating}
                          onChange={(e) => setFeedbackRating(Number(e.target.value) || 5)}
                        >
                          {[5, 4, 3, 2, 1].map((rating) => (
                            <option key={rating} value={rating}>{rating}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group form-group-wide">
                        <label>Comment (optional)</label>
                        <textarea
                          className="ui-textarea"
                          value={feedbackComment}
                          onChange={(e) => setFeedbackComment(e.target.value)}
                          placeholder="Share what worked and what could improve"
                          style={{ minHeight: 85 }}
                        />
                      </div>
                    </div>
                    <div className="form-actions">
                      <Button onClick={handleSubmitFeedback} disabled={feedbackSaving}>
                        {feedbackSaving ? 'Saving…' : 'Submit feedback'}
                      </Button>
                      {activeStudentFeedback && (
                        <span className="form-hint">
                          Last submitted {new Date(activeStudentFeedback.updatedAt).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

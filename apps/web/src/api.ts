const API_BASE = '/api';
const STORAGE_KEY_EMAIL = 'planner_school_email';
const STORAGE_KEY_DISPLAY_NAME = 'planner_display_name';
type ApiAuthStatus = 'loading' | 'signed_in' | 'signed_out';
let apiAuthStatus: ApiAuthStatus = 'loading';
let apiAuthMode: 'dev' | 'google' | null = null;
const PUBLIC_PATHS = new Set([
  '/health',
  '/auth/me',
  '/auth/google/start',
  '/auth/google/callback',
]);

if (typeof window !== 'undefined') {
  // Helps debug proxy/path issues quickly in browser devtools.
  // eslint-disable-next-line no-console
  console.info(`[Web] API base configured: ${API_BASE}`);
}

export function setApiAuthStatus(status: ApiAuthStatus): void {
  apiAuthStatus = status;
}

export function setApiAuthMode(mode: 'dev' | 'google' | null): void {
  apiAuthMode = mode;
}

function getIdentityHeaders(): Record<string, string> {
  if (!import.meta.env.DEV || apiAuthMode === 'google') {
    return {};
  }
  try {
    const email = localStorage.getItem(STORAGE_KEY_EMAIL) || '';
    const name = localStorage.getItem(STORAGE_KEY_DISPLAY_NAME) || '';
    if (!email) return {};
    const headers: Record<string, string> = {};
    if (email) headers['X-User-Email'] = email;
    if (name) headers['X-User-Name'] = name;
    return headers;
  } catch {
    return {};
  }
}

function hasDevIdentity(identityHeaders: Record<string, string>): boolean {
  return typeof identityHeaders['X-User-Email'] === 'string' && identityHeaders['X-User-Email'].trim().length > 0;
}

function isPublicPath(path: string): boolean {
  const normalized = path.startsWith('/api/') ? path.slice('/api'.length) : path;
  return PUBLIC_PATHS.has(normalized);
}

function makeSignedOutError(message = 'Not authenticated'): Error & { status?: number; rawMessage?: string } {
  const err = new Error(message) as Error & { status?: number; rawMessage?: string };
  err.status = 401;
  err.rawMessage = message;
  return err;
}

function notifySignedOut(): void {
  apiAuthStatus = 'signed_out';
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('planner:auth-required'));
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const identityHeaders = getIdentityHeaders();
  if (apiAuthStatus === 'signed_out' && !hasDevIdentity(identityHeaders) && !isPublicPath(path)) {
    throw makeSignedOutError();
  }
  let res: Response;
  try {
    res = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...identityHeaders,
        ...options.headers,
      },
    });
  } catch (cause) {
    const err = new Error('API offline or proxy misconfigured') as Error & { status?: number; cause?: unknown };
    err.status = 0;
    err.cause = cause;
    throw err;
  }

  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const responseMode =
      typeof data === 'object'
      && data !== null
      && 'mode' in data
      && ((data as { mode?: unknown }).mode === 'dev' || (data as { mode?: unknown }).mode === 'google')
        ? (data as { mode: 'dev' | 'google' }).mode
        : undefined;
    const requestIdFromBody =
      typeof data === 'object'
      && data !== null
      && 'requestId' in data
      && typeof (data as { requestId?: unknown }).requestId === 'string'
        ? (data as { requestId: string }).requestId
        : '';
    const requestId = res.headers.get('x-request-id') || requestIdFromBody;
    const rawMessage =
      (typeof data === 'object' && data !== null && 'error' in data && typeof (data as { error: unknown }).error === 'string')
        ? (data as { error: string }).error
        : `Request failed: ${res.status} ${res.statusText}`;
    const normalized = rawMessage.toLowerCase();
    const isDbFailure =
      normalized.includes('disk i/o')
      || normalized.includes('sqlite')
      || normalized.includes('database is locked')
      || normalized.includes('sqlstate');
    const msg = isDbFailure
      ? `Database write failed — check server logs${requestId ? ` (request id: ${requestId})` : ''}`
      : rawMessage;
    const isAuthMePath = path === '/auth/me' || path === '/api/auth/me';
    if (res.status === 401 && !isAuthMePath && !hasDevIdentity(identityHeaders)) {
      notifySignedOut();
    }
    if (!(res.status === 401 && isAuthMePath)) {
      console.error('[API]', path, res.status, msg, requestId ? { requestId } : undefined);
    }
    const err = new Error(msg) as Error & { status?: number; requestId?: string; rawMessage?: string; mode?: 'dev' | 'google' };
    err.status = res.status;
    err.requestId = requestId || undefined;
    err.rawMessage = rawMessage;
    err.mode = responseMode;
    throw err;
  }

  return data as T;
}

export interface AuthUser {
  email: string;
  name: string;
  picture: string | null;
  isTeacher: boolean;
  isStudent?: boolean;
  role?: 'teacher' | 'student' | 'unknown';
  mode?: 'dev' | 'google';
  authenticated?: boolean;
}

function authRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return request<T>(normalizedPath, options);
}

export interface Assignment {
  id: string;
  course: string;
  title: string;
  dueAt?: number; // epoch ms
  estMinutes: number;
  priority: number;
  type: string;
  completed: boolean;
  optional?: boolean;
}

export interface ParsedDraft {
  title: string;
  estMinutes: number | null;
  type: string;
}

export interface CourseAssignment {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  dueAtMs: number | null;
  estMinutes: number;
  type: string;
  createdByEmail: string;
  createdAt: string;
  courseName?: string;
}

export interface AssignmentSubmissionFile {
  id: string;
  submissionId: string;
  originalName: string;
  storedPath: string;
  mimeType: string | null;
  sizeBytes: number;
  createdAt: string;
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  studentEmail: string;
  comment: string | null;
  links: string[];
  createdAt: string;
  updatedAt: string;
  files: AssignmentSubmissionFile[];
}

export interface PlannerCourse {
  id: string;
  name: string;
  courseCode: string;
  teacherEmail: string;
  createdAt: string;
}

export interface CourseAnnouncement {
  id: string;
  courseId: string;
  title: string;
  body: string;
  createdByEmail: string;
  createdAt: string;
}

export interface CourseFeedbackSubmission {
  id: string;
  courseId: string;
  studentEmail: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CourseFeedbackSummary {
  courseId: string;
  totalResponses: number;
  averageRating: number | null;
  ratingBreakdown: { rating: number; count: number }[];
  recentComments: { rating: number; comment: string; createdAt: string }[];
}

export type NotificationType =
  | 'assignment_posted'
  | 'request_claimed'
  | 'request_unclaimed'
  | 'request_closed'
  | 'request_comment'
  | 'due_reminder_24h'
  | 'due_reminder_6h';

export interface NotificationRecord {
  id: string;
  userEmail: string;
  type: NotificationType;
  payload: Record<string, unknown> | null;
  dedupeKey: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface GradingTask {
  id: string;
  teacherEmail: string;
  title: string;
  dueAtMs: number | null;
  estMinutes: number;
  createdAt: string;
}

export interface AvailabilityBlock {
  id: string;
  startMin: number;
  endMin: number;
}

export interface PlanSession {
  assignmentId: string;
  startMin: number;
  endMin: number;
}

export interface PlanResult {
  sessions: PlanSession[];
  warnings: string[];
}

export interface PlannerPreferences {
  userEmail: string;
  studyWindowStartMin: number;
  studyWindowEndMin: number;
  maxSessionMin: number;
  breakBetweenSessionsMin: number;
  avoidLateNight: boolean;
  coursePriorityWeights: Record<string, number>;
  updatedAt: string;
}

export interface HelpRequest {
  id: string;
  title: string;
  description: string;
  subject: string;
  urgency: string;
  status: string;
  createdAt: string;
  claimMode?: 'any' | 'teacher_only' | null;
  meetingAbout?: string | null;
  meetingLocation?: string | null;
  meetingLink?: string | null;
  proposedTimes?: string | null;
  claimedBy?: string | null;
  claimedByEmail?: string | null;
  claimedAt?: string | null;
  unclaimedAt?: string | null;
  unclaimedByEmail?: string | null;
  linkedAssignmentId?: string | null;
  closedAt?: string | null;
  createdByEmail?: string | null;
}

export interface RequestActivityEntry {
  type: 'created' | 'claimed' | 'unclaimed' | 'closed';
  at: string;
  byEmail?: string | null;
  label?: string | null;
}

export interface HelpComment {
  id: string;
  requestId: string;
  authorLabel: string;
  authorDisplayName?: string | null;
  body: string;
  createdAt: string;
}

export interface HelpRequestResource {
  id: string;
  requestId: string;
  kind: 'link' | 'file';
  label: string | null;
  url: string | null;
  originalName: string | null;
  storedPath: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  note: string | null;
  createdAt: string;
  createdByEmail: string | null;
}

export interface RequestsSummaryRow {
  subject: string;
  urgency: string;
  status: string;
  count: number;
}

export const api = {
  getApiHealth: () => request<{ ok: boolean; timestamp: string }>('/health'),
  getAuthMe: () => authRequest<AuthUser>('/auth/me'),
  logout: () => authRequest<{ ok: boolean }>('/auth/logout', { method: 'POST' }),

  getCalendarBusy: (days?: number) =>
    request<{ startMs: number; endMs: number; source: string }[]>(
      `/calendar/busy${days != null ? `?days=${days}` : ''}`
    ),

  getPlannerPreferences: () =>
    request<PlannerPreferences>('/settings/planner-preferences'),
  updatePlannerPreferences: (body: {
    studyWindowStartMin: number;
    studyWindowEndMin: number;
    maxSessionMin: number;
    breakBetweenSessionsMin: number;
    avoidLateNight: boolean;
    coursePriorityWeights: Record<string, number>;
  }) =>
    request<PlannerPreferences>('/settings/planner-preferences', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  getDbHealth: () => request<{ ok: boolean; dbFile: string; checkedAt: string }>('/db/health'),

  // Teacher
  listTeacherCourses: () => request<PlannerCourse[]>('/teacher/courses'),
  createTeacherCourse: (name: string) =>
    request<PlannerCourse>('/teacher/courses', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  inviteToCourse: (courseId: string, emails: string[]) =>
    request<{ courseId: string; members: string[] }>(`/teacher/courses/${courseId}/invite`, {
      method: 'POST',
      body: JSON.stringify({ emails }),
    }),
  listCourseMembers: (courseId: string) =>
    request<{ courseId: string; members: string[] }>(`/teacher/courses/${courseId}/members`),
  createTeacherAssignment: (body: {
    courseId: string;
    title: string;
    description?: string | null;
    dueAtMs?: number | null;
    estMinutes: number;
    type: string;
  }) =>
    request<CourseAssignment>(`/teacher/assignments`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  listCourseAssignments: (courseId: string) =>
    request<CourseAssignment[]>(`/teacher/courses/${courseId}/assignments`),
  updateTeacherAssignment: (
    assignmentId: string,
    body: {
      title?: string;
      description?: string | null;
      dueAtMs?: number | null;
      estMinutes?: number;
      type?: string;
    }
  ) =>
    request<CourseAssignment>(`/teacher/assignments/${assignmentId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  listTeacherAssignmentSubmissions: (assignmentId: string) =>
    request<{ assignment: CourseAssignment; submissions: AssignmentSubmission[] }>(
      `/teacher/assignments/${assignmentId}/submissions`
    ),
  getTeacherAssignmentSubmission: (assignmentId: string, submissionId: string) =>
    request<AssignmentSubmission>(`/teacher/assignments/${assignmentId}/submissions/${submissionId}`),
  createCourseAnnouncement: (courseId: string, body: { title: string; body: string }) =>
    request<CourseAnnouncement>(`/teacher/courses/${courseId}/announcements`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  listCourseAnnouncements: (courseId: string) =>
    request<CourseAnnouncement[]>(`/teacher/courses/${courseId}/announcements`),
  getTeacherCourseFeedbackSummary: (courseId: string) =>
    request<CourseFeedbackSummary>(`/teacher/courses/${courseId}/feedback`),
  listGradingTasks: () =>
    request<GradingTask[]>('/teacher/grading-tasks'),
  createGradingTask: (body: { title: string; dueAtMs?: number | null; estMinutes: number }) =>
    request<GradingTask>('/teacher/grading-tasks', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deleteGradingTask: (id: string) =>
    request(`/teacher/grading-tasks/${id}`, { method: 'DELETE' }),

  // Student
  listStudentAssignments: () =>
    request<CourseAssignment[]>('/student/assignments'),
  listStudentAssignmentSubmissions: () =>
    request<AssignmentSubmission[]>('/student/assignments/submissions'),
  getStudentAssignmentSubmission: (assignmentId: string) =>
    request<AssignmentSubmission | null>(`/student/assignments/${assignmentId}/submission`),
  submitStudentAssignment: (
    assignmentId: string,
    body: { comment?: string | null; links?: string[] }
  ) =>
    request<AssignmentSubmission>(`/student/assignments/${assignmentId}/submission`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  uploadStudentAssignmentFile: (
    assignmentId: string,
    body: {
      fileName: string;
      mimeType?: string | null;
      contentBase64: string;
    }
  ) =>
    request<AssignmentSubmission>(`/student/assignments/${assignmentId}/submission/files`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  listStudentCourses: () =>
    request<PlannerCourse[]>('/student/courses'),
  joinCourseByCode: (courseCode: string) =>
    request<PlannerCourse>('/student/courses/join-code', {
      method: 'POST',
      body: JSON.stringify({ courseCode }),
    }),
  getStudentCourseDetail: (courseId: string) =>
    request<{ course: PlannerCourse; assignments: CourseAssignment[]; announcements: CourseAnnouncement[] }>(`/student/courses/${courseId}`),
  getStudentCourseFeedback: (courseId: string) =>
    request<CourseFeedbackSubmission | null>(`/student/courses/${courseId}/feedback`),
  submitStudentCourseFeedback: (courseId: string, body: { rating: number; comment?: string | null }) =>
    request<CourseFeedbackSubmission>(`/student/courses/${courseId}/feedback`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  parseAssignmentText: (text: string) =>
    request<ParsedDraft>('/assignments/parse', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  listAssignments: () => request<Assignment[]>('/assignments'),
  createAssignment: (body: Omit<Assignment, 'id' | 'completed'> & { completed?: boolean }) =>
    request<Assignment>('/assignments', {
      method: 'POST',
      body: JSON.stringify({
        ...body,
        dueAt: body.dueAt != null ? body.dueAt : undefined,
        completed: body.completed ?? false,
      }),
    }),
  updateAssignment: (id: string, completed: boolean) =>
    request<Assignment>(`/assignments/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ completed }),
    }),
  deleteAssignment: (id: string) =>
    request(`/assignments/${id}`, { method: 'DELETE' }),

  listAvailability: () => request<AvailabilityBlock[]>('/availability'),
  createAvailability: (startMin: number, endMin: number) =>
    request<AvailabilityBlock>('/availability', {
      method: 'POST',
      body: JSON.stringify({ startMin, endMin }),
    }),
  deleteAvailability: (id: string) =>
    request(`/availability/${id}`, { method: 'DELETE' }),

  createPlan: (sessionMin?: number, now?: string, busyBlocks?: { startMs: number; endMs: number }[]) =>
    request<PlanResult>('/plan', {
      method: 'POST',
      body: JSON.stringify({ sessionMin, now, busyBlocks }),
    }),

  listRequests: (params?: {
    subject?: string;
    urgency?: string;
    status?: string;
    showClosed?: boolean;
  }) => {
    const q = new URLSearchParams();
    if (params?.subject) q.set('subject', params.subject);
    if (params?.urgency) q.set('urgency', params.urgency);
    if (params?.status) q.set('status', params.status);
    if (params?.showClosed) q.set('showClosed', 'true');
    const qs = q.toString();
    return request<HelpRequest[]>(`/requests${qs ? `?${qs}` : ''}`);
  },
  getRequest: (id: string) => request<HelpRequest>(`/requests/${id}`),
  createRequest: (body: {
    title: string;
    description: string;
    subject: string;
    urgency: string;
    linkedAssignmentId?: string | null;
    claimMode?: 'any' | 'teacher_only';
    meetingAbout?: string | null;
    meetingLocation?: string | null;
    meetingLink?: string | null;
    proposedTimes?: string | null;
  }) =>
    request<HelpRequest>('/requests', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  claimRequest: (id: string, claimedBy: string) =>
    request<HelpRequest>(`/requests/${id}/claim`, {
      method: 'POST',
      body: JSON.stringify({ claimedBy }),
    }), // X-User-Email sent via identity headers
  closeRequest: (id: string) =>
    request<HelpRequest>(`/requests/${id}/close`, { method: 'POST' }),
  unclaimRequest: (id: string) =>
    request<HelpRequest>(`/requests/${id}/unclaim`, { method: 'POST' }),
  reportRequest: (id: string, reason: string, details?: string) =>
    request<unknown>(`/requests/${id}/report`, {
      method: 'POST',
      body: JSON.stringify({ reason, details }),
    }),
  getRequestActivity: (id: string) =>
    request<RequestActivityEntry[]>(`/requests/${id}/activity`),
  listComments: (requestId: string) =>
    request<HelpComment[]>(`/requests/${requestId}/comments`),
  addComment: (requestId: string, body: string) =>
    request<HelpComment>(`/requests/${requestId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }), // authorLabel determined by backend from X-User-Email
  listRequestResources: (requestId: string) =>
    request<HelpRequestResource[]>(`/requests/${requestId}/resources`),
  addRequestResourceLink: (
    requestId: string,
    body: { url: string; label?: string | null; note?: string | null }
  ) =>
    request<HelpRequestResource>(`/requests/${requestId}/resources/link`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  uploadRequestResourceFile: (
    requestId: string,
    body: {
      fileName: string;
      mimeType?: string | null;
      contentBase64: string;
      label?: string | null;
      note?: string | null;
    }
  ) =>
    request<HelpRequestResource>(`/requests/${requestId}/resources/file`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  listNotifications: (limit = 50) =>
    request<NotificationRecord[]>(`/notifications?limit=${encodeURIComponent(String(limit))}`),
  getUnreadNotificationCount: () =>
    request<{ count: number }>('/notifications/unread-count'),
  markNotificationRead: (id: string) =>
    request<{ ok: boolean; updated: boolean }>(`/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () =>
    request<{ ok: boolean; updated: number }>('/notifications/read-all', { method: 'POST' }),

  getRequestsSummary: () =>
    request<RequestsSummaryRow[]>('/insights/requests-summary'),
  getInsightsStats: () =>
    request<{ totalOpen: number; totalClaimed: number; totalClosed: number; topSubjectsByOpen: { subject: string; count: number }[] }>('/insights/stats'),
  getReports: () =>
    request<{ reports: unknown[]; countsByReportedEmail: { reportedEmail: string; count: number }[] }>('/insights/reports'),

  cleanupClosed: (days?: number) =>
    request<{ deletedRequests: number; deletedComments: number }>(
      `/admin/cleanup-closed${days != null ? `?days=${days}` : ''}`,
      { method: 'POST' }
    ),

  getBlocklist: () =>
    request<{ id: string; blockedEmail: string; blockedUntil: string; blockedByEmail: string; createdAt: string }[]>('/admin/blocklist'),
  addBlocklist: (blockedEmail: string, blockedUntil: string) =>
    request<unknown>('/admin/blocklist', {
      method: 'POST',
      body: JSON.stringify({ blockedEmail, blockedUntil }),
    }),
};

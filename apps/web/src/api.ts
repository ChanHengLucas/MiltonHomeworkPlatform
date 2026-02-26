const API_BASE = '/api';
const STORAGE_KEY_EMAIL = 'planner_school_email';
const STORAGE_KEY_DISPLAY_NAME = 'planner_display_name';

function getIdentityHeaders(): Record<string, string> {
  try {
    const email = localStorage.getItem(STORAGE_KEY_EMAIL) || '';
    const name = localStorage.getItem(STORAGE_KEY_DISPLAY_NAME) || '';
    const headers: Record<string, string> = {};
    if (email) headers['X-User-Email'] = email;
    if (name) headers['X-User-Name'] = name;
    return headers;
  } catch {
    return {};
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const identityHeaders = getIdentityHeaders();
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...identityHeaders,
      ...options.headers,
    },
  });

  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg =
      (typeof data === 'object' && data !== null && 'error' in data && typeof (data as { error: unknown }).error === 'string')
        ? (data as { error: string }).error
        : `Request failed: ${res.status} ${res.statusText}`;
    console.error('[API]', path, res.status, msg);
    const err = new Error(msg) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  return data as T;
}

export interface AuthUser {
  email: string;
  name: string;
  picture: string | null;
  isTeacher: boolean;
}

async function authRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = path.startsWith('/') ? path : `/${path}`;
  const identityHeaders = getIdentityHeaders();
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...identityHeaders,
      ...options.headers,
    },
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg =
      (typeof data === 'object' && data !== null && 'error' in data && typeof (data as { error: unknown }).error === 'string')
        ? (data as { error: string }).error
        : `Request failed: ${res.status} ${res.statusText}`;
    const err = new Error(msg) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return data as T;
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

export interface HelpRequest {
  id: string;
  title: string;
  description: string;
  subject: string;
  urgency: string;
  status: string;
  createdAt: string;
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

export interface RequestsSummaryRow {
  subject: string;
  urgency: string;
  status: string;
  count: number;
}

export const api = {
  getAuthMe: () => authRequest<AuthUser>('/auth/me'),
  logout: () => authRequest<{ ok: boolean }>('/auth/logout', { method: 'POST' }),

  getCalendarBusy: (days?: number) =>
    request<{ startMs: number; endMs: number; source: string }[]>(
      `/calendar/busy${days != null ? `?days=${days}` : ''}`
    ),

  // Teacher
  listTeacherCourses: () => request<{ id: string; name: string; teacherEmail: string; createdAt: string }[]>('/teacher/courses'),
  createTeacherCourse: (name: string) =>
    request<{ id: string; name: string; teacherEmail: string; createdAt: string }>('/teacher/courses', {
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

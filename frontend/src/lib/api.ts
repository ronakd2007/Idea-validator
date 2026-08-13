const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

// View-as-User token (sessionStorage — tab-scoped by design). Read directly
// here rather than importing auth.ts, mirroring how getToken() works. Never
// attached to /admin paths: the admin portal always acts as the real admin.
function getViewToken(path: string): string | null {
  if (typeof window === 'undefined' || path.startsWith('/admin')) return null;
  try {
    const raw = sessionStorage.getItem('iv_view_as');
    if (!raw) return null;
    const ctx = JSON.parse(raw);
    return ctx?.token || null;
  } catch {
    return null;
  }
}

function exitViewMode(message: string) {
  sessionStorage.removeItem('iv_view_as');
  window.dispatchEvent(new Event('viewas-changed'));
  alert(message);
  window.location.href = '/admin';
}

async function request(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) (headers as any)['Authorization'] = `Bearer ${token}`;
  const viewToken = getViewToken(path);
  if (viewToken) (headers as any)['X-View-As'] = viewToken;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // View-session failures end view mode, never the admin's real login.
    if ((data.code === 'VIEW_AS_EXPIRED' || data.code === 'VIEW_AS_INVALID') && typeof window !== 'undefined') {
      exitViewMode(data.code === 'VIEW_AS_EXPIRED' ? 'View as User session expired.' : 'View session is no longer valid.');
      const err = new Error(data.message || 'View session ended');
      Object.assign(err, data);
      throw err;
    }
    // A 401 on an authenticated request means the stored token is expired or
    // revoked — without this, every page just renders "Request failed" until
    // the user figures out they need to log in again. Login attempts also
    // return 401 but carry no token, so they fall through to normal handling.
    if (res.status === 401 && token && typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      sessionStorage.removeItem('iv_view_as');
      const next = encodeURIComponent(window.location.pathname);
      window.location.href = `/auth/login?next=${next}`;
    }
    const err = new Error(data.message || 'Request failed');
    Object.assign(err, data);
    throw err;
  }
  return data;
}

export const api = {
  // Auth
  sendOtp: (phone: string) => request('/auth/send-otp', { method: 'POST', body: JSON.stringify({ phone }) }),
  registerFounder: (body: any) => request('/auth/register/founder', { method: 'POST', body: JSON.stringify(body) }),
  registerValidator: (body: any) => request('/auth/register/validator', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: any) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  googleLogin: (idToken: string) => request('/auth/google', { method: 'POST', body: JSON.stringify({ idToken }) }),
  googleRegisterFounder: (idToken: string) => request('/auth/google/register-founder', { method: 'POST', body: JSON.stringify({ idToken }) }),
  getProfile: () => request('/auth/profile'),

  // Ideas
  createIdea: (body: any) => request('/ideas', { method: 'POST', body: JSON.stringify(body) }),
  getMyIdeas: () => request('/ideas/my'),
  getAllIdeas: () => request('/ideas'),
  getIdea: (id: string) => request(`/ideas/${id}`),
  getIdeaDashboard: (id: string) => request(`/ideas/${id}/dashboard`),
  reviseIdea: (id: string, body: any) => request(`/ideas/${id}/revise`, { method: 'POST', body: JSON.stringify(body) }),
  // Records that the founder generated the PDF; the file itself is built in the browser.
  recordReportDownload: (id: string) => request(`/ideas/${id}/report-downloaded`, { method: 'POST' }),

  // Validation
  submitValidation: (ideaId: string, body: any) => request(`/validation/${ideaId}`, { method: 'POST', body: JSON.stringify(body) }),
  getValidationHistory: () => request('/validation/history'),
  checkAlreadyValidated: (ideaId: string) => request(`/validation/check/${ideaId}`),

  // Payment
  getPaymentConfig: () => request('/payment/config'),
  mockPayment: (ideaId: string) => request(`/payment/mock/${ideaId}`, { method: 'POST' }),

  // Idea sharing (public validation page)
  enableIdeaShare: (id: string, settings?: any) =>
    request(`/ideas/${id}/share`, { method: 'POST', body: JSON.stringify({ settings }) }),
  updateIdeaShareSettings: (id: string, settings: any) =>
    request(`/ideas/${id}/share`, { method: 'PATCH', body: JSON.stringify({ settings }) }),
  disableIdeaShare: (id: string) => request(`/ideas/${id}/share`, { method: 'DELETE' }),
  getPublicIdea: (publicId: string) => request(`/public/ideas/${publicId}`),
  getIdeaVersions: (id: string) => request(`/ideas/${id}/versions`),

  // AI
  getAiSummary: (ideaId: string, refresh = false) => request(`/ai/summary/${ideaId}${refresh ? '?refresh=true' : ''}`),
  generateSurveyDraft: (rawText: string) => request('/ai/generate-survey', { method: 'POST', body: JSON.stringify({ rawText }) }),

  // Mass Survey
  createSurvey: (body: { ideaId?: string; title: string; description?: string }) =>
    request('/surveys', { method: 'POST', body: JSON.stringify(body) }),
  getMySurveys: () => request('/surveys/my'),
  getSurvey: (id: string) => request(`/surveys/${id}`),
  updateSurvey: (id: string, body: any) => request(`/surveys/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteSurvey: (id: string) => request(`/surveys/${id}`, { method: 'DELETE' }),
  publishSurvey: (id: string) => request(`/surveys/${id}/publish`, { method: 'POST' }),
  closeSurvey: (id: string) => request(`/surveys/${id}/close`, { method: 'POST' }),
  reopenSurvey: (id: string) => request(`/surveys/${id}/reopen`, { method: 'POST' }),
  getSurveyResponses: (id: string, opts: { page?: number; pageSize?: number; quality?: string; search?: string; questionId?: string } = {}) => {
    const params = new URLSearchParams();
    if (opts.page) params.set('page', String(opts.page));
    if (opts.pageSize) params.set('pageSize', String(opts.pageSize));
    if (opts.quality) params.set('quality', opts.quality);
    if (opts.search) params.set('search', opts.search);
    if (opts.questionId) params.set('questionId', opts.questionId);
    const qs = params.toString();
    return request(`/surveys/${id}/responses${qs ? `?${qs}` : ''}`);
  },
  getSurveyAnalytics: (id: string, opts: { range?: string; outcomeQuestionId?: string; segmentQuestionId?: string } = {}) => {
    const params = new URLSearchParams();
    if (opts.range) params.set('range', opts.range);
    if (opts.outcomeQuestionId) params.set('outcomeQuestionId', opts.outcomeQuestionId);
    if (opts.segmentQuestionId) params.set('segmentQuestionId', opts.segmentQuestionId);
    const qs = params.toString();
    return request(`/surveys/${id}/analytics${qs ? `?${qs}` : ''}`);
  },
  exportSurveyResponses: async (id: string) => {
    const token = getToken();
    const headers: HeadersInit = {};
    if (token) (headers as any)['Authorization'] = `Bearer ${token}`;
    const viewToken = getViewToken(`/surveys/${id}/export`);
    if (viewToken) (headers as any)['X-View-As'] = viewToken;
    const res = await fetch(`${BASE}/surveys/${id}/export`, { headers });
    if (!res.ok) throw new Error('Export failed');
    return res.text();
  },
  createSurveyVersion: (id: string) => request(`/surveys/${id}/versions`, { method: 'POST' }),
  getSurveyVersions: (id: string) => request(`/surveys/${id}/versions`),
  upsertSurveyIncentive: (id: string, body: any) => request(`/surveys/${id}/incentive`, { method: 'PATCH', body: JSON.stringify(body) }),
  removeSurveyIncentive: (id: string) => request(`/surveys/${id}/incentive`, { method: 'DELETE' }),

  // Public Survey (unauthenticated respondent flow)
  getPublicSurvey: (publicId: string, sessionToken?: string) =>
    request(`/public/surveys/${publicId}${sessionToken ? `?session=${encodeURIComponent(sessionToken)}` : ''}`),
  startPublicSurveySession: (publicId: string) => request(`/public/surveys/${publicId}/sessions`, { method: 'POST' }),
  updatePublicSurveyProgress: (publicId: string, sessionToken: string, questionIndex: number) =>
    request(`/public/surveys/${publicId}/sessions/progress`, { method: 'PATCH', body: JSON.stringify({ sessionToken, questionIndex }) }),
  submitPublicSurveyResponse: (publicId: string, body: any) =>
    request(`/public/surveys/${publicId}/responses`, { method: 'POST', body: JSON.stringify(body) }),
  submitIncentiveEntry: (publicId: string, name: string, contact: string) =>
    request(`/public/surveys/${publicId}/incentive-entry`, { method: 'POST', body: JSON.stringify({ name, contact }) }),

  // Admin
  getAnalytics: () => request('/admin/analytics'),
  getUsers: (role?: string) => request(`/admin/users${role ? `?role=${role}` : ''}`),
  getPendingValidators: () => request('/admin/validators/pending'),
  approveValidator: (id: string) => request(`/admin/validators/${id}/approve`, { method: 'PATCH' }),
  rejectValidator: (id: string) => request(`/admin/validators/${id}/reject`, { method: 'PATCH' }),
  getAdminIdeas: () => request('/admin/ideas'),
  deleteIdea: (id: string) => request(`/admin/ideas/${id}`, { method: 'DELETE' }),

  // Admin — View as User
  startViewAs: (userId: string) => request(`/admin/view-as/${userId}`, { method: 'POST' }),
  endViewAs: (targetUserId?: string) => request('/admin/view-as/end', { method: 'POST', body: JSON.stringify({ targetUserId }) }),
  toggleUserStatus: (id: string) => request(`/admin/users/${id}/toggle-status`, { method: 'PATCH' }),
  adminDeleteUser: (id: string) => request(`/admin/users/${id}`, { method: 'DELETE' }),
  getAdminSurveys: () => request('/admin/surveys'),
  adminToggleSurveyStatus: (id: string) => request(`/admin/surveys/${id}/toggle-status`, { method: 'PATCH' }),
  adminDeleteSurvey: (id: string) => request(`/admin/surveys/${id}`, { method: 'DELETE' }),

  // Admin — Activity feed
  getAdminActivity: (opts: { search?: string; role?: string; category?: string; from?: string; to?: string; page?: number; pageSize?: number } = {}) => {
    const params = new URLSearchParams();
    if (opts.search) params.set('search', opts.search);
    if (opts.role && opts.role !== 'ALL') params.set('role', opts.role);
    if (opts.category && opts.category !== 'ALL') params.set('category', opts.category);
    if (opts.from) params.set('from', opts.from);
    if (opts.to) params.set('to', opts.to);
    if (opts.page) params.set('page', String(opts.page));
    if (opts.pageSize) params.set('pageSize', String(opts.pageSize));
    const qs = params.toString();
    return request(`/admin/activity${qs ? `?${qs}` : ''}`);
  },
  getAdminActivitySummary: () => request('/admin/activity/summary'),
  getAdminActivityDetail: (id: string) => request(`/admin/activity/${id}`),

  // Admin — data inspection
  getAdminUserOverview: (id: string) => request(`/admin/users/${id}/overview`),
  getAdminUserActivity: (id: string, limit?: number) =>
    request(`/admin/users/${id}/activity${limit ? `?limit=${limit}` : ''}`),
  getAdminIdeaDashboard: (id: string) => request(`/admin/ideas/${id}/dashboard`),
  getAdminIdeaActivity: (id: string) => request(`/admin/ideas/${id}/activity`),
  getAdminSurveyDetail: (id: string) => request(`/admin/surveys/${id}/detail`),
  getAdminSurveyResponses: (id: string, opts: { page?: number; pageSize?: number; quality?: string; search?: string } = {}) => {
    const params = new URLSearchParams();
    if (opts.page) params.set('page', String(opts.page));
    if (opts.pageSize) params.set('pageSize', String(opts.pageSize));
    if (opts.quality) params.set('quality', opts.quality);
    if (opts.search) params.set('search', opts.search);
    const qs = params.toString();
    return request(`/admin/surveys/${id}/responses${qs ? `?${qs}` : ''}`);
  },
  getAdminSurveyAnalytics: (id: string) => request(`/admin/surveys/${id}/analytics`),
  getAdminSurveyActivity: (id: string) => request(`/admin/surveys/${id}/activity`),
};

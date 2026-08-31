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
  // Deleting an idea cascades into its validations, surveys and responses, so
  // the server demands confirmTitle once any of those exist.
  getIdeaDeleteImpact: (id: string) => request(`/ideas/${id}/delete-impact`),
  deleteMyIdea: (id: string, confirmTitle?: string) =>
    request(`/ideas/${id}`, { method: 'DELETE', body: JSON.stringify({ confirmTitle }) }),

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
  // Full shared report — the founder's dashboard content for link holders.
  getPublicIdeaReport: (publicId: string) => request(`/public/ideas/${publicId}/report`),
  getIdeaVersions: (id: string) => request(`/ideas/${id}/versions`),

  // AI
  getAiSummary: (ideaId: string, refresh = false) => request(`/ai/summary/${ideaId}${refresh ? '?refresh=true' : ''}`),
  generateSurveyDraft: (rawText: string) => request('/ai/generate-survey', { method: 'POST', body: JSON.stringify({ rawText }) }),
  generateGapSurvey: (ideaId: string, gapKey: string) => request('/ai/gap-survey', { method: 'POST', body: JSON.stringify({ ideaId, gapKey }) }),
  getIdeaBenchmark: (id: string) => request(`/ideas/${id}/benchmark`),
  updateIdeaAssumptions: (id: string, assumptions: { statement: string; category?: string }[]) =>
    request(`/ideas/${id}/assumptions`, { method: 'PATCH', body: JSON.stringify({ assumptions }) }),
  suggestAssumptions: (input: { ideaId?: string; draft?: any }) =>
    request('/ai/suggest-assumptions', { method: 'POST', body: JSON.stringify(input) }),

  // Push to cloud — copies an idea into the live site's database. Only enabled
  // on a server with CLOUD_DATABASE_URL set, i.e. a local dev machine.
  getCloudPushStatus: () => request('/cloud/status'),
  pushIdeaToCloud: (ideaId: string) => request(`/cloud/push/${ideaId}`, { method: 'POST' }),

  // AI Deep Dive — autonomous research runs. Runs usually start themselves when
  // the idea is paid for; this is the manual start for older ideas and retries.
  runAiDeepDive: (ideaId: string) => request(`/ai/agent/run/${ideaId}`, { method: 'POST' }),
  getLatestAiDeepDive: (ideaId: string) => request(`/ai/agent/latest/${ideaId}`),
  listAiDeepDiveRuns: (ideaId: string) => request(`/ai/agent/runs/${ideaId}`),

  // Mass Survey
  createSurvey: (body: { ideaId?: string; title: string; description?: string }) =>
    request('/surveys', { method: 'POST', body: JSON.stringify(body) }),
  getMySurveys: () => request('/surveys/my'),
  getSurvey: (id: string) => request(`/surveys/${id}`),
  updateSurvey: (id: string, body: any) => request(`/surveys/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  // confirmTitle is required by the server once the survey holds responses.
  getSurveyDeleteImpact: (id: string) => request(`/surveys/${id}/delete-impact`),
  deleteSurvey: (id: string, confirmTitle?: string) =>
    request(`/surveys/${id}`, { method: 'DELETE', body: JSON.stringify({ confirmTitle }) }),
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
  // Public results link — owner controls. The link itself is read through the
  // unauthenticated getPublicSurveyReport* helpers below.
  getSurveyShare: (id: string) => request(`/surveys/${id}/share`),
  enableSurveyShare: (id: string, settings?: any) =>
    request(`/surveys/${id}/share`, { method: 'POST', body: JSON.stringify({ settings }) }),
  updateSurveyShareSettings: (id: string, settings: any) =>
    request(`/surveys/${id}/share`, { method: 'PATCH', body: JSON.stringify({ settings }) }),
  disableSurveyShare: (id: string) => request(`/surveys/${id}/share`, { method: 'DELETE' }),

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
  heartbeatPublicSurveySession: (publicId: string, sessionToken: string) =>
    request(`/public/surveys/${publicId}/sessions/heartbeat`, { method: 'PATCH', body: JSON.stringify({ sessionToken }) }),
  submitPublicSurveyResponse: (publicId: string, body: any) =>
    request(`/public/surveys/${publicId}/responses`, { method: 'POST', body: JSON.stringify(body) }),
  submitIncentiveEntry: (publicId: string, name: string, contact: string) =>
    request(`/public/surveys/${publicId}/incentive-entry`, { method: 'POST', body: JSON.stringify({ name, contact }) }),

  // Public survey results (unauthenticated — anyone with the share link)
  getPublicSurveyReport: (shareId: string, opts: { range?: string; outcomeQuestionId?: string; segmentQuestionId?: string } = {}) => {
    const qs = new URLSearchParams();
    if (opts.range) qs.set('range', opts.range);
    if (opts.outcomeQuestionId) qs.set('outcomeQuestionId', opts.outcomeQuestionId);
    if (opts.segmentQuestionId) qs.set('segmentQuestionId', opts.segmentQuestionId);
    const s = qs.toString();
    return request(`/public/survey-reports/${shareId}${s ? `?${s}` : ''}`);
  },
  getPublicSurveyReportQuestions: (shareId: string) => request(`/public/survey-reports/${shareId}/questions`),
  getPublicSurveyReportResponses: (shareId: string, opts: { page?: number; pageSize?: number; quality?: string; search?: string; questionId?: string } = {}) => {
    const params = new URLSearchParams();
    if (opts.page) params.set('page', String(opts.page));
    if (opts.pageSize) params.set('pageSize', String(opts.pageSize));
    if (opts.quality) params.set('quality', opts.quality);
    if (opts.search) params.set('search', opts.search);
    if (opts.questionId) params.set('questionId', opts.questionId);
    const qs = params.toString();
    return request(`/public/survey-reports/${shareId}/responses${qs ? `?${qs}` : ''}`);
  },

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

  // AI Validation Assistant — conversation CRUD. Sending/regenerating a
  // message goes through streamChatMessage() below instead, since those
  // responses stream rather than resolving a single JSON body.
  // Short-lived permission slip for a direct browser → Cloudinary video upload.
  // Founder rates how useful an expert review was (1 = not helpful, 3 = very).
  rateValidation: (validationId: string, rating: number) =>
    request(`/validation/${validationId}/rating`, { method: 'PATCH', body: JSON.stringify({ rating }) }),

  getVideoUploadSignature: () => request('/uploads/video-signature', { method: 'POST' }),
  getImageUploadSignature: () => request('/uploads/image-signature', { method: 'POST' }),

  // Startup Directory — founder listing management
  getStartupForIdea: (ideaId: string) => request(`/startups/idea/${ideaId}`),
  saveStartupForIdea: (ideaId: string, body: any) =>
    request(`/startups/idea/${ideaId}`, { method: 'PUT', body: JSON.stringify(body) }),

  // Startup Directory — admin review queue
  getAdminStartups: (status?: string) =>
    request(`/admin/startups${status && status !== 'ALL' ? `?status=${encodeURIComponent(status)}` : ''}`),
  getAdminStartup: (id: string) => request(`/admin/startups/${id}`),
  reviewStartup: (id: string, body: { action: string; reviewMessage?: string; adminNote?: string }) =>
    request(`/admin/startups/${id}/review`, { method: 'PATCH', body: JSON.stringify(body) }),

  // Startup Directory — public (no auth)
  getPublicStartups: (filters: { industry?: string; location?: string; stage?: string; lookingFor?: string } = {}) => {
    const p = new URLSearchParams();
    if (filters.industry) p.set('industry', filters.industry);
    if (filters.location) p.set('location', filters.location);
    if (filters.stage) p.set('stage', filters.stage);
    if (filters.lookingFor) p.set('lookingFor', filters.lookingFor);
    const qs = p.toString();
    return request(`/public/startups${qs ? `?${qs}` : ''}`);
  },
  getPublicStartup: (slug: string) => request(`/public/startups/${slug}`),

  // ---------- Innovation & Patent Registry ----------
  //
  // Publication needs two locks: the founder ticks "make public" (which only
  // submits it for review) and an admin approves. Nothing here can approve.

  // Founder — their own records, private by default
  getMyIpRecords: () => request('/ip'),
  getIpRecord: (id: string) => request(`/ip/${id}`),
  createIpRecord: (body: any) => request('/ip', { method: 'POST', body: JSON.stringify(body) }),
  updateIpRecord: (id: string, body: any) => request(`/ip/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteIpRecord: (id: string) => request(`/ip/${id}`, { method: 'DELETE' }),
  addIpDocument: (id: string, body: { fileUrl: string; fileName: string; documentType?: string }) =>
    request(`/ip/${id}/documents`, { method: 'POST', body: JSON.stringify(body) }),
  deleteIpDocument: (id: string, documentId: string) =>
    request(`/ip/${id}/documents/${documentId}`, { method: 'DELETE' }),
  getDocumentUploadSignature: () => request('/uploads/document-signature', { method: 'POST' }),

  // Admin — review queue and ecosystem analytics
  getAdminIpRecords: (filters: Record<string, string | undefined> = {}) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v && v !== 'ALL') p.set(k, v);
    const qs = p.toString();
    return request(`/admin/ip${qs ? `?${qs}` : ''}`);
  },
  getAdminIpRecord: (id: string) => request(`/admin/ip/${id}`),
  getAdminIpStats: () => request('/admin/ip/stats'),
  getAdminIpAnalytics: () => request('/admin/ip/analytics'),
  reviewIpRecord: (id: string, body: { action: string; reviewMessage?: string; adminNote?: string }) =>
    request(`/admin/ip/${id}/review`, { method: 'PATCH', body: JSON.stringify(body) }),

  // Public registry (no auth) — only approved + opted-in records exist here
  getPublicIpRecords: (filters: { type?: string; status?: string; state?: string; industry?: string; q?: string } = {}) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) p.set(k, v);
    const qs = p.toString();
    return request(`/public/ip${qs ? `?${qs}` : ''}`);
  },
  getPublicIpRecord: (id: string) => request(`/public/ip/${id}`),

  getIdeaChat: (ideaId: string) => request(`/chat/ideas/${ideaId}`),
  newIdeaChat: (ideaId: string) => request(`/chat/ideas/${ideaId}/new`, { method: 'POST' }),
  deleteIdeaChat: (ideaId: string) => request(`/chat/ideas/${ideaId}`, { method: 'DELETE' }),
  getSurveyChat: (surveyId: string) => request(`/chat/surveys/${surveyId}`),
  newSurveyChat: (surveyId: string) => request(`/chat/surveys/${surveyId}/new`, { method: 'POST' }),
  deleteSurveyChat: (surveyId: string) => request(`/chat/surveys/${surveyId}`, { method: 'DELETE' }),
};

export type ChatReportKind = 'ideas' | 'surveys';

// Streams an assistant reply chunk-by-chunk via fetch's ReadableStream reader
// (not EventSource — it can't POST or carry an Authorization header). The
// backend frames each event as a standard SSE `data: {...}\n\n` line; this
// buffers partial frames across chunk boundaries and dispatches one callback
// per complete event as it arrives.
export async function streamChatMessage(
  kind: ChatReportKind,
  id: string,
  options: { content: string } | { regenerate: true },
  handlers: {
    onDelta: (text: string) => void;
    onDone: (messageId: string | null) => void;
    onError: (message: string) => void;
  },
  signal?: AbortSignal
): Promise<void> {
  const isRegenerate = 'regenerate' in options && options.regenerate;
  const path = `/chat/${kind}/${id}/${isRegenerate ? 'regenerate' : 'messages'}`;

  const token = getToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) (headers as any)['Authorization'] = `Bearer ${token}`;
  const viewToken = getViewToken(path);
  if (viewToken) (headers as any)['X-View-As'] = viewToken;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(isRegenerate ? {} : { content: (options as { content: string }).content }),
      signal,
    });
  } catch (err: any) {
    if (err.name === 'AbortError') return;
    handlers.onError('Could not reach the server. Check your connection and try again.');
    return;
  }

  if (!res.ok || !res.body) {
    let message = 'Something went wrong. Please try again.';
    try { message = (await res.json()).message || message; } catch { /* non-JSON error body */ }
    handlers.onError(message);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split('\n\n');
      buffer = frames.pop() || '';
      for (const frame of frames) {
        const dataLine = frame.split('\n').find((l) => l.startsWith('data: '));
        if (!dataLine) continue;
        let payload: any;
        try { payload = JSON.parse(dataLine.slice(6)); } catch { continue; }
        if (payload.type === 'delta') handlers.onDelta(payload.content);
        else if (payload.type === 'done') handlers.onDone(payload.messageId ?? null);
        else if (payload.type === 'error') handlers.onError(payload.message || 'Something went wrong.');
      }
    }
  } catch (err: any) {
    // AbortError means the caller clicked Stop — that's an intentional,
    // silent end, not a failure to surface.
    if (err.name !== 'AbortError') handlers.onError('Connection lost while generating a response.');
  }
}

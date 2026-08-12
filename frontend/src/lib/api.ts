const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

async function request(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: HeadersInit = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) (headers as any)['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
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

  // Validation
  submitValidation: (ideaId: string, body: any) => request(`/validation/${ideaId}`, { method: 'POST', body: JSON.stringify(body) }),
  getValidationHistory: () => request('/validation/history'),
  checkAlreadyValidated: (ideaId: string) => request(`/validation/check/${ideaId}`),

  // Payment
  getPaymentConfig: () => request('/payment/config'),
  mockPayment: (ideaId: string) => request(`/payment/mock/${ideaId}`, { method: 'POST' }),

  // AI
  getAiSummary: (ideaId: string) => request(`/ai/summary/${ideaId}`),
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
  toggleUserStatus: (id: string) => request(`/admin/users/${id}/toggle-status`, { method: 'PATCH' }),
  getAdminSurveys: () => request('/admin/surveys'),
  adminToggleSurveyStatus: (id: string) => request(`/admin/surveys/${id}/toggle-status`, { method: 'PATCH' }),
  adminDeleteSurvey: (id: string) => request(`/admin/surveys/${id}`, { method: 'DELETE' }),
};

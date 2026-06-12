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
    throw new Error(data.message || 'Request failed');
  }
  return data;
}

export const api = {
  // Auth
  sendOtp: (phone: string) => request('/auth/send-otp', { method: 'POST', body: JSON.stringify({ phone }) }),
  registerFounder: (body: any) => request('/auth/register/founder', { method: 'POST', body: JSON.stringify(body) }),
  registerValidator: (body: any) => request('/auth/register/validator', { method: 'POST', body: JSON.stringify(body) }),
  login: (body: any) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
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

  // Admin
  getAnalytics: () => request('/admin/analytics'),
  getUsers: (role?: string) => request(`/admin/users${role ? `?role=${role}` : ''}`),
  getPendingValidators: () => request('/admin/validators/pending'),
  approveValidator: (id: string) => request(`/admin/validators/${id}/approve`, { method: 'PATCH' }),
  rejectValidator: (id: string) => request(`/admin/validators/${id}/reject`, { method: 'PATCH' }),
  getAdminIdeas: () => request('/admin/ideas'),
  deleteIdea: (id: string) => request(`/admin/ideas/${id}`, { method: 'DELETE' }),
  toggleUserStatus: (id: string) => request(`/admin/users/${id}/toggle-status`, { method: 'PATCH' }),
};

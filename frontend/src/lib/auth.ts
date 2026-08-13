// ---------------------------------------------------------------------------
// Real identity (localStorage) + optional View-as-User shadow (sessionStorage).
//
// getStoredUser() is what every founder/validator page already calls to answer
// "who am I" — in view mode it returns the VIEWED user, which is exactly what
// makes the existing pages render the target's experience with zero
// duplication. Admin pages and the banner call getRealUser(), which ignores
// the shadow entirely, so the admin portal always operates as the real admin.
//
// The view context lives in sessionStorage on purpose: it is confined to the
// one tab it was started in and vanishes when that tab closes.
// ---------------------------------------------------------------------------

const VIEW_KEY = 'iv_view_as';

export interface ViewAsContext {
  token: string;
  expiresAt: string;
  target: { id: string; name: string; role: string; isActive: boolean };
}

export function getRealUser() {
  if (typeof window === 'undefined') return null;
  const u = localStorage.getItem('user');
  return u ? JSON.parse(u) : null;
}

export function getViewContext(): ViewAsContext | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(VIEW_KEY);
    if (!raw) return null;
    const ctx: ViewAsContext = JSON.parse(raw);
    if (!ctx?.token || !ctx?.target?.id) { sessionStorage.removeItem(VIEW_KEY); return null; }
    if (new Date(ctx.expiresAt).getTime() <= Date.now()) { sessionStorage.removeItem(VIEW_KEY); return null; }
    return ctx;
  } catch {
    sessionStorage.removeItem(VIEW_KEY);
    return null;
  }
}

export function setViewContext(ctx: ViewAsContext) {
  sessionStorage.setItem(VIEW_KEY, JSON.stringify(ctx));
  window.dispatchEvent(new Event('viewas-changed'));
}

export function clearViewContext() {
  sessionStorage.removeItem(VIEW_KEY);
  window.dispatchEvent(new Event('viewas-changed'));
}

export function isViewMode(): boolean {
  return getViewContext() !== null;
}

/**
 * The identity the app should RENDER for. Normal sessions: the logged-in
 * user. View mode: the viewed target, flagged with viewAs so identity chrome
 * (Navbar, sidebar) can label it honestly instead of impersonating.
 */
export function getStoredUser() {
  const real = getRealUser();
  const view = getViewContext();
  if (view && real?.role === 'ADMIN') {
    return { id: view.target.id, name: view.target.name, role: view.target.role, viewAs: true };
  }
  return real;
}

export function getStoredToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export function storeAuth(token: string, user: any) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  if (typeof window !== 'undefined') sessionStorage.removeItem(VIEW_KEY);
}

export function isLoggedIn() {
  return !!getStoredToken();
}

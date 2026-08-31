// Shared presentation helpers for the admin Activity feature. Kept in one
// place so the feed, the detail panel and the per-user history all label and
// colour the same activity identically.

export const ROLE_STYLE: Record<string, string> = {
  FOUNDER: 'bg-blue-50 text-blue-700',
  VALIDATOR: 'bg-emerald-50 text-emerald-700',
  RESPONDENT: 'bg-violet-50 text-violet-700',
  ADMIN: 'bg-slate-100 text-slate-700',
};

export const CATEGORY_STYLE: Record<string, string> = {
  ACCOUNT: 'bg-slate-100 text-slate-700',
  IDEAS: 'bg-amber-50 text-amber-700',
  SURVEYS: 'bg-indigo-50 text-indigo-700',
  RESPONSES: 'bg-violet-50 text-violet-700',
  VALIDATIONS: 'bg-emerald-50 text-emerald-700',
  REPORTS: 'bg-teal-50 text-teal-700',
  ADMIN: 'bg-red-50 text-red-700',
};

export const SURVEY_STATUS_STYLE: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  LIVE: 'bg-emerald-50 text-emerald-700',
  CLOSED: 'bg-amber-50 text-amber-700',
};

export const ACTIVITY_ROLES = ['ALL', 'FOUNDER', 'VALIDATOR', 'RESPONDENT', 'ADMIN'];

// Labels match the categories the backend assigns in ACTION_CATALOG.
export const ACTIVITY_CATEGORIES: { value: string; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'IDEAS', label: 'Ideas' },
  { value: 'SURVEYS', label: 'Surveys' },
  { value: 'VALIDATIONS', label: 'Validations' },
  { value: 'RESPONSES', label: 'Responses' },
  { value: 'IP', label: 'IP & Patents' },
  { value: 'REPORTS', label: 'Reports' },
  { value: 'ACCOUNT', label: 'Account' },
  { value: 'ADMIN', label: 'Admin' },
];

export const DATE_RANGES = [
  { value: 'TODAY', label: 'Today' },
  { value: '7D', label: 'Last 7 days' },
  { value: '30D', label: 'Last 30 days' },
  { value: 'ALL', label: 'All time' },
  { value: 'CUSTOM', label: 'Custom' },
];

/** Start date for a named range, or null for "everything". */
export function rangeStart(range: string): string | undefined {
  const now = new Date();
  if (range === 'TODAY') {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  if (range === '7D') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  if (range === '30D') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  return undefined;
}

export function timeAgo(value: string | Date): string {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '—';
  const seconds = Math.floor((Date.now() - then) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  return new Date(value).toLocaleDateString();
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Where an activity's target can be opened in the admin portal, if anywhere. */
export function targetHref(a: { targetType?: string | null; targetId?: string | null; metadata?: any }): string | null {
  if (!a.targetId) return null;
  if (a.targetType === 'IDEA') return `/admin/ideas/${a.targetId}`;
  if (a.targetType === 'SURVEY') return `/admin/surveys/${a.targetId}`;
  if (a.targetType === 'USER') return `/admin/users/${a.targetId}`;
  // A validation is always reviewed in the context of its idea.
  if (a.targetType === 'VALIDATION' && a.metadata?.ideaId) return `/admin/ideas/${a.metadata.ideaId}`;
  return null;
}

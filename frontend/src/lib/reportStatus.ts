// Shared status/threshold logic for the idea validation dashboard AND the
// downloadable PDF report — one source of truth for score cutoffs and labels,
// so the two never drift. Each renderer (DOM vs PDF) maps `tone` to its own
// color system — the thresholds and wording are what must stay identical.

export type Tone = 'positive' | 'strong' | 'neutral' | 'warning' | 'critical';

export const MATRIX_CATEGORIES = [
  { key: 'marketOpportunityAvg', label: 'Market Opportunity', short: 'Market' },
  { key: 'feasibilityAvg', label: 'Feasibility', short: 'Feasibility' },
  { key: 'founderFitAvg', label: 'Founder Fit', short: 'Founder Fit' },
  { key: 'revenuePotentialAvg', label: 'Revenue Potential', short: 'Revenue' },
  { key: 'scalabilityAvg', label: 'Scalability', short: 'Scale' },
  { key: 'innovationAvg', label: 'Innovation', short: 'Innovation' },
  { key: 'socialImpactAvg', label: 'Social Impact', short: 'Social' },
  { key: 'investorAttractivenessAvg', label: 'Investor Attractiveness', short: 'Investor' },
] as const;

export const RISK_LABELS: Record<string, string> = {
  competition: 'Competition',
  regulatory: 'Regulatory',
  technology: 'Technology',
  funding: 'Funding',
  marketAdoption: 'Market Adoption',
};

export function breakdownStatus(pct: number): { label: string; tone: Tone } {
  if (pct >= 85) return { label: 'Excellent', tone: 'positive' };
  if (pct >= 70) return { label: 'Strong', tone: 'strong' };
  if (pct >= 50) return { label: 'Average', tone: 'neutral' };
  if (pct >= 30) return { label: 'Needs Work', tone: 'warning' };
  return { label: 'Critical', tone: 'critical' };
}

export function riskTone(level: string): Tone {
  if (level === 'LOW') return 'positive';
  if (level === 'MEDIUM') return 'warning';
  return 'critical';
}

export const RISK_LABEL: Record<string, string> = { LOW: 'Low Risk', MEDIUM: 'Medium Risk', HIGH: 'High Risk' };

export function dominantRisk(counts: { LOW?: number; MEDIUM?: number; HIGH?: number }) {
  const entries: [string, number][] = [
    ['LOW', counts.LOW || 0],
    ['MEDIUM', counts.MEDIUM || 0],
    ['HIGH', counts.HIGH || 0],
  ];
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][1] > 0 ? entries[0][0] : 'LOW';
}

export function successLabel(score: number): { label: string; tone: Tone } {
  if (score >= 90) return { label: 'Very High Potential', tone: 'positive' };
  if (score >= 80) return { label: 'High Potential', tone: 'positive' };
  if (score >= 70) return { label: 'Good Potential', tone: 'strong' };
  if (score >= 60) return { label: 'Moderate Potential', tone: 'warning' };
  return { label: 'High Risk', tone: 'critical' };
}

// Used for the customer-validation percentages (would-use, would-pay, etc.)
export function pctTone(pct: number): Tone {
  if (pct >= 60) return 'positive';
  if (pct >= 40) return 'warning';
  return 'critical';
}

export function sharkLabel(score: number): { label: string; tone: Tone } {
  if (score >= 80) return { label: 'Excellent', tone: 'positive' };
  if (score >= 60) return { label: 'Good', tone: 'strong' };
  if (score >= 40) return { label: 'Fair', tone: 'warning' };
  return { label: 'Weak', tone: 'critical' };
}

// DOM (Tailwind) color mapping — used by the dashboard.
export const TONE_DOM: Record<Tone, { text: string; bg: string; border: string; bar: string; chip: string }> = {
  positive: { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', bar: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700' },
  strong: { text: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', bar: 'bg-blue-600', chip: 'bg-blue-50 text-blue-700' },
  neutral: { text: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', bar: 'bg-slate-400', chip: 'bg-slate-100 text-slate-700' },
  warning: { text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', bar: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700' },
  critical: { text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', bar: 'bg-red-500', chip: 'bg-red-50 text-red-700' },
};

// Some test/demo ideas end up with a URL pasted into the title field instead
// of a real name. A report is a document that leaves the app — it must never
// surface an internal route, localhost address, or raw API URL as the idea's
// name, so this is checked at render time rather than trusting the stored value.
const URL_LIKE = /^(https?:\/\/|www\.)|localhost|:\/\//i;
export function sanitizeIdeaTitle(title?: string | null): string {
  const t = (title || '').trim();
  if (!t || URL_LIKE.test(t)) return 'Untitled Idea';
  return t;
}

export interface MatrixCategory {
  key: string;
  label: string;
  short: string;
  score: number;
  pct: number;
}

// Picks the single strongest/weakest category — but only when there genuinely
// is a single one. A tie at the top (or bottom) means there is no "biggest"
// anything, and arbitrarily picking the first alphabetically/positionally is
// exactly the bug that made "Market Opportunity" show up as both the biggest
// strength AND the biggest risk when every category scored identically.
export function resolveStrongestWeakest(matrix: MatrixCategory[]): { strongest: MatrixCategory | null; weakest: MatrixCategory | null } {
  if (matrix.length < 2) return { strongest: null, weakest: null };
  const maxPct = Math.max(...matrix.map((c) => c.pct));
  const minPct = Math.min(...matrix.map((c) => c.pct));
  const top = matrix.filter((c) => c.pct === maxPct);
  const bottom = matrix.filter((c) => c.pct === minPct);
  return {
    strongest: top.length === 1 ? top[0] : null,
    weakest: bottom.length === 1 ? bottom[0] : null,
  };
}

// A coarse, rule-based read on how far along validation is — used only to
// frame the evidence honestly, never as a score or a recommendation.
export function validationStage(totalValidations: number): string {
  if (totalValidations === 0) return 'Pre-validation';
  if (totalValidations < 3) return 'Early-stage validation';
  if (totalValidations < 10) return 'Developing validation';
  return 'Active validation';
}

// PDF (hex) color mapping — used by the report components.
export const TONE_PDF: Record<Tone, { text: string; bg: string; border: string; bar: string }> = {
  positive: { text: '#059669', bg: '#ecfdf5', border: '#a7f3d0', bar: '#10b981' },
  strong: { text: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', bar: '#2563eb' },
  neutral: { text: '#475569', bg: '#f1f5f9', border: '#e2e8f0', bar: '#94a3b8' },
  warning: { text: '#b45309', bg: '#fffbeb', border: '#fde68a', bar: '#f59e0b' },
  critical: { text: '#b91c1c', bg: '#fef2f2', border: '#fecaca', bar: '#ef4444' },
};

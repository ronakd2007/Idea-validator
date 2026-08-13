// ---------------------------------------------------------------------------
// Shared inline-validation helpers. One rule everywhere: a form never lets the
// user continue with missing/short input — it blocks, highlights the exact
// field, and says specifically what is wrong ("needs at least 10 characters —
// currently 4"), then scrolls the first mistake into view.
//
// Length rules deliberately mirror the backend DTOs, so anything that passes
// here also passes the server — users should never see a raw server 400.
// ---------------------------------------------------------------------------

export type FieldErrors = Record<string, string>;

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
export const isUrl = (v: string) => /^https?:\/\/\S+\.\S+/.test(v.trim());
// Mirrors the backend SendOtpDto phone rule.
export const isPhone = (v: string) => {
  const t = v.trim();
  return t.length >= 7 && t.length <= 20 && /^[+\d][\d\s\-()]*$/.test(t);
};

/** null when fine, otherwise a message that names the problem precisely. */
export function requireText(value: string, label: string, min = 1): string | null {
  const len = value.trim().length;
  if (len === 0) return `${label} is required.`;
  if (len < min) return `${label} needs at least ${min} characters — currently ${len}.`;
  return null;
}

/** Border/ring classes for an input, switching to red when the field has an error. */
export function fieldClass(hasError: boolean): string {
  return hasError
    ? 'border-red-400 focus:ring-red-500 bg-red-50'
    : 'border-slate-300 focus:ring-blue-500 bg-white';
}

/**
 * Scrolls the first errored field into view. Fields opt in by wrapping
 * themselves in an element with id={`field-${key}`}.
 */
export function scrollToFirstError(errors: FieldErrors): void {
  const first = Object.keys(errors)[0];
  if (!first || typeof document === 'undefined') return;
  document.getElementById(`field-${first}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

export function summaryMessage(errors: FieldErrors): string {
  const n = Object.keys(errors).length;
  return n === 1
    ? 'Please fix the highlighted field below.'
    : `Please fix the ${n} highlighted fields below.`;
}

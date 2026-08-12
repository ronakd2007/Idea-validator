// Turns a stored answer (JSON-encoded in SurveyAnswer.value) into something
// readable. Shared by the founder response viewer and the admin one so the two
// can never drift apart.

interface AnswerQuestion {
  type: string;
  options: { id: string; label: string }[];
}

export function formatAnswer(question: AnswerQuestion, rawValue: string) {
  let value: any;
  try {
    value = JSON.parse(rawValue);
  } catch {
    return rawValue;
  }

  // IMAGE_CHOICE stores an option id just like the other single-choice types,
  // so it resolves to a label here rather than showing a raw id.
  if (question.type === 'MULTIPLE_CHOICE' || question.type === 'DROPDOWN' || question.type === 'IMAGE_CHOICE') {
    return question.options.find((o) => o.id === value)?.label || String(value);
  }
  if (question.type === 'CHECKBOXES') {
    const ids = Array.isArray(value) ? value : [];
    const labels = ids.map((id: string) => question.options.find((o) => o.id === id)?.label || id);
    return labels.length ? labels.join(', ') : '—';
  }
  if (typeof value === 'number') return String(value);
  return value || '—';
}

export function formatDuration(seconds: number | null) {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export const QUALITY_STYLE: Record<string, string> = {
  HIGH: 'bg-emerald-50 text-emerald-700',
  MEDIUM: 'bg-amber-50 text-amber-700',
  POTENTIALLY_LOW: 'bg-red-50 text-red-700',
};

export const QUALITY_LABEL: Record<string, string> = {
  HIGH: 'High',
  MEDIUM: 'Medium',
  POTENTIALLY_LOW: 'Potentially low',
};

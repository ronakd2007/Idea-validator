// Decides which graph a question's results get, and writes the one-line
// plain-language reading that sits under it. Kept out of the page so the
// mapping is testable and lives in one place.
//
//   YES_NO                        → 100% stacked bar (one proportion)
//   MULTIPLE_CHOICE / DROPDOWN    → horizontal bars, most-picked first
//   IMAGE_CHOICE                  → horizontal bars with thumbnails
//   CHECKBOXES                    → horizontal bars, % of respondents (sums >100%)
//   RATING / LINEAR_SCALE         → vertical columns in scale order, never sorted
//   SHORT_ANSWER / PARAGRAPH      → no chart; browsable answers

export type ChartKind = 'STACKED' | 'HBAR' | 'COLUMNS' | 'TEXT' | 'EMPTY';

// Below this, results are anecdotes rather than data — every chart says so.
export const LOW_SAMPLE = 5;

export function chartKindFor(q: any): ChartKind {
  if (q.isText) return 'TEXT';
  if (!q.answeredCount) return 'EMPTY';
  if (q.type === 'YES_NO') return 'STACKED';
  if (q.average !== undefined) return 'COLUMNS'; // RATING | LINEAR_SCALE
  return 'HBAR';
}

// The sentence printed under the chart. Returns null when the data doesn't
// support an honest statement — silence beats a vague filler line.
export function readingFor(q: any): string | null {
  const kind = chartKindFor(q);
  if (kind === 'EMPTY' || kind === 'TEXT') return null;

  if (kind === 'STACKED') {
    const yes = q.distribution?.find((d: any) => d.label === 'Yes');
    if (!yes) return null;
    const p = Math.round(yes.pct);
    if (p >= 70) return `A clear yes — ${p}% agreed.`;
    if (p >= 50) return `A slight majority said yes (${p}%), but it is close.`;
    if (p >= 30) return `Most people said no — only ${p}% agreed.`;
    return `A clear no — just ${p}% agreed.`;
  }

  if (kind === 'COLUMNS') {
    if (q.average == null) return null;
    const pct = (q.average / q.max) * 100;
    const avg = q.average.toFixed(1);
    if (pct >= 70) return `Strongly positive — the average answer is ${avg} out of ${q.max}.`;
    if (pct >= 45) return `Middling — the average answer is ${avg} out of ${q.max}.`;
    return `Weak — the average answer is only ${avg} out of ${q.max}.`;
  }

  // HBAR — name the winner and how decisive it is.
  const sorted = [...(q.distribution || [])].sort((a, b) => b.count - a.count);
  const top = sorted[0];
  if (!top) return null;
  const second = sorted[1];
  const lead = second ? top.pct - second.pct : top.pct;
  if (q.type === 'CHECKBOXES') {
    return `"${top.label}" was picked most — by ${Math.round(top.pct)}% of respondents.`;
  }
  if (sorted.length > 1 && lead < 10) {
    return `No clear winner — "${top.label}" (${Math.round(top.pct)}%) and "${second.label}" (${Math.round(second.pct)}%) are close.`;
  }
  return `"${top.label}" is the clear winner at ${Math.round(top.pct)}%.`;
}

// Checkbox percentages are of respondents, not of ticks, so they exceed 100%.
// Saying so prevents the most common misreading of this chart.
export function chartNoteFor(q: any): string | null {
  if (q.type === 'CHECKBOXES') return 'People could pick more than one, so these add up to more than 100%.';
  return null;
}

export function lowSampleNote(answeredCount: number): string | null {
  if (answeredCount === 0 || answeredCount >= LOW_SAMPLE) return null;
  return `Only ${answeredCount} answer${answeredCount !== 1 ? 's' : ''} — read these as anecdotes, not data.`;
}

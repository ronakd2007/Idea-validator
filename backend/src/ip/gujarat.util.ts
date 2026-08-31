import { FOCUS_STATE } from './ip.constants';

/**
 * Location helpers for the admin ecosystem dashboard.
 *
 * `state` is written from a fixed dropdown, so the Gujarat query is an exact
 * match and needs nothing clever. These helpers exist for the one messy input
 * that remains — the free-text city — and for normalising legacy or
 * hand-edited values so the charts don't split "Ahmedabad" and "ahmedabad "
 * into two bars.
 *
 * Nothing here infers a location. A record with no state is counted as
 * unknown, never guessed into a bucket.
 */

/** Canonical spellings for the cities we expect to see most. Anything not in
 *  this list is still counted — it is just title-cased rather than corrected. */
const CITY_CANON: Record<string, string> = {
  ahmedabad: 'Ahmedabad',
  amdavad: 'Ahmedabad',
  surat: 'Surat',
  vadodara: 'Vadodara',
  baroda: 'Vadodara',
  rajkot: 'Rajkot',
  bhavnagar: 'Bhavnagar',
  jamnagar: 'Jamnagar',
  gandhinagar: 'Gandhinagar',
  junagadh: 'Junagadh',
  anand: 'Anand',
  nadiad: 'Nadiad',
  bharuch: 'Bharuch',
  mehsana: 'Mehsana',
  morbi: 'Morbi',
  surendranagar: 'Surendranagar',
  vapi: 'Vapi',
  navsari: 'Navsari',
  valsad: 'Valsad',
  porbandar: 'Porbandar',
  gandhidham: 'Gandhidham',
  patan: 'Patan',
  bhuj: 'Bhuj',
  ankleshwar: 'Ankleshwar',
  godhra: 'Godhra',
  palanpur: 'Palanpur',
};

/** Trim, collapse whitespace, drop stray punctuation. */
export function normalizeText(raw: string | null | undefined): string {
  if (!raw) return '';
  return String(raw)
    .replace(/[^\p{L}\p{N}\s.&'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Canonical city label, or '' when the founder left it blank. */
export function canonicalCity(raw: string | null | undefined): string {
  const cleaned = normalizeText(raw);
  if (!cleaned) return '';
  const key = cleaned.toLowerCase();
  if (CITY_CANON[key]) return CITY_CANON[key];
  return cleaned.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

/** Canonical institution label. Same treatment as city: normalise, don't invent. */
export function canonicalInstitution(raw: string | null | undefined): string {
  const cleaned = normalizeText(raw);
  return cleaned;
}

/** Exact match against the dropdown value. No fuzzy matching: a record whose
 *  state was never set is unknown, not "probably Gujarat". */
export function isFocusState(state: string | null | undefined): boolean {
  return normalizeText(state).toLowerCase() === FOCUS_STATE.toLowerCase();
}

/**
 * Count occurrences of a label, dropping blanks, sorted biggest-first.
 * Blank labels are excluded rather than bucketed as "Unknown" — the caller
 * reports coverage separately so a chart never implies data it doesn't have.
 */
export function countBy<T>(rows: T[], pick: (row: T) => string): { label: string; count: number }[] {
  const tally = new Map<string, number>();
  for (const row of rows) {
    const label = pick(row);
    if (!label) continue;
    tally.set(label, (tally.get(label) ?? 0) + 1);
  }
  return [...tally.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/**
 * Monthly buckets for the "applications over time" trend, oldest first.
 * Months with no activity are emitted as zeroes so the line shows real gaps
 * instead of joining across them.
 */
export function monthlySeries(dates: (Date | string | null | undefined)[], months = 12): { label: string; value: number }[] {
  const now = new Date();
  const buckets: { key: string; label: string; value: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    buckets.push({
      key: `${d.getUTCFullYear()}-${d.getUTCMonth()}`,
      label: d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
      value: 0,
    });
  }
  const index = new Map(buckets.map((b, i) => [b.key, i]));
  for (const raw of dates) {
    if (!raw) continue;
    const d = raw instanceof Date ? raw : new Date(raw);
    if (Number.isNaN(d.getTime())) continue;
    const at = index.get(`${d.getUTCFullYear()}-${d.getUTCMonth()}`);
    if (at != null) buckets[at].value++;
  }
  return buckets.map(({ label, value }) => ({ label, value }));
}

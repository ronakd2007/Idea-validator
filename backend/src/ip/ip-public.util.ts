import { PUBLIC_FIELD_DEFAULTS, IP_DISCLAIMER } from './ip.constants';

/**
 * Everything a published IP record is allowed to expose.
 *
 * This is the second of three defences. The first is the Prisma `where`
 * (visibility PUBLIC + reviewStatus APPROVED); the third is the `select` on
 * the public queries, which never even reads the private columns out of
 * Postgres. This function is the one that is pure, and therefore the one that
 * is unit-tested directly — see __tests__/ip-public.util.spec.ts.
 *
 * Fields that are NEVER public, under any setting:
 *   notes, documents, inventorNames, ownerName, adminNote, reviewMessage,
 *   founder email/phone/id, applicationNumber (unless opted in), publicUrl
 *   (unless opted in), filingDate (unless opted in — only the year is shown
 *   by default), institution (unless opted in), exact city is shown but the
 *   founder's address is never collected in the first place.
 */
export interface PublicIpRecord {
  id: string;
  title: string;
  type: string;
  status: string;
  description: string;
  jurisdiction: string;
  filingYear: number | null;
  state: string;
  city: string;
  founderName: string;
  startupName: string | null;
  industry: string | null;
  applicationNumber?: string;
  filingDate?: string;
  publicUrl?: string;
  institution?: string;
  statusSource: 'FOUNDER_PROVIDED';
  disclaimer: string;
}

/** Coerce stored JSON into the fixed boolean shape. A crafted payload that
 *  smuggled in extra keys or non-booleans cannot publish anything. */
export function parsePublicFields(raw: unknown): Record<string, boolean> {
  let parsed: any = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw || '{}');
    } catch {
      parsed = {};
    }
  }
  const out = { ...PUBLIC_FIELD_DEFAULTS };
  for (const key of Object.keys(PUBLIC_FIELD_DEFAULTS)) {
    if (typeof parsed?.[key] === 'boolean') out[key] = parsed[key];
  }
  return out;
}

/** Filing year only — the full date is an opt-in, but the year is coarse
 *  enough to be useful on a card without pinpointing a filing. */
function yearOf(d: Date | string | null | undefined): number | null {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? null : date.getUTCFullYear();
}

/**
 * Build the public view of a record.
 *
 * Deliberately constructs a NEW object field by field. It never spreads the
 * row, so a column added to the schema later is private by default and has to
 * be added here on purpose before it can ever reach the registry.
 */
export function toPublicIpRecord(row: any): PublicIpRecord {
  const opts = parsePublicFields(row?.publicFields);

  const out: PublicIpRecord = {
    id: row.id,
    title: row.title ?? '',
    type: row.type ?? '',
    status: row.status ?? '',
    description: row.description ?? '',
    jurisdiction: row.jurisdiction ?? '',
    filingYear: yearOf(row.filingDate),
    state: row.state ?? '',
    city: row.city ?? '',
    founderName: row.founder?.name ?? '',
    // Only an APPROVED listing's name may appear here. A startup still in
    // review is not public anywhere else on the platform, and an IP record
    // must not become the back door that reveals it.
    startupName: row.idea?.startup?.status === 'APPROVED' ? row.idea.startup.name : null,
    industry: row.idea?.industryCategory ?? null,
    statusSource: 'FOUNDER_PROVIDED',
    disclaimer: IP_DISCLAIMER,
  };

  // Opt-in extras. Absent — not null, not empty string — when not opted in,
  // so a client cannot tell the difference between "withheld" and "not set".
  if (opts.showApplicationNumber && row.applicationNumber) {
    out.applicationNumber = row.applicationNumber;
  }
  if (opts.showFilingDate && row.filingDate) {
    const d = row.filingDate instanceof Date ? row.filingDate : new Date(row.filingDate);
    if (!Number.isNaN(d.getTime())) out.filingDate = d.toISOString();
  }
  if (opts.showPublicUrl && row.publicUrl) {
    out.publicUrl = row.publicUrl;
  }
  if (opts.showInstitution && row.institution) {
    out.institution = row.institution;
  }

  return out;
}

/** The columns a public query is allowed to read. Passed straight to Prisma's
 *  `select`, so the private ones never leave the database. */
export const PUBLIC_SELECT = {
  id: true,
  title: true,
  type: true,
  status: true,
  description: true,
  jurisdiction: true,
  filingDate: true,
  state: true,
  city: true,
  institution: true,
  applicationNumber: true,
  publicUrl: true,
  publicFields: true,
  reviewedAt: true,
  founder: { select: { name: true } },
  idea: { select: { industryCategory: true, startup: { select: { name: true, slug: true, status: true } } } },
} as const;

/**
 * The fields whose contents actually appear on the public registry.
 *
 * Used to decide whether an edit to an already-APPROVED record needs a fresh
 * review. Without this, a founder could get bland text approved and then
 * quietly swap in something else on a live page. Private-only fields (notes,
 * ownerName, inventorNames, documents) are absent, so editing them never
 * disturbs an approval the founder already earned.
 */
export function publicFacingSignature(row: any): string {
  return JSON.stringify([
    row?.title ?? '',
    row?.description ?? '',
    row?.type ?? '',
    row?.status ?? '',
    row?.jurisdiction ?? '',
    row?.city ?? '',
    row?.state ?? '',
    row?.institution ?? '',
    row?.applicationNumber ?? '',
    row?.publicUrl ?? '',
    row?.filingDate ? new Date(row.filingDate).toISOString() : '',
    parsePublicFields(row?.publicFields),
  ]);
}

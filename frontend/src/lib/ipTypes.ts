// Shared vocabulary for the Innovation & Patent Registry. Mirrors
// backend/src/ip/ip.constants.ts — keep the two in step.
import type { BadgeTone } from '@/components/ui/StatusBadge';

export const IP_TYPES: { value: string; label: string }[] = [
  { value: 'PATENT', label: 'Patent' },
  { value: 'TRADEMARK', label: 'Trademark' },
  { value: 'COPYRIGHT', label: 'Copyright' },
  { value: 'DESIGN', label: 'Design' },
  { value: 'TRADE_SECRET', label: 'Trade Secret' },
  { value: 'OTHER', label: 'Other' },
];

/**
 * The IP's own status, always set by the founder. Every surface that renders
 * one of these must also say it came from the founder — we do not check any
 * patent office, so none of this is verified.
 */
export const IP_STATUSES: { value: string; label: string; tone: BadgeTone }[] = [
  { value: 'PLANNED', label: 'Planned', tone: 'neutral' },
  { value: 'DRAFT', label: 'Draft', tone: 'neutral' },
  { value: 'FILED', label: 'Filed', tone: 'info' },
  { value: 'PUBLISHED', label: 'Published', tone: 'info' },
  { value: 'GRANTED', label: 'Granted', tone: 'success' },
  { value: 'REJECTED', label: 'Rejected', tone: 'danger' },
  { value: 'EXPIRED', label: 'Expired', tone: 'warning' },
];

export const IP_DOCUMENT_TYPES: { value: string; label: string }[] = [
  { value: 'APPLICATION', label: 'Application' },
  { value: 'CERTIFICATE', label: 'Certificate' },
  { value: 'DRAWING', label: 'Drawing' },
  { value: 'SPECIFICATION', label: 'Specification' },
  { value: 'CORRESPONDENCE', label: 'Correspondence' },
  { value: 'OTHER', label: 'Other' },
];

/**
 * The admin publication gate — deliberately separate from IP_STATUSES. One
 * describes the patent, the other describes whether we have agreed to show it.
 * Wording is founder-facing: they should be able to tell what to do next
 * without asking anyone.
 */
export const IP_REVIEW_META: Record<string, { label: string; tone: BadgeTone; blurb: string }> = {
  DRAFT: {
    label: 'Private',
    tone: 'neutral',
    blurb: 'Only you can see this. Tick "show on the public registry" when you want it reviewed.',
  },
  PENDING_REVIEW: {
    label: 'Pending Review',
    tone: 'info',
    blurb: 'Our team is checking this before it goes on the public registry.',
  },
  CHANGES_REQUESTED: {
    label: 'Changes Requested',
    tone: 'warning',
    blurb: 'Our team asked for a few changes before this can be published.',
  },
  APPROVED: {
    label: 'Live',
    tone: 'success',
    blurb: 'This record is on the public registry. Untick the box any time to take it down.',
  },
  REJECTED: {
    label: 'Not Approved',
    tone: 'danger',
    blurb: 'This record was not approved for the public registry. It stays private and yours.',
  },
};

export const INDIAN_STATES: string[] = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland',
  'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
  'Outside India',
];

/** The opt-in extras a founder can choose to publish, in the order they appear
 *  on the form. Everything not listed is either always public or never public. */
export const IP_PUBLIC_FIELD_OPTIONS: { key: string; label: string; hint: string }[] = [
  { key: 'showFilingDate', label: 'Exact filing date', hint: 'Otherwise only the year is shown.' },
  { key: 'showApplicationNumber', label: 'Application number', hint: 'Hidden by default.' },
  { key: 'showPublicUrl', label: 'Patent office link', hint: 'Only if you added one.' },
  { key: 'showInstitution', label: 'College / institution', hint: 'Hidden by default.' },
];

export const ipTypeLabel = (v: string) =>
  IP_TYPES.find((o) => o.value === v)?.label ?? String(v || '').replace(/_/g, ' ');

export const ipStatusLabel = (v: string) =>
  IP_STATUSES.find((o) => o.value === v)?.label ?? String(v || '').replace(/_/g, ' ');

export const ipStatusTone = (v: string): BadgeTone =>
  IP_STATUSES.find((o) => o.value === v)?.tone ?? 'neutral';

export const ipReviewMeta = (v: string) =>
  IP_REVIEW_META[v] ?? { label: String(v || '').replace(/_/g, ' '), tone: 'neutral' as BadgeTone, blurb: '' };

/**
 * The one disclaimer wording. The API sends its own copy on every payload;
 * this is the fallback so a page can never render the registry without it.
 */
export const IP_DISCLAIMER =
  'Patent/IP information is provided by founders and has not been independently verified by IdeaValidator.';

/** Shown next to any founder-reported status. */
export const IP_STATUS_SOURCE_NOTE = 'Status provided by founder';

// Innovation & Patent Registry — the fixed vocabularies.
//
// Kept in one place because three different layers depend on them agreeing:
// the DTOs validate against these arrays, the service filters against them,
// and the frontend renders labels from the mirrored copy in lib/ipTypes.ts.

/** What kind of intellectual property this record describes. */
export const IP_TYPES = [
  'PATENT',
  'TRADEMARK',
  'COPYRIGHT',
  'DESIGN',
  'TRADE_SECRET',
  'OTHER',
] as const;

/**
 * The PATENT's own status — always founder-reported. IdeaValidator does not
 * check any registry, so nothing here is evidence of anything; every surface
 * that shows it must also say "provided by founder".
 */
export const IP_STATUSES = [
  'PLANNED',
  'DRAFT',
  'FILED',
  'PUBLISHED',
  'GRANTED',
  'REJECTED',
  'EXPIRED',
] as const;

/** Statuses that represent an actual application made to an authority. */
export const APPLIED_STATUSES = ['FILED', 'PUBLISHED', 'GRANTED', 'REJECTED', 'EXPIRED'];

/** Applied for, not yet decided. */
export const PENDING_STATUSES = ['FILED', 'PUBLISHED'];

/** The admin publication gate. Separate from IP_STATUSES on purpose. */
export const IP_REVIEW_STATUSES = [
  'DRAFT',
  'PENDING_REVIEW',
  'APPROVED',
  'CHANGES_REQUESTED',
  'REJECTED',
] as const;

export const IP_VISIBILITIES = ['PRIVATE', 'PUBLIC'] as const;

export const IP_DOCUMENT_TYPES = [
  'APPLICATION',
  'CERTIFICATE',
  'DRAWING',
  'SPECIFICATION',
  'CORRESPONDENCE',
  'OTHER',
] as const;

/**
 * Opt-in extras for a published record. Everything else is either always
 * public (title, type, description…) or NEVER public (notes, documents,
 * inventors, owner) — see PUBLIC_SAFE_FIELDS in ip-public.util.ts.
 *
 * Every key defaults to false: a founder opts a field IN, never out.
 */
export const PUBLIC_FIELD_DEFAULTS: Record<string, boolean> = {
  showApplicationNumber: false,
  showFilingDate: false,
  showPublicUrl: false,
  showInstitution: false,
};

/** Indian states, for the founder location dropdown and admin filters. */
export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland',
  'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
  'Outside India',
] as const;

/** The state the admin ecosystem dashboard is built around. */
export const FOCUS_STATE = 'Gujarat';

/**
 * The single disclaimer string. Imported by the public payload builder so the
 * API itself carries it — a new client can't render the registry without it.
 */
export const IP_DISCLAIMER =
  'Patent/IP information is provided by founders and has not been independently verified by IdeaValidator.';

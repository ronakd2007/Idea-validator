// Shared vocabulary for the Startup Directory. Mirrors the backend DTO's
// allowed values — keep the two in step.

export const LOOKING_FOR_OPTIONS: { value: string; label: string }[] = [
  { value: 'FUNDING', label: 'Funding' },
  { value: 'CUSTOMERS', label: 'Customers' },
  { value: 'MENTORS', label: 'Mentors' },
  { value: 'PARTNERSHIPS', label: 'Partnerships' },
  { value: 'EMPLOYEES', label: 'Employees' },
  { value: 'OTHER', label: 'Other' },
];

export const STARTUP_STAGES: { value: string; label: string }[] = [
  { value: 'IDEA', label: 'Idea' },
  { value: 'RESEARCH', label: 'Research' },
  { value: 'PROTOTYPE', label: 'Prototype' },
  { value: 'MVP', label: 'MVP' },
  { value: 'REVENUE_GENERATING', label: 'Revenue generating' },
];

export const lookingForLabel = (v: string) =>
  LOOKING_FOR_OPTIONS.find((o) => o.value === v)?.label ?? v;

export const stageLabel = (v: string) =>
  STARTUP_STAGES.find((o) => o.value === v)?.label ?? String(v || '').replace(/_/g, ' ');

// Founder-facing meaning of each listing status, reused by the dashboard card
// and the form so the wording never drifts between them.
export const STARTUP_STATUS_META: Record<string, { label: string; tone: 'neutral' | 'info' | 'warning' | 'success' | 'danger'; blurb: string }> = {
  DRAFT: { label: 'Draft', tone: 'neutral', blurb: 'Saved but not submitted yet — finish it whenever you like.' },
  PENDING_REVIEW: { label: 'Pending Review', tone: 'info', blurb: 'Our team is reviewing your listing. You will see it here once it is live.' },
  CHANGES_REQUESTED: { label: 'Changes Requested', tone: 'warning', blurb: 'Our team asked for a few changes before publishing.' },
  APPROVED: { label: 'Published', tone: 'success', blurb: 'Your startup is live in the public directory.' },
  REJECTED: { label: 'Not Approved', tone: 'danger', blurb: 'This listing was not approved for the directory.' },
};

// One shared status → color language for the whole app. Every page renders
// state through this instead of hand-rolled chips, so "live" is always
// emerald, "draft" always slate, "attention" always amber, everywhere.
//
// tone is semantic, not per-feature: map your domain status to a tone at the
// call site (see STATUS_TONE below for the common platform statuses).

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-600',
  info: 'bg-blue-50 text-blue-700',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  danger: 'bg-red-50 text-red-700',
  accent: 'bg-violet-50 text-violet-700',
};

const DOTS: Record<BadgeTone, string> = {
  neutral: 'bg-slate-400',
  info: 'bg-blue-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  accent: 'bg-violet-500',
};

// Domain statuses used across the platform, mapped once.
export const STATUS_TONE: Record<string, BadgeTone> = {
  DRAFT: 'neutral',
  LIVE: 'success',
  CLOSED: 'warning',
  ARCHIVED: 'neutral',
  PENDING: 'warning',
  COMPLETED: 'success',
  ACTIVE: 'success',
  IN_REVIEW: 'info',
  REJECTED: 'danger',
};

export default function StatusBadge({
  tone = 'neutral',
  children,
  dot = false,
  className = '',
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${TONES[tone]} ${className}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${DOTS[tone]}`} />}
      {children}
    </span>
  );
}

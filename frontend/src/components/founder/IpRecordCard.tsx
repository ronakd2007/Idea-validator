'use client';
import Link from 'next/link';
import StatusBadge from '@/components/ui/StatusBadge';
import { ipTypeLabel, ipStatusLabel, ipStatusTone, ipReviewMeta, IP_STATUS_SOURCE_NOTE } from '@/lib/ipTypes';

/**
 * One record in the founder's "Your IP" list.
 *
 * Two badges, because there are genuinely two states: what the founder says
 * the patent's status is, and whether we have agreed to show the record
 * publicly. Collapsing them into one would hide which of the two is blocking.
 */
export default function IpRecordCard({ record }: { record: any }) {
  const review = ipReviewMeta(record.reviewStatus);
  const filedYear = record.filingDate ? new Date(record.filingDate).getUTCFullYear() : null;

  const meta = [
    ipTypeLabel(record.type),
    record.jurisdiction || null,
    filedYear ? `Filed ${filedYear}` : null,
  ].filter(Boolean);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-slate-900 leading-snug min-w-0">{record.title}</h3>
        <StatusBadge tone={review.tone} className="shrink-0">{review.label}</StatusBadge>
      </div>

      <p className="text-sm text-slate-500 mt-1.5">{meta.join(' · ')}</p>

      {record.description && (
        <p className="text-sm text-slate-600 mt-3 line-clamp-2">{record.description}</p>
      )}

      <div className="flex items-center gap-2 mt-4">
        <StatusBadge tone={ipStatusTone(record.status)}>{ipStatusLabel(record.status)}</StatusBadge>
        <span className="text-xs text-slate-400">{IP_STATUS_SOURCE_NOTE}</span>
      </div>

      {/* The one line that tells the founder what, if anything, to do next. */}
      {review.blurb && <p className="text-xs text-slate-500 mt-3">{review.blurb}</p>}

      {record.reviewStatus === 'CHANGES_REQUESTED' && record.reviewMessage && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
          {record.reviewMessage}
        </p>
      )}

      <div className="flex items-center gap-3 mt-5 pt-4 border-t border-slate-100">
        <Link
          href={`/founder/ip/${record.id}`}
          className="text-sm font-medium text-blue-700 hover:text-blue-800"
        >
          View &amp; edit
        </Link>
        {record.isLive && (
          <Link
            href={`/registry/${record.id}`}
            className="text-sm text-slate-500 hover:text-slate-700"
            target="_blank"
          >
            See public page ↗
          </Link>
        )}
        {record.documents?.length > 0 && (
          <span className="text-xs text-slate-400 ml-auto">
            {record.documents.length} file{record.documents.length === 1 ? '' : 's'}
          </span>
        )}
      </div>
    </div>
  );
}

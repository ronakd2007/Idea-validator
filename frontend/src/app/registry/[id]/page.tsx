'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import StatusBadge from '@/components/ui/StatusBadge';
import { SkeletonCard } from '@/components/ui/Skeleton';
import {
  ipTypeLabel, ipStatusLabel, ipStatusTone, IP_DISCLAIMER, IP_STATUS_SOURCE_NOTE,
} from '@/lib/ipTypes';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 py-3 border-b border-slate-100 last:border-0">
      <dt className="text-sm text-slate-500 w-40 shrink-0">{label}</dt>
      <dd className="text-sm text-slate-800 min-w-0">{children}</dd>
    </div>
  );
}

/**
 * Public detail page for one published record.
 *
 * Renders exactly what the API sends. Fields the founder did not opt into
 * publishing are absent from the payload, so the row simply does not appear —
 * there is nothing here that hides a value it was given.
 */
export default function PublicIpRecordPage() {
  const params = useParams();
  const id = params.id as string;
  const [record, setRecord] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api.getPublicIpRecord(id).then(setRecord).catch(() => setNotFound(true));
  }, [id]);

  if (notFound) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20 text-center">
        <h1 className="text-xl font-semibold text-slate-800">Record not found</h1>
        <p className="text-slate-500 mt-2">
          This record is not on the public registry. It may be private, or it may have been taken down.
        </p>
        <Link href="/registry" className="text-blue-700 hover:underline text-sm mt-4 inline-block">
          Browse the registry
        </Link>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <SkeletonCard />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <Link href="/registry" className="text-sm text-slate-500 hover:text-slate-700">
        ← Patent &amp; Innovation Registry
      </Link>

      <div className="mt-5">
        <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">
          {record.startupName || record.founderName}
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight mt-2">{record.title}</h1>
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <StatusBadge tone="info">{ipTypeLabel(record.type)}</StatusBadge>
          <StatusBadge tone={ipStatusTone(record.status)}>{ipStatusLabel(record.status)}</StatusBadge>
          <span className="text-xs text-slate-400">{IP_STATUS_SOURCE_NOTE}</span>
        </div>
      </div>

      {record.description && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mt-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-2">What it covers</h2>
          <p className="text-slate-700 whitespace-pre-line leading-relaxed">{record.description}</p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mt-4">
        <h2 className="text-sm font-semibold text-slate-900 mb-1">Details</h2>
        <dl>
          <Row label="Type">{ipTypeLabel(record.type)}</Row>
          <Row label="Status">
            {ipStatusLabel(record.status)}{' '}
            <span className="text-slate-400">— {IP_STATUS_SOURCE_NOTE.toLowerCase()}</span>
          </Row>
          {record.jurisdiction && <Row label="Jurisdiction">{record.jurisdiction}</Row>}
          {/* Only the year unless the founder opted the full date in. */}
          {record.filingDate ? (
            <Row label="Filed">{new Date(record.filingDate).toLocaleDateString()}</Row>
          ) : (
            record.filingYear && <Row label="Filed">{record.filingYear}</Row>
          )}
          {record.applicationNumber && <Row label="Application number">{record.applicationNumber}</Row>}
          {(record.city || record.state) && (
            <Row label="Location">{[record.city, record.state].filter(Boolean).join(', ')}</Row>
          )}
          {record.institution && <Row label="Institution">{record.institution}</Row>}
          {record.industry && <Row label="Industry">{record.industry}</Row>}
          <Row label="Recorded by">{record.founderName}</Row>
          {record.publicUrl && (
            <Row label="Patent office">
              <a
                href={record.publicUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-blue-700 hover:underline break-all"
              >
                {record.publicUrl} ↗
              </a>
            </Row>
          )}
        </dl>
      </div>

      <p className="text-xs text-slate-500 mt-6 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
        {record.disclaimer ?? IP_DISCLAIMER} IdeaValidator does not file, register or grant any intellectual
        property, and does not check filings with any patent office.
      </p>
    </div>
  );
}

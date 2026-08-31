'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import StatusBadge from '@/components/ui/StatusBadge';
import { SkeletonList } from '@/components/ui/Skeleton';
import {
  ipTypeLabel, ipStatusLabel, ipStatusTone, IP_DISCLAIMER, IP_STATUS_SOURCE_NOTE,
} from '@/lib/ipTypes';

/**
 * Public Innovation & Patent Registry.
 *
 * Everything on this page was published twice over: the founder ticked a box,
 * and an admin approved it. The API enforces both — nothing here filters for
 * that client-side.
 */
export default function PublicRegistryPage() {
  const [data, setData] = useState<any>(null);
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [industry, setIndustry] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    api.getPublicIpRecords().then(setData).catch(() => setData({ records: [], filters: {} }));
  }, []);

  const records = data?.records ?? [];

  // Filtering happens client-side over an already-public list: every record
  // here is publishable, so narrowing it locally cannot expose anything.
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return records.filter(
      (r: any) =>
        (!type || r.type === type) &&
        (!status || r.status === status) &&
        (!industry || r.industry === industry) &&
        (!term ||
          r.title?.toLowerCase().includes(term) ||
          r.description?.toLowerCase().includes(term) ||
          r.founderName?.toLowerCase().includes(term) ||
          r.startupName?.toLowerCase().includes(term))
    );
  }, [records, type, status, industry, q]);

  const selectCls =
    'border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
      <PageHeader
        title="Patent &amp; Innovation Registry"
        subtitle="What founders across the IdeaValidator community are inventing, filing and protecting."
      />

      {data === null ? (
        <SkeletonList count={4} />
      ) : records.length === 0 ? (
        <EmptyState
          icon="📜"
          title="Nothing published yet"
          body="Founders choose whether to list their patents and IP here. As records are published and approved, they will appear on this page."
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search titles, founders, startups…"
              className={`${selectCls} flex-1 min-w-[220px]`}
            />
            <select value={type} onChange={(e) => setType(e.target.value)} className={selectCls}>
              <option value="">All types</option>
              {(data.filters?.types ?? []).map((t: string) => (
                <option key={t} value={t}>{ipTypeLabel(t)}</option>
              ))}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
              <option value="">Any status</option>
              {(data.filters?.statuses ?? []).map((s: string) => (
                <option key={s} value={s}>{ipStatusLabel(s)}</option>
              ))}
            </select>
            {(data.filters?.industries ?? []).length > 0 && (
              <select value={industry} onChange={(e) => setIndustry(e.target.value)} className={selectCls}>
                <option value="">All industries</option>
                {data.filters.industries.map((i: string) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            )}
          </div>

          <p className="text-sm text-slate-500 mb-4">
            {filtered.length} record{filtered.length === 1 ? '' : 's'}
          </p>

          {filtered.length === 0 ? (
            <EmptyState
              icon="🔍"
              title="Nothing matches those filters"
              body="Try a broader search or clear a filter to see more of the registry."
              compact
            />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((r: any) => (
                <Link
                  key={r.id}
                  href={`/registry/${r.id}`}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:border-blue-300 hover:shadow transition flex flex-col"
                >
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    {r.startupName || r.founderName}
                  </p>
                  <h3 className="font-semibold text-slate-900 mt-1.5 leading-snug">{r.title}</h3>
                  {r.description && (
                    <p className="text-sm text-slate-600 mt-2.5 line-clamp-3 flex-1">{r.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-slate-100">
                    <StatusBadge tone="info">{ipTypeLabel(r.type)}</StatusBadge>
                    <StatusBadge tone={ipStatusTone(r.status)}>{ipStatusLabel(r.status)}</StatusBadge>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    {[r.jurisdiction, r.filingYear ? `Filed ${r.filingYear}` : null, r.city || r.state]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      <p className="text-xs text-slate-400 mt-10 max-w-2xl">
        {data?.disclaimer ?? IP_DISCLAIMER} {IP_STATUS_SOURCE_NOTE} in every case. IdeaValidator does not
        file, register or grant any intellectual property.
      </p>
    </div>
  );
}

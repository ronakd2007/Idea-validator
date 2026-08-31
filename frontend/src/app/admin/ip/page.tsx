'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAdminGuard } from '@/lib/adminGuard';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { Skeleton, SkeletonStatRow } from '@/components/ui/Skeleton';
import HBarChart from '@/components/HBarChart';
import LineChart from '@/components/LineChart';
import {
  IP_TYPES, IP_STATUSES, INDIAN_STATES, ipTypeLabel, ipStatusLabel, ipStatusTone, ipReviewMeta,
  IP_DISCLAIMER,
} from '@/lib/ipTypes';

const REVIEW_TABS = ['PENDING_REVIEW', 'ALL', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED', 'DRAFT'];

/** A chart only earns its space once there is something in it to read. */
function Chart({
  title,
  note,
  hasData,
  children,
}: {
  title: string;
  note?: string;
  hasData: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {note && <p className="text-xs text-slate-400 mt-0.5 mb-3">{note}</p>}
      <div className={note ? '' : 'mt-4'}>
        {hasData ? (
          children
        ) : (
          <p className="text-sm text-slate-400 text-center py-8">Not enough data yet.</p>
        )}
      </div>
    </div>
  );
}

/** countBy output → HBarChart's shape, with percentages against the slice. */
function toBars(rows: { label: string; count: number }[], labeller: (v: string) => string = (v) => v) {
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  return rows.map((r) => ({
    label: labeller(r.label),
    count: r.count,
    pct: total ? (r.count / total) * 100 : 0,
  }));
}

export default function AdminIpPage() {
  const allowed = useAdminGuard();
  const [analytics, setAnalytics] = useState<any>(null);
  const [rows, setRows] = useState<any[] | null>(null);

  // Server-side filters — these narrow the query itself.
  const [reviewStatus, setReviewStatus] = useState('PENDING_REVIEW');
  const [type, setType] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [state, setState] = useState('ALL');
  const [jurisdiction, setJurisdiction] = useState('');
  const [institution, setInstitution] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');
  const [appliedQ, setAppliedQ] = useState('');

  useEffect(() => {
    if (!allowed) return;
    api.getAdminIpAnalytics().then(setAnalytics).catch(() => setAnalytics(null));
  }, [allowed]);

  useEffect(() => {
    if (!allowed) return;
    setRows(null);
    api
      .getAdminIpRecords({ reviewStatus, type, status, state, jurisdiction, institution, from, to, q: appliedQ })
      .then((res: any) => setRows(res.records ?? []))
      .catch(() => setRows([]));
  }, [allowed, reviewStatus, type, status, state, jurisdiction, institution, from, to, appliedQ]);

  const focus = analytics?.focus;
  const coverage = analytics?.coverage;
  const charts = analytics?.charts;

  const stateCoverageNote = useMemo(() => {
    if (!coverage) return '';
    const { recordsWithState, totalRecords } = coverage;
    if (!totalRecords) return 'No records yet.';
    return `${recordsWithState} of ${totalRecords} records have a state set`;
  }, [coverage]);

  if (!allowed) return null;

  const selectCls =
    'border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/admin" className="text-slate-500 hover:text-slate-700">← Back</Link>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">IP &amp; Patents</h1>
          <p className="text-slate-500 mt-1">
            Review what founders want to publish, and see innovation activity across the ecosystem
          </p>
        </div>
      </div>

      {analytics?.queue?.pendingReview > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-6 flex items-center justify-between gap-4 flex-wrap">
          <p className="text-sm text-blue-900">
            <span className="font-semibold">{analytics.queue.pendingReview}</span> record
            {analytics.queue.pendingReview === 1 ? '' : 's'} waiting for review. Nothing goes on the public
            registry until you approve it.
          </p>
          <button
            onClick={() => setReviewStatus('PENDING_REVIEW')}
            className="text-sm font-medium text-blue-700 hover:text-blue-900"
          >
            Show the queue →
          </button>
        </div>
      )}

      {/* ---------- Gujarat overview ---------- */}
      <section className="mb-10">
        <div className="flex items-baseline justify-between gap-4 flex-wrap mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {analytics?.focusState ?? 'Gujarat'} Innovation &amp; IP Overview
          </h2>
          {/* Without this line a bare "31" reads as "31 of everyone". */}
          <p className="text-xs text-slate-400">{stateCoverageNote}</p>
        </div>

        {!analytics ? (
          <SkeletonStatRow count={5} />
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard label={`${analytics.focusState} founders`} value={focus.foundersWithIp} sub="with an IP record" />
            <StatCard label="Patent applications" value={focus.applications} sub="filed or beyond" />
            <StatCard label="Granted" value={focus.granted} />
            <StatCard label="Pending" value={focus.pending} sub="filed, awaiting decision" />
            <StatCard label="Cities represented" value={focus.citiesRepresented} />
          </div>
        )}
      </section>

      {/* ---------- Platform-wide totals ---------- */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Across the whole platform</h2>
        {!analytics ? (
          <SkeletonStatRow count={4} />
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total IP records" value={analytics.overall.totalRecords} />
            <StatCard label="Patents" value={analytics.overall.totalPatents} />
            <StatCard label="Founders with IP" value={analytics.overall.foundersWithIp} />
            <StatCard
              label="Live on the registry"
              value={analytics.queue.live}
              sub={`${analytics.overall.rejectedOrExpired} rejected or expired`}
            />
          </div>
        )}
      </section>

      {/* ---------- Charts ---------- */}
      {analytics && (
        <section className="grid lg:grid-cols-2 gap-4 mb-10">
          <Chart
            title="Patent applications over time"
            note="By filing date, or when the record was added if no date was given"
            hasData={(charts?.applicationsOverTime ?? []).some((p: any) => p.value > 0)}
          >
            <LineChart data={charts?.applicationsOverTime ?? []} />
          </Chart>

          <Chart title="IP type distribution" hasData={(charts?.typeDistribution ?? []).length > 0}>
            <HBarChart data={toBars(charts?.typeDistribution ?? [], ipTypeLabel)} />
          </Chart>

          <Chart title="Patent status distribution" hasData={(charts?.statusDistribution ?? []).length > 0}>
            <HBarChart data={toBars(charts?.statusDistribution ?? [], ipStatusLabel)} />
          </Chart>

          <Chart
            title={`${analytics.focusState} cities`}
            note={`${coverage?.recordsWithCity ?? 0} of ${coverage?.totalRecords ?? 0} records name a city`}
            hasData={(charts?.focusCityDistribution ?? []).length > 0}
          >
            <HBarChart data={toBars(charts?.focusCityDistribution ?? [])} />
          </Chart>

          <Chart
            title={`${analytics.focusState} colleges & institutions`}
            note={`${coverage?.recordsWithInstitution ?? 0} of ${coverage?.totalRecords ?? 0} records name one`}
            hasData={(charts?.focusInstitutionDistribution ?? []).length > 0}
          >
            <HBarChart data={toBars(charts?.focusInstitutionDistribution ?? [])} />
          </Chart>

          <Chart title="All states" hasData={(charts?.stateDistribution ?? []).length > 0}>
            <HBarChart data={toBars(charts?.stateDistribution ?? [])} />
          </Chart>
        </section>
      )}

      {/* ---------- Table ---------- */}
      <section>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">All records</h2>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          {REVIEW_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setReviewStatus(t)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                reviewStatus === t
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-slate-300 text-slate-600 hover:border-blue-400'
              }`}
            >
              {t === 'ALL' ? 'All' : ipReviewMeta(t).label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setAppliedQ(q);
            }}
            className="flex-1 min-w-[220px] flex gap-2"
          >
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Founder, startup, title or application number…"
              className={`${selectCls} flex-1`}
            />
            <button type="submit" className="text-sm px-3 py-2 rounded-lg border border-slate-300 hover:border-blue-400">
              Search
            </button>
          </form>

          <select value={type} onChange={(e) => setType(e.target.value)} className={selectCls}>
            <option value="ALL">All types</option>
            {IP_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectCls}>
            <option value="ALL">Any status</option>
            {IP_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          <select value={state} onChange={(e) => setState(e.target.value)} className={selectCls}>
            <option value="ALL">Any state</option>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <input
            value={jurisdiction}
            onChange={(e) => setJurisdiction(e.target.value)}
            placeholder="Jurisdiction"
            className={`${selectCls} w-36`}
          />
          <input
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            placeholder="Institution"
            className={`${selectCls} w-40`}
          />
          <label className="text-xs text-slate-500 flex items-center gap-1.5">
            Filed
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={selectCls} />
            to
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={selectCls} />
          </label>
        </div>

        {rows === null ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="📜"
            title="No records match"
            body="Try a different review status, or clear a filter to widen the search."
            compact
          />
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left">
                <tr className="text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-medium">Founder</th>
                  <th className="px-4 py-3 font-medium">Startup</th>
                  <th className="px-4 py-3 font-medium">IP title</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Jurisdiction</th>
                  <th className="px-4 py-3 font-medium">Filed</th>
                  <th className="px-4 py-3 font-medium">Visibility</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => {
                  const review = ipReviewMeta(r.reviewStatus);
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-800">{r.founder?.name}</p>
                        <p className="text-xs text-slate-400">
                          {[r.city, r.state].filter(Boolean).join(', ') || '—'}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{r.startupName || '—'}</td>
                      <td className="px-4 py-3">
                        <p className="text-slate-800">{r.title}</p>
                        {r.institution && <p className="text-xs text-slate-400">{r.institution}</p>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{ipTypeLabel(r.type)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={ipStatusTone(r.status)}>{ipStatusLabel(r.status)}</StatusBadge>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{r.jurisdiction || '—'}</td>
                      <td className="px-4 py-3 text-slate-600 tabular-nums">
                        {r.filingDate ? new Date(r.filingDate).getUTCFullYear() : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={review.tone}>{review.label}</StatusBadge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/admin/ip/${r.id}`} className="text-blue-700 hover:underline font-medium">
                          Review
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {rows && rows.length > 0 && (
          <p className="text-xs text-slate-400 mt-3">
            {rows.length} record{rows.length === 1 ? '' : 's'}. {IP_DISCLAIMER}
          </p>
        )}
      </section>
    </div>
  );
}

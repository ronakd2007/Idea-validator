'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAdminGuard } from '@/lib/adminGuard';
import ActivityDetailPanel from '@/components/admin/ActivityDetailPanel';
import {
  ROLE_STYLE, CATEGORY_STYLE, ACTIVITY_ROLES, ACTIVITY_CATEGORIES, DATE_RANGES,
  rangeStart, timeAgo, targetHref,
} from '@/lib/adminActivity';

const PAGE_SIZE = 50;

export default function AdminActivityPage() {
  const allowed = useAdminGuard();

  const [summary, setSummary] = useState<any>(null);
  const [feed, setFeed] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [openActivityId, setOpenActivityId] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('ALL');
  const [category, setCategory] = useState('ALL');
  const [range, setRange] = useState('7D');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (opts.silent) setRefreshing(true); else setLoading(true);
    setError('');

    const from = range === 'CUSTOM'
      ? (customFrom ? new Date(customFrom).toISOString() : undefined)
      : rangeStart(range);
    // Custom "to" is a date; include the whole of that day.
    const to = range === 'CUSTOM' && customTo
      ? new Date(new Date(customTo).setHours(23, 59, 59, 999)).toISOString()
      : undefined;

    try {
      const [s, f] = await Promise.all([
        api.getAdminActivitySummary(),
        api.getAdminActivity({ search, role, category, from, to, page, pageSize: PAGE_SIZE }),
      ]);
      setSummary(s);
      setFeed(f);
    } catch (err: any) {
      setError(err.message || 'Could not load activity');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, role, category, range, customFrom, customTo, page]);

  useEffect(() => {
    if (!allowed) return;
    load();
  }, [allowed, load]);

  // Any filter change starts again from the first page.
  const setFilter = (fn: () => void) => { fn(); setPage(1); };

  const stats = summary ? [
    { label: 'Total Activities', value: summary.totalActivities },
    { label: 'Active Users', value: summary.activeUsers },
    { label: 'Ideas Created', value: summary.ideasCreated },
    { label: 'Surveys Created', value: summary.surveysCreated },
    { label: 'Responses Submitted', value: summary.responsesSubmitted },
    { label: 'Validators Active', value: summary.validatorsActive },
  ] : [];

  if (!allowed) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-slate-500 hover:text-slate-700">← Back</Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Activity</h1>
            <p className="text-slate-500 mt-1">What people are doing on the platform</p>
          </div>
        </div>
        <button onClick={() => load({ silent: true })} disabled={refreshing}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Today&apos;s activity</h2>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="bg-white border border-slate-200 shadow-sm rounded-xl p-4">
            <div className="text-2xl font-black text-slate-900">{s.value}</div>
            <div className="text-xs text-slate-500 mt-1">{s.label}</div>
          </div>
        ))}
        {!summary && <div className="col-span-2 md:col-span-6 text-slate-500 text-sm">Loading summary...</div>}
      </div>

      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 mb-6 space-y-3">
        <div className="flex gap-3 flex-wrap items-center">
          <input
            value={search}
            onChange={(e) => setFilter(() => setSearch(e.target.value))}
            placeholder="Search user, email or target..."
            className="flex-1 min-w-[220px] border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
          />
          <select value={role} onChange={(e) => setFilter(() => setRole(e.target.value))}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
            {ACTIVITY_ROLES.map((r) => <option key={r} value={r}>{r === 'ALL' ? 'All roles' : r}</option>)}
          </select>
          <select value={category} onChange={(e) => setFilter(() => setCategory(e.target.value))}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
            {ACTIVITY_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select value={range} onChange={(e) => setFilter(() => setRange(e.target.value))}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white">
            {DATE_RANGES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>

        {range === 'CUSTOM' && (
          <div className="flex gap-3 items-center flex-wrap">
            <label className="text-sm text-slate-500">From</label>
            <input type="date" value={customFrom} onChange={(e) => setFilter(() => setCustomFrom(e.target.value))}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
            <label className="text-sm text-slate-500">To</label>
            <input type="date" value={customTo} onChange={(e) => setFilter(() => setCustomTo(e.target.value))}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        )}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-6">{error}</div>}
      {loading && <div className="text-center py-20 text-slate-500">Loading...</div>}

      {!loading && feed && (
        <>
          <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[860px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-6 py-3 font-medium text-slate-500">User</th>
                    <th className="text-left px-6 py-3 font-medium text-slate-500">Role</th>
                    <th className="text-left px-6 py-3 font-medium text-slate-500">Activity</th>
                    <th className="text-left px-6 py-3 font-medium text-slate-500">Target</th>
                    <th className="text-left px-6 py-3 font-medium text-slate-500">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {feed.items.map((a: any) => {
                    const href = targetHref(a);
                    return (
                      <tr key={a.id} onClick={() => setOpenActivityId(a.id)}
                        className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer">
                        <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">
                          {a.userId ? (
                            <Link href={`/admin/users/${a.userId}`} onClick={(e) => e.stopPropagation()}
                              className="text-blue-600 hover:text-blue-700">
                              {a.actorLabel}
                            </Link>
                          ) : (
                            <span className="text-slate-500">{a.actorLabel}</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${ROLE_STYLE[a.actorRole] || 'bg-slate-100 text-slate-700'}`}>
                            {a.actorRole}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-900">{a.actionLabel}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_STYLE[a.category] || 'bg-slate-100 text-slate-700'}`}>
                              {a.category}
                            </span>
                          </div>
                        </td>
                        {/* truncate needs a block box — on a <td> the auto table
                            layout treats max-width as a hint and drops both. */}
                        <td className="px-6 py-4 text-slate-600">
                          <div className="max-w-[240px] truncate">
                            {href ? (
                              <Link href={href} onClick={(e) => e.stopPropagation()} className="text-blue-600 hover:text-blue-700">
                                {a.targetLabel || '—'}
                              </Link>
                            ) : (a.targetLabel || '—')}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-500 whitespace-nowrap">{timeAgo(a.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {feed.items.length === 0 && (
              <div className="text-center py-16 text-slate-500">
                No activity matches these filters.
              </div>
            )}
          </div>

          {feed.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-slate-500">
                Page {feed.page} of {feed.totalPages} · {feed.total} activities
              </span>
              <div className="flex gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={feed.page <= 1}
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-600 hover:border-blue-400 disabled:opacity-40">
                  Previous
                </button>
                <button onClick={() => setPage((p) => p + 1)} disabled={feed.page >= feed.totalPages}
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-600 hover:border-blue-400 disabled:opacity-40">
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {openActivityId && (
        <ActivityDetailPanel activityId={openActivityId} onClose={() => setOpenActivityId(null)} />
      )}
    </div>
  );
}

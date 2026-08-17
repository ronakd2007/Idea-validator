'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAdminGuard } from '@/lib/adminGuard';
import { Skeleton } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';

const STATUS_STYLE: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  PENDING_REVIEW: 'bg-blue-50 text-blue-700',
  CHANGES_REQUESTED: 'bg-amber-50 text-amber-700',
  APPROVED: 'bg-emerald-50 text-emerald-700',
  REJECTED: 'bg-red-50 text-red-700',
};
const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft', PENDING_REVIEW: 'Pending', CHANGES_REQUESTED: 'Changes', APPROVED: 'Approved', REJECTED: 'Rejected',
};
const TABS = ['PENDING_REVIEW', 'ALL', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED', 'DRAFT'];

export default function AdminStartupsPage() {
  const allowed = useAdminGuard();
  const [rows, setRows] = useState<any[] | null>(null);
  const [status, setStatus] = useState('PENDING_REVIEW');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!allowed) return;
    setRows(null);
    api.getAdminStartups(status).then(setRows).catch(() => setRows([]));
  }, [allowed, status]);

  if (!allowed) return null;

  const term = search.trim().toLowerCase();
  const filtered = (rows ?? []).filter(
    (r) => !term || r.name?.toLowerCase().includes(term) || r.founder?.name?.toLowerCase().includes(term)
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/admin" className="text-slate-500 hover:text-slate-700">← Back</Link>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Startup Directory</h1>
          <p className="text-slate-500 mt-1">Review founder listings before they appear publicly</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        {TABS.map((t) => (
          <button key={t} onClick={() => setStatus(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
              status === t ? 'bg-blue-600 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:border-blue-400'
            }`}>
            {t === 'ALL' ? 'All' : STATUS_LABEL[t]}
          </button>
        ))}
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search startup or founder…"
          className="ml-auto w-full sm:w-64 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400" />
      </div>

      {rows === null ? (
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 space-y-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState compact title="Nothing here" body={term ? 'No startups match your search.' : 'No startups with this status yet.'} />
      ) : (
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Startup', 'Founder', 'Industry', 'Validation', 'Submitted', 'Status', ''].map((h) => (
                  <th key={h} className="text-left px-6 py-3 font-medium text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <Link href={`/admin/startups/${r.id}`} className="font-medium text-blue-600 hover:text-blue-700">{r.name}</Link>
                    <p className="text-xs text-slate-400 mt-0.5">{r.location || '—'}</p>
                  </td>
                  <td className="px-6 py-4">
                    <Link href={`/admin/users/${r.founder?.id}`} className="text-slate-700 hover:text-blue-600">{r.founder?.name}</Link>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{r.industry || '—'}</td>
                  <td className="px-6 py-4">
                    {r.validationScore != null ? (
                      <span className="text-slate-900 font-semibold tabular-nums">{r.validationScore}<span className="text-xs text-slate-400">/100</span></span>
                    ) : <span className="text-slate-300">—</span>}
                    <p className="text-xs text-slate-400 mt-0.5">{r.validatorCount} expert{r.validatorCount === 1 ? '' : 's'}</p>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{r.submittedAt ? new Date(r.submittedAt).toLocaleDateString() : '—'}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                  </td>
                  <td className="px-6 py-4">
                    <Link href={`/admin/startups/${r.id}`}
                      className="text-xs px-3 py-1 rounded border border-slate-300 text-slate-600 font-medium hover:border-blue-400 hover:text-blue-600 transition">
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

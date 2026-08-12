'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';

const STATUS_STYLE: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  LIVE: 'bg-emerald-50 text-emerald-700',
  CLOSED: 'bg-amber-50 text-amber-700',
};

export default function AdminSurveysPage() {
  const router = useRouter();
  const [surveys, setSurveys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const user = getStoredUser();
    if (!user || user.role !== 'ADMIN') { router.push('/auth/login'); return; }
    api.getAdminSurveys().then(setSurveys).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const toggleStatus = async (id: string) => {
    setActionLoading(id);
    try {
      const updated = await api.adminToggleSurveyStatus(id);
      setSurveys((s) => s.map((x) => (x.id === id ? { ...x, status: updated.status } : x)));
    } catch (err: any) { alert(err.message); }
    finally { setActionLoading(null); }
  };

  const deleteSurvey = async (id: string, title: string) => {
    if (!confirm(`Delete survey "${title}"? This cannot be undone.`)) return;
    setActionLoading(id);
    try {
      await api.adminDeleteSurvey(id);
      setSurveys((s) => s.filter((x) => x.id !== id));
    } catch (err: any) { alert(err.message); }
    finally { setActionLoading(null); }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/admin" className="text-slate-500 hover:text-slate-700">← Back</Link>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Manage Surveys</h1>
          <p className="text-slate-500 mt-1">{surveys.length} surveys total</p>
        </div>
      </div>

      {loading && <div className="text-center py-20 text-slate-500">Loading...</div>}

      <div className="space-y-4">
        {surveys.map((s) => (
          <div key={s.id} className="bg-white border border-slate-200 shadow-sm rounded-xl p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-[240px]">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <h3 className="text-lg font-semibold text-slate-900">{s.title}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_STYLE[s.status] || 'bg-slate-100 text-slate-700'}`}>
                    {s.status}
                  </span>
                  {s.versionNumber > 1 && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">v{s.versionNumber}</span>}
                </div>
                <p className="text-sm text-slate-500 mb-2">{s.idea?.title || 'Standalone survey'}</p>
                <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                  <span>By: {s.founder?.name} ({s.founder?.email})</span>
                  <span>{s._count.questions} questions</span>
                  <span>{s._count.responses} responses</span>
                  <span>Created {new Date(s.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {s.publicId && (
                  <a href={`/survey/${s.publicId}`} target="_blank" rel="noopener noreferrer"
                    className="bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-100 whitespace-nowrap">
                    View
                  </a>
                )}
                {(s.status === 'LIVE' || s.status === 'CLOSED') && (
                  <button onClick={() => toggleStatus(s.id)} disabled={actionLoading === s.id}
                    className="bg-amber-50 text-amber-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-amber-100 disabled:opacity-50 whitespace-nowrap">
                    {actionLoading === s.id ? '...' : s.status === 'LIVE' ? 'Close' : 'Reopen'}
                  </button>
                )}
                <button onClick={() => deleteSurvey(s.id, s.title)} disabled={actionLoading === s.id}
                  className="bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-100 disabled:opacity-50 whitespace-nowrap">
                  {actionLoading === s.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        ))}
        {!loading && surveys.length === 0 && (
          <div className="text-center py-20 text-slate-500">No surveys created yet</div>
        )}
      </div>
    </div>
  );
}

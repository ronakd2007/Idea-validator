'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';

export default function AdminIdeasPage() {
  const router = useRouter();
  const [ideas, setIdeas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const user = getStoredUser();
    if (!user || user.role !== 'ADMIN') { router.push('/auth/login'); return; }
    api.getAdminIdeas().then(setIdeas).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const deleteIdea = async (id: string, title: string) => {
    if (!confirm(`Delete idea "${title}"? This cannot be undone.`)) return;
    setActionLoading(id);
    try {
      await api.deleteIdea(id);
      setIdeas(i => i.filter(x => x.id !== id));
    } catch (err: any) { alert(err.message); }
    finally { setActionLoading(null); }
  };

  const stageColor: Record<string, string> = {
    IDEA: 'bg-slate-100 text-slate-700', RESEARCH: 'bg-blue-50 text-blue-700',
    PROTOTYPE: 'bg-amber-50 text-amber-700', MVP: 'bg-orange-50 text-orange-700',
    REVENUE_GENERATING: 'bg-emerald-50 text-emerald-700',
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex items-center gap-4 mb-8">
        <Link href="/admin" className="text-slate-500 hover:text-slate-700">← Back</Link>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Manage Ideas</h1>
          <p className="text-slate-500 mt-1">{ideas.length} ideas total</p>
        </div>
      </div>

      {loading && <div className="text-center py-20 text-slate-500">Loading...</div>}

      <div className="space-y-4">
        {ideas.map(idea => (
          <div key={idea.id} className="bg-white border border-slate-200 shadow-sm rounded-xl p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold text-slate-900">{idea.title}</h3>
                  {idea.isRevision && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">v{idea.version}</span>}
                </div>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${stageColor[idea.stage]}`}>{idea.stage.replace('_', ' ')}</span>
                  <span className="text-xs text-slate-500">{idea.industryCategory}</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${idea.paymentStatus === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                    {idea.paymentStatus === 'COMPLETED' ? 'Paid' : 'Payment Pending'}
                  </span>
                </div>
                <p className="text-sm text-slate-600 mb-2 line-clamp-2">{idea.problemStatement}</p>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <span>By: {idea.founder?.name} ({idea.founder?.email})</span>
                  <span>{idea._count.validations} validations</span>
                  <span>Submitted {new Date(idea.submittedAt).toLocaleDateString()}</span>
                </div>
              </div>
              <button onClick={() => deleteIdea(idea.id, idea.title)} disabled={actionLoading === idea.id}
                className="ml-4 bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-100 disabled:opacity-50 whitespace-nowrap">
                {actionLoading === idea.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        ))}
        {!loading && ideas.length === 0 && (
          <div className="text-center py-20 text-slate-500">No ideas submitted yet</div>
        )}
      </div>
    </div>
  );
}

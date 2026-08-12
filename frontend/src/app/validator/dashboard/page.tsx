'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';

export default function ValidatorDashboardPage() {
  const router = useRouter();
  const [ideas, setIdeas] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'available' | 'history'>('available');

  useEffect(() => {
    const user = getStoredUser();
    if (!user || user.role !== 'VALIDATOR') { router.push('/auth/login'); return; }
    Promise.all([api.getAllIdeas(), api.getValidationHistory()])
      .then(([i, h]) => { setIdeas(i); setHistory(h); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const validatedIds = new Set(history.map((h: any) => h.ideaId));

  const stageColor: Record<string, string> = {
    IDEA: 'bg-slate-100 text-slate-700',
    RESEARCH: 'bg-blue-50 text-blue-700',
    PROTOTYPE: 'bg-amber-50 text-amber-700',
    MVP: 'bg-orange-50 text-orange-700',
    REVENUE_GENERATING: 'bg-emerald-50 text-emerald-700',
  };

  return (
    <div className="max-w-5xl mx-auto px-8 py-10">
      {/* Top header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Validator Dashboard</h1>
          <p className="text-slate-500 mt-1">Review and evaluate business ideas from founders</p>
        </div>
        <span className="text-xs px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 font-medium">
          {ideas.length - validatedIds.size} awaiting review
        </span>
      </div>

      <div className="flex gap-1 mb-6 bg-slate-100 p-1 rounded-lg w-fit">
        {[{ id: 'available', label: `Available (${ideas.length - validatedIds.size})` }, { id: 'history', label: `Reviewed (${history.length})` }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div className="text-center py-20 text-slate-500">Loading...</div>}

      {!loading && tab === 'available' && (
        <div className="space-y-4">
          {ideas.filter(i => !validatedIds.has(i.id)).length === 0 && (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">✅</div>
              <h2 className="text-xl font-semibold text-slate-800">All caught up!</h2>
              <p className="text-slate-500 mt-2">No ideas available for review right now.</p>
            </div>
          )}
          {ideas.filter(i => !validatedIds.has(i.id)).map(idea => (
            <div key={idea.id} className="bg-white border border-slate-200 shadow-sm rounded-xl p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-slate-900">{idea.title}</h3>
                  </div>
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${stageColor[idea.stage] || 'bg-slate-100 text-slate-700'}`}>{idea.stage.replace('_', ' ')}</span>
                    <span className="text-xs text-slate-500">{idea.industryCategory}</span>
                    <span className="text-xs text-slate-500">{idea._count.validations} reviews so far</span>
                  </div>
                  <p className="text-sm text-slate-700 font-medium mb-1">Problem:</p>
                  <p className="text-sm text-slate-500 line-clamp-2">{idea.problemStatement}</p>
                </div>
                <Link href={`/validator/ideas/${idea.id}/validate`}
                  className="ml-4 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 whitespace-nowrap">
                  Validate
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && tab === 'history' && (
        <div className="space-y-4">
          {history.length === 0 && (
            <div className="text-center py-20">
              <p className="text-slate-500">You haven't validated any ideas yet.</p>
            </div>
          )}
          {history.map((h: any) => (
            <div key={h.id} className="bg-white border border-slate-200 shadow-sm rounded-xl p-6">
              <h3 className="font-semibold text-slate-900">{h.idea.title}</h3>
              <p className="text-sm text-slate-500 mt-1">{h.idea.industryCategory}</p>
              <p className="text-xs text-slate-500 mt-2">Reviewed on {new Date(h.createdAt).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

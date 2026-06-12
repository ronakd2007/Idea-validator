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
    IDEA: 'bg-gray-100 text-gray-600',
    RESEARCH: 'bg-blue-100 text-blue-700',
    PROTOTYPE: 'bg-yellow-100 text-yellow-700',
    MVP: 'bg-orange-100 text-orange-700',
    REVENUE_GENERATING: 'bg-green-100 text-green-700',
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Validator Dashboard</h1>
        <p className="text-gray-500 mt-1">Review and evaluate business ideas from founders</p>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {[{ id: 'available', label: `Available (${ideas.length - validatedIds.size})` }, { id: 'history', label: `Reviewed (${history.length})` }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${tab === t.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div className="text-center py-20 text-gray-400">Loading...</div>}

      {!loading && tab === 'available' && (
        <div className="space-y-4">
          {ideas.filter(i => !validatedIds.has(i.id)).length === 0 && (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">✅</div>
              <h2 className="text-xl font-semibold text-gray-700">All caught up!</h2>
              <p className="text-gray-500 mt-2">No ideas available for review right now.</p>
            </div>
          )}
          {ideas.filter(i => !validatedIds.has(i.id)).map(idea => (
            <div key={idea.id} className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{idea.title}</h3>
                  </div>
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${stageColor[idea.stage] || 'bg-gray-100'}`}>{idea.stage.replace('_', ' ')}</span>
                    <span className="text-xs text-gray-500">{idea.industryCategory}</span>
                    <span className="text-xs text-gray-400">{idea._count.validations} reviews so far</span>
                  </div>
                  <p className="text-sm text-gray-600 font-medium mb-1">Problem:</p>
                  <p className="text-sm text-gray-500 line-clamp-2">{idea.problemStatement}</p>
                </div>
                <Link href={`/validator/ideas/${idea.id}/validate`}
                  className="ml-4 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 whitespace-nowrap">
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
              <p className="text-gray-500">You haven't validated any ideas yet.</p>
            </div>
          )}
          {history.map((h: any) => (
            <div key={h.id} className="bg-white border border-gray-200 rounded-xl p-6">
              <h3 className="font-semibold text-gray-900">{h.idea.title}</h3>
              <p className="text-sm text-gray-500 mt-1">{h.idea.industryCategory}</p>
              <p className="text-xs text-gray-400 mt-2">Reviewed on {new Date(h.createdAt).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

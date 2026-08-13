'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  LIVE: 'bg-emerald-50 text-emerald-700',
  CLOSED: 'bg-amber-50 text-amber-700',
  ARCHIVED: 'bg-slate-100 text-slate-500',
};

const STATUS_DOT: Record<string, string> = {
  DRAFT: 'bg-slate-400',
  LIVE: 'bg-emerald-500',
  CLOSED: 'bg-amber-500',
  ARCHIVED: 'bg-slate-400',
};

export default function MySurveysPage() {
  const router = useRouter();
  const [surveys, setSurveys] = useState<any[]>([]);
  const [ideas, setIdeas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [createStep, setCreateStep] = useState<'choice' | 'manual' | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [selectedIdeaId, setSelectedIdeaId] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const user = getStoredUser();
    if (!user || user.role !== 'FOUNDER') { router.push('/auth/login'); return; }
    api.getMySurveys().then(setSurveys).catch(() => {}).finally(() => setLoading(false));
    api.getMyIdeas().then(setIdeas).catch(() => {});
  }, []);

  const openCreate = () => {
    setNewTitle('');
    setSelectedIdeaId('');
    setCreateStep('choice');
  };

  // A survey never requires an Idea — the idea link below is purely optional.
  const createSurvey = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const survey = await api.createSurvey({ ideaId: selectedIdeaId || undefined, title: newTitle.trim(), description: '' });
      router.push(`/founder/surveys/${survey.id}/edit`);
    } catch {
      setCreating(false);
    }
  };

  const copyLink = async (survey: any) => {
    if (!survey.publicId) return;
    const url = `${window.location.origin}/survey/${survey.publicId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(survey.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // clipboard API can be unavailable — nothing to fall back to from a list row
    }
  };

  const closeSurvey = async (survey: any) => {
    if (!window.confirm('Close this survey?\n\nRespondents will no longer be able to submit responses.')) return;
    try {
      const updated = await api.closeSurvey(survey.id);
      setSurveys((prev) => prev.map((s) => (s.id === survey.id ? { ...s, status: updated.status } : s)));
    } catch {
      // surfaced implicitly — status simply won't change; founder can retry from the builder
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My Surveys</h1>
          <p className="text-slate-500 mt-1">Mass surveys you&apos;ve created</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/founder/ideas" className="bg-white border border-slate-200 text-slate-700 px-5 py-2.5 rounded-lg font-semibold hover:border-slate-300 transition">
            Go to My Ideas
          </Link>
          <button onClick={openCreate} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition">
            + Create Survey
          </button>
        </div>
      </div>

      {loading && <div className="text-center py-20 text-slate-500">Loading...</div>}

      {!loading && surveys.length === 0 && (
        <div className="text-center py-20">
          <h2 className="text-xl font-semibold text-slate-800 mb-2">No surveys yet</h2>
          <p className="text-slate-500 mb-6">Create a Mass Survey to start collecting structured feedback — no idea required.</p>
          <button onClick={openCreate} className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-semibold">+ Create Survey</button>
        </div>
      )}

      {createStep === 'choice' && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center px-4 z-50" onClick={() => setCreateStep(null)}>
          <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Create a Survey</h3>
            <p className="text-sm text-slate-500 mb-5">How would you like to create your survey?</p>

            <div className="space-y-3">
              <button onClick={() => setCreateStep('manual')}
                className="w-full text-left border border-slate-200 rounded-lg p-4 hover:border-blue-400 hover:bg-blue-50/40 transition">
                <p className="font-semibold text-slate-900">Build Manually</p>
                <p className="text-sm text-slate-500 mt-0.5">Create your questions and form yourself.</p>
              </button>
              <Link href="/founder/surveys/generate"
                className="block text-left border border-slate-200 rounded-lg p-4 hover:border-blue-400 hover:bg-blue-50/40 transition">
                <p className="font-semibold text-slate-900">✨ AI Builder</p>
                <p className="text-sm text-slate-500 mt-0.5">Paste your questions and let AI build the form for you.</p>
              </Link>
            </div>

            <div className="flex justify-end mt-5">
              <button onClick={() => setCreateStep(null)} className="text-sm px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {createStep === 'manual' && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center px-4 z-50" onClick={() => !creating && setCreateStep(null)}>
          <div className="bg-white rounded-xl border border-slate-200 shadow-lg p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Build Manually</h3>
            <p className="text-sm text-slate-500 mb-4">Surveys don&apos;t need to be linked to an idea — you can run one standalone.</p>

            <label className="block text-xs font-medium text-slate-600 mb-1.5">Survey title</label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Customer Problem Survey"
              autoFocus
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-4"
            />

            {ideas.length > 0 && (
              <>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">Link to an idea (optional)</label>
                <select
                  value={selectedIdeaId}
                  onChange={(e) => setSelectedIdeaId(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-5"
                >
                  <option value="">No idea — standalone survey</option>
                  {ideas.map((idea) => (
                    <option key={idea.id} value={idea.id}>{idea.title}</option>
                  ))}
                </select>
              </>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={() => setCreateStep('choice')} disabled={creating} className="text-sm px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-60">Back</button>
              <button onClick={createSurvey} disabled={!newTitle.trim() || creating} className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-60">
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {surveys.map((s) => (
          <div key={s.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0 sm:min-w-[240px]">
              <h3 className="text-lg font-semibold text-slate-900">{s.title || 'Untitled survey'}</h3>
              <p className="text-sm text-slate-500 mt-0.5">{s.idea?.title || 'Standalone survey'}</p>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full font-medium ${STATUS_BADGE[s.status] || STATUS_BADGE.DRAFT}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[s.status] || STATUS_DOT.DRAFT}`} />
                  {s.status}
                </span>
                <span className="text-xs text-slate-400">{s._count?.questions ?? 0} question{s._count?.questions !== 1 ? 's' : ''}</span>
                {s.status !== 'DRAFT' && (
                  <span className="text-xs text-slate-400">{s._count?.responses ?? 0} response{s._count?.responses !== 1 ? 's' : ''}</span>
                )}
                <span className="text-xs text-slate-400">Created {new Date(s.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Link href={`/founder/surveys/${s.id}/edit`} className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 text-center">
                {s.status === 'DRAFT' ? 'Open Builder' : 'Manage'}
              </Link>
              {s.status === 'DRAFT' && (
                <Link href={`/founder/surveys/${s.id}/edit?mode=preview`} className="text-sm bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg hover:border-slate-300 text-center">
                  Preview
                </Link>
              )}
              {s.status !== 'DRAFT' && (
                <>
                  <Link href={`/founder/surveys/${s.id}/analytics`} className="text-sm bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg hover:border-slate-300 text-center">
                    Analytics
                  </Link>
                  <Link href={`/founder/surveys/${s.id}/responses`} className="text-sm bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg hover:border-slate-300 text-center">
                    Responses
                  </Link>
                  <button onClick={() => copyLink(s)} className="text-sm bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg hover:border-slate-300 text-center">
                    {copiedId === s.id ? 'Copied!' : 'Copy Link'}
                  </button>
                </>
              )}
              {s.status === 'LIVE' && (
                <button onClick={() => closeSurvey(s)} className="text-sm bg-white border border-red-200 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 text-center">
                  Close Survey
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

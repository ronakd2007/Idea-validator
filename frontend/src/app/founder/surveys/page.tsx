'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import SurveyQrModal from '@/components/survey/SurveyQrModal';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import StatusBadge, { STATUS_TONE } from '@/components/ui/StatusBadge';
import { SkeletonList } from '@/components/ui/Skeleton';
import { useToast, useConfirm } from '@/components/ui/feedback';

export default function MySurveysPage() {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [surveys, setSurveys] = useState<any[] | null>(null);
  const [ideas, setIdeas] = useState<any[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [qrSurvey, setQrSurvey] = useState<any>(null);
  const [createStep, setCreateStep] = useState<'choice' | 'manual' | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [selectedIdeaId, setSelectedIdeaId] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const user = getStoredUser();
    if (!user || user.role !== 'FOUNDER') { router.push('/auth/login'); return; }
    api.getMySurveys().then(setSurveys).catch(() => setSurveys([]));
    api.getMyIdeas().then(setIdeas).catch(() => {});
  }, []);

  const openCreate = () => {
    setNewTitle('');
    setSelectedIdeaId('');
    setCreateStep('choice');
  };

  // A survey never requires an Idea — the idea link below is purely optional.
  const [titleError, setTitleError] = useState('');

  const createSurvey = async () => {
    if (!newTitle.trim()) { setTitleError('Give your survey a title before creating it.'); return; }
    setTitleError('');
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
    const ok = await confirm({
      title: 'Close this survey?',
      body: 'Respondents will no longer be able to submit responses. You can reopen it later from the builder.',
      confirmLabel: 'Close Survey',
      danger: true,
    });
    if (!ok) return;
    try {
      const updated = await api.closeSurvey(survey.id);
      setSurveys((prev) => (prev ?? []).map((s) => (s.id === survey.id ? { ...s, status: updated.status } : s)));
      toast.success(`"${survey.title || 'Survey'}" closed — it no longer accepts responses.`);
    } catch (err: any) {
      toast.error(err.message || 'Could not close the survey. Please try again.');
    }
  };

  const secondaryBtn = 'text-sm bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg hover:border-slate-300 text-center transition';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <PageHeader
        title="My Surveys"
        subtitle="Build, share and analyze mass surveys"
        actions={
          <button onClick={openCreate} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 transition">
            + Create Survey
          </button>
        }
      />

      {surveys === null && <SkeletonList />}

      {surveys !== null && surveys.length === 0 && (
        <EmptyState
          icon="📋"
          title="No surveys yet"
          body="Surveys collect structured answers from real people in your target market — evidence you can put next to expert validation. No idea submission required."
          action={
            <button onClick={openCreate} className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 transition">
              + Create Survey
            </button>
          }
        />
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
              onChange={(e) => { setNewTitle(e.target.value); setTitleError(''); }}
              placeholder="e.g. Customer Problem Survey"
              autoFocus
              className={`w-full border rounded-lg px-3 py-2 text-sm ${titleError ? 'border-red-400 bg-red-50 mb-1' : 'border-slate-200 mb-4'}`}
            />
            {titleError && <p className="text-xs text-red-600 mb-3 font-medium">{titleError}</p>}

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
              <button onClick={createSurvey} disabled={creating} className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-60">
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {(surveys ?? []).map((s) => (
          <div key={s.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6 hover:border-slate-300 transition">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0 sm:min-w-[240px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-semibold text-slate-900">{s.title || 'Untitled survey'}</h3>
                  <StatusBadge tone={STATUS_TONE[s.status] || 'neutral'} dot>{s.status}</StatusBadge>
                </div>
                <p className="text-sm text-slate-500 mt-0.5">{s.idea?.title || 'Standalone survey'}</p>
                <div className="flex items-center gap-x-3 gap-y-1 mt-2.5 flex-wrap text-xs text-slate-400">
                  <span>{s._count?.questions ?? 0} question{s._count?.questions !== 1 ? 's' : ''}</span>
                  {s.status !== 'DRAFT' && (
                    <span>{s._count?.responses ?? 0} response{s._count?.responses !== 1 ? 's' : ''}</span>
                  )}
                  <span>Created {new Date(s.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 shrink-0 w-full sm:w-auto">
                <Link href={`/founder/surveys/${s.id}/edit`} className="flex-1 sm:flex-none text-sm bg-blue-600 text-white px-3.5 py-1.5 rounded-lg hover:bg-blue-700 text-center font-semibold transition">
                  {s.status === 'DRAFT' ? 'Open Builder' : 'Manage'}
                </Link>
                {s.status === 'DRAFT' && (
                  <Link href={`/founder/surveys/${s.id}/edit?mode=preview`} className={`flex-1 sm:flex-none ${secondaryBtn}`}>
                    Preview
                  </Link>
                )}
                {s.status !== 'DRAFT' && (
                  <>
                    <Link href={`/founder/surveys/${s.id}/analytics`} className={`flex-1 sm:flex-none ${secondaryBtn}`}>
                      Analytics
                    </Link>
                    <Link href={`/founder/surveys/${s.id}/responses`} className={`flex-1 sm:flex-none ${secondaryBtn}`}>
                      Responses
                    </Link>
                    <button onClick={() => copyLink(s)} className={`flex-1 sm:flex-none ${secondaryBtn}`}>
                      {copiedId === s.id ? 'Copied!' : 'Copy Link'}
                    </button>
                    {s.publicId && (
                      <button onClick={() => setQrSurvey(s)} className={`flex-1 sm:flex-none ${secondaryBtn}`}>
                        QR Code
                      </button>
                    )}
                  </>
                )}
                {s.status === 'LIVE' && (
                  <button onClick={() => closeSurvey(s)} className="flex-1 sm:flex-none text-sm bg-white border border-red-200 text-red-600 px-3.5 py-1.5 rounded-lg hover:bg-red-50 text-center transition">
                    Close Survey
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {qrSurvey && (
        <SurveyQrModal
          url={`${window.location.origin}/survey/${qrSurvey.publicId}`}
          title={qrSurvey.title}
          onClose={() => setQrSurvey(null)}
        />
      )}
    </div>
  );
}

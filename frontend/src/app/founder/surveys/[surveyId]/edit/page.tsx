'use client';
import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { QUESTION_TYPES, QuestionType, SurveyDraft, IncentiveDraft, SurveyVersion, createQuestion, duplicateQuestion, surveyFromServer } from '@/lib/surveyTypes';
import QuestionEditor from '@/components/survey/QuestionEditor';
import QuestionInspector from '@/components/survey/QuestionInspector';
import QuestionPreview from '@/components/survey/QuestionPreview';
import SurveyQrModal from '@/components/survey/SurveyQrModal';
import { useToast, useConfirm } from '@/components/ui/feedback';

const BLANK_INCENTIVE: IncentiveDraft = { title: '', description: '', numberOfWinners: 1, eligibility: '', closingDate: null, collectContact: true };

// useSearchParams() requires a Suspense boundary for static prerendering —
// dev mode never enforces this, only a real `next build` does.
export default function SurveyBuilderPage() {
  return (
    <Suspense fallback={null}>
      <SurveyBuilderInner />
    </Suspense>
  );
}

function SurveyBuilderInner() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const surveyId = params.surveyId as string;
  const toast = useToast();
  const confirm = useConfirm();

  const [survey, setSurvey] = useState<SurveyDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'build' | 'preview'>(searchParams.get('mode') === 'preview' ? 'preview' : 'build');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const [publishing, setPublishing] = useState(false);
  const [statusActionLoading, setStatusActionLoading] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [versions, setVersions] = useState<SurveyVersion[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [creatingVersion, setCreatingVersion] = useState(false);
  const [incentiveForm, setIncentiveForm] = useState<IncentiveDraft>(BLANK_INCENTIVE);
  const [incentiveSaving, setIncentiveSaving] = useState(false);
  const [incentiveError, setIncentiveError] = useState('');
  const [incentiveSavedAt, setIncentiveSavedAt] = useState<number | null>(null);
  const [showIncentive, setShowIncentive] = useState(false);
  // 3-pane builder: which question the canvas + inspector focus on.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [navAddOpen, setNavAddOpen] = useState(false);
  const navAddRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const user = getStoredUser();
    if (!user || user.role !== 'FOUNDER') { router.push('/auth/login'); return; }
    api.getSurvey(surveyId)
      .then((res) => {
        const s = surveyFromServer(res);
        setSurvey(s);
        setIncentiveForm(s.incentive || BLANK_INCENTIVE);
        setShowIncentive(!!s.incentive);
        setSelectedId(s.questions[0]?.id ?? null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    api.getSurveyVersions(surveyId).then((v) => setVersions(v.map((x: any) => ({ id: x.id, versionNumber: x.versionNumber, status: x.status, createdAt: x.createdAt, publicId: x.publicId, responseCount: x._count?.responses ?? 0 })))).catch(() => {});
  }, [surveyId]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) setAddMenuOpen(false);
      if (navAddRef.current && !navAddRef.current.contains(e.target as Node)) setNavAddOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="text-slate-500">Loading survey...</div></div>;
  if (error || !survey) return <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10"><div className="bg-red-50 text-red-700 border border-red-200 rounded-lg p-4">{error || 'Survey not found'}</div></div>;

  const patchQuestion = (id: string, patch: any) => {
    setSurvey({ ...survey, questions: survey.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)) });
  };

  const addQuestion = (type: QuestionType) => {
    const nq = createQuestion(type);
    setSurvey({ ...survey, questions: [...survey.questions, nq] });
    setAddMenuOpen(false);
    setNavAddOpen(false);
    setSelectedId(nq.id);
    // scroll after the card mounts
    setTimeout(() => document.getElementById(`qcard-${nq.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
  };

  const selectQuestion = (id: string) => {
    setSelectedId(id);
    document.getElementById(`qcard-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const moveQuestion = (index: number, dir: -1 | 1) => {
    const next = [...survey.questions];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setSurvey({ ...survey, questions: next });
  };

  const duplicateAt = (index: number) => {
    const next = [...survey.questions];
    next.splice(index + 1, 0, duplicateQuestion(next[index]));
    setSurvey({ ...survey, questions: next });
  };

  const deleteAt = (index: number) => {
    const removed = survey.questions[index];
    const remaining = survey.questions.filter((_, i) => i !== index);
    setSurvey({ ...survey, questions: remaining });
    if (removed?.id === selectedId) setSelectedId(remaining[Math.min(index, remaining.length - 1)]?.id ?? null);
  };

  // Shared by Save Draft and Publish — Publish must never validate against
  // stale DB state while the builder has unsaved local changes sitting in memory.
  const saveSurvey = () =>
    api.updateSurvey(survey.id, {
      title: survey.title,
      description: survey.description,
      responseLimit: survey.responseLimit,
      collectEmail: survey.collectEmail,
      questions: survey.questions.map((q) => ({
        id: q.id,
        type: q.type,
        questionText: q.questionText,
        description: q.description,
        required: q.required,
        settings: q.settings,
        options: q.type === 'YES_NO' ? [] : q.options.map((o) => ({ label: o.label, imageUrl: o.imageUrl })),
        isControlQuestion: q.isControlQuestion,
        consistencyPairQuestionId: q.consistencyPairQuestionId,
        abGroupKey: q.abGroupKey,
        abVariant: q.abVariant,
        mediaUrl: q.mediaUrl,
        mediaType: q.mediaType,
      })),
    });

  const saveDraft = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const res = await saveSurvey();
      setSurvey(surveyFromServer(res));
      setSavedAt(Date.now());
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const publicUrl = survey.publicId && typeof window !== 'undefined' ? `${window.location.origin}/survey/${survey.publicId}` : '';

  const publish = async () => {
    setPublishing(true);
    setSaveError('');
    try {
      await saveSurvey();
      const res = await api.publishSurvey(survey.id);
      setSurvey(surveyFromServer(res));
      toast.success('Survey is live — share the public link to start collecting responses.');
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setPublishing(false);
    }
  };

  const closeSurvey = async () => {
    const ok = await confirm({
      title: 'Close this survey?',
      body: 'Respondents will no longer be able to submit responses. You can reopen it later.',
      confirmLabel: 'Close Survey',
      danger: true,
    });
    if (!ok) return;
    setStatusActionLoading(true);
    setSaveError('');
    try {
      const res = await api.closeSurvey(survey.id);
      setSurvey(surveyFromServer(res));
      toast.success('Survey closed — it no longer accepts responses.');
    } catch (err: any) {
      setSaveError(err.message);
      toast.error(err.message || 'Could not close the survey.');
    } finally {
      setStatusActionLoading(false);
    }
  };

  const reopenSurvey = async () => {
    setStatusActionLoading(true);
    setSaveError('');
    try {
      const res = await api.reopenSurvey(survey.id);
      setSurvey(surveyFromServer(res));
      toast.success('Survey reopened — it accepts responses again.');
    } catch (err: any) {
      setSaveError(err.message);
      toast.error(err.message || 'Could not reopen the survey.');
    } finally {
      setStatusActionLoading(false);
    }
  };

  const copyLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // clipboard API can be unavailable (e.g. insecure context) — link is still shown/selectable
    }
  };

  const createVersion = async () => {
    setCreatingVersion(true);
    setSaveError('');
    try {
      const newVersion = await api.createSurveyVersion(survey.id);
      router.push(`/founder/surveys/${newVersion.id}/edit`);
    } catch (err: any) {
      setSaveError(err.message);
      setCreatingVersion(false);
    }
  };

  const saveIncentive = async () => {
    setIncentiveSaving(true);
    setIncentiveError('');
    try {
      const res = await api.upsertSurveyIncentive(survey.id, incentiveForm);
      setSurvey(surveyFromServer(res));
      setIncentiveSavedAt(Date.now());
    } catch (err: any) {
      setIncentiveError(err.message);
    } finally {
      setIncentiveSaving(false);
    }
  };

  const removeIncentive = async () => {
    setIncentiveSaving(true);
    setIncentiveError('');
    try {
      const res = await api.removeSurveyIncentive(survey.id);
      setSurvey(surveyFromServer(res));
      setIncentiveForm(BLANK_INCENTIVE);
      setShowIncentive(false);
    } catch (err: any) {
      setIncentiveError(err.message);
    } finally {
      setIncentiveSaving(false);
    }
  };

  const isThreePane = survey.status === 'DRAFT' && mode === 'build';
  const selectedIndex = survey.questions.findIndex((q) => q.id === selectedId);
  const selectedQ = selectedIndex >= 0 ? survey.questions[selectedIndex] : null;

  // Rendered above the content in read-only/preview, but inside the canvas
  // column in the 3-pane builder.
  const incentiveCard = (
    <div id="builder-incentive" className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6 scroll-mt-24">
      <button onClick={() => setShowIncentive((v) => !v)} className="w-full flex items-center justify-between text-left">
        <div>
          <h3 className="font-semibold text-slate-900">Respondent Incentive <span className="text-xs font-normal text-slate-400">(optional)</span></h3>
          <p className="text-xs text-slate-500 mt-0.5">{survey.incentive ? `${survey.incentive.title} — ${survey.incentive.numberOfWinners} winner${survey.incentive.numberOfWinners !== 1 ? 's' : ''}` : 'No incentive configured'}</p>
        </div>
        <span className="text-xs text-slate-400">{showIncentive ? '▲' : '▼'}</span>
      </button>
      {showIncentive && (
        <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
          <input type="text" value={incentiveForm.title} onChange={(e) => setIncentiveForm({ ...incentiveForm, title: e.target.value })}
            placeholder="Incentive title (e.g. ₹500 Amazon Gift Card)" className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
          <textarea value={incentiveForm.description} onChange={(e) => setIncentiveForm({ ...incentiveForm, description: e.target.value })}
            placeholder="Description (optional)" rows={2} className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm resize-none" />
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-sm text-slate-600">
              Number of winners
              <input type="number" min={1} value={incentiveForm.numberOfWinners}
                onChange={(e) => setIncentiveForm({ ...incentiveForm, numberOfWinners: Math.max(1, Number(e.target.value) || 1) })}
                className="w-full mt-1 border border-slate-200 rounded-md px-3 py-2 text-sm" />
            </label>
            <label className="text-sm text-slate-600">
              Survey closes (optional)
              <input type="date" value={incentiveForm.closingDate || ''} onChange={(e) => setIncentiveForm({ ...incentiveForm, closingDate: e.target.value || null })}
                className="w-full mt-1 border border-slate-200 rounded-md px-3 py-2 text-sm" />
            </label>
          </div>
          <input type="text" value={incentiveForm.eligibility} onChange={(e) => setIncentiveForm({ ...incentiveForm, eligibility: e.target.value })}
            placeholder="Eligibility (optional, e.g. must be 18+)" className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm" />
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
            <input type="checkbox" checked={incentiveForm.collectContact} onChange={(e) => setIncentiveForm({ ...incentiveForm, collectContact: e.target.checked })} className="accent-blue-600 w-4 h-4" />
            Collect contact info for winners (shown as a separate, optional step — never linked to their survey answers)
          </label>
          {incentiveError && <p className="text-xs text-red-600">{incentiveError}</p>}
          <div className="flex items-center gap-3">
            <button onClick={saveIncentive} disabled={incentiveSaving || !incentiveForm.title.trim()} className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-60">
              {incentiveSaving ? 'Saving...' : 'Save Incentive'}
            </button>
            {survey.incentive && (
              <button onClick={removeIncentive} disabled={incentiveSaving} className="text-sm text-red-600 hover:text-red-700">Remove Incentive</button>
            )}
            {incentiveSavedAt && !incentiveSaving && <span className="text-xs text-emerald-600">Saved</span>}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className={`${isThreePane ? 'max-w-[1400px]' : 'max-w-3xl'} mx-auto px-4 sm:px-6 py-8`}>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6 pb-4 border-b border-slate-200 md:sticky md:top-0 z-20 bg-[#f8fafc] viewas-sticky-offset">
        <Link
          href={survey.ideaId ? `/founder/ideas/${survey.ideaId}/dashboard` : '/founder/surveys'}
          className="text-sm text-slate-500 hover:text-slate-800"
        >
          {survey.ideaId ? <>&larr; Back to Idea</> : <>&larr; Back to My Surveys</>}
        </Link>

        {survey.status === 'DRAFT' ? (
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setMode('build')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${mode === 'build' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Build
            </button>
            <button
              onClick={() => setMode('preview')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${mode === 'preview' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Preview
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm font-medium">
            <span className={`w-2 h-2 rounded-full ${survey.status === 'LIVE' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span className={survey.status === 'LIVE' ? 'text-emerald-700' : 'text-amber-700'}>{survey.status === 'LIVE' ? 'Live' : 'Closed'}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          {survey.status === 'DRAFT' && (
            <>
              {savedAt && !saving && <span className="text-xs text-emerald-600">Saved</span>}
              <button
                onClick={publish}
                disabled={publishing}
                className="border border-blue-200 text-blue-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-50 transition disabled:opacity-60"
              >
                {publishing ? 'Publishing...' : 'Publish'}
              </button>
              <button
                onClick={saveDraft}
                disabled={saving}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save Draft'}
              </button>
            </>
          )}
          {survey.status !== 'DRAFT' && (
            <>
              <Link href={`/founder/surveys/${survey.id}/analytics`} className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                View Analytics
              </Link>
              <Link href={`/founder/surveys/${survey.id}/responses`} className="text-sm bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:border-slate-300">
                View Responses
              </Link>
              <button onClick={copyLink} className="text-sm bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:border-slate-300">
                {linkCopied ? 'Copied!' : 'Copy Link'}
              </button>
              {survey.status === 'LIVE' && (
                <button
                  onClick={closeSurvey}
                  disabled={statusActionLoading}
                  className="text-sm bg-white border border-red-200 text-red-600 px-4 py-2 rounded-lg hover:bg-red-50 disabled:opacity-60"
                >
                  Close Survey
                </button>
              )}
              {survey.status === 'CLOSED' && (
                <button
                  onClick={reopenSurvey}
                  disabled={statusActionLoading}
                  className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-60"
                >
                  Reopen Survey
                </button>
              )}
              <button
                onClick={createVersion}
                disabled={creatingVersion}
                title="Create a new draft to change questions — this survey and its responses stay exactly as they are"
                className="text-sm bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:border-slate-300 disabled:opacity-60"
              >
                {creatingVersion ? 'Creating...' : 'Edit (New Version)'}
              </button>
            </>
          )}
        </div>
      </div>

      {versions.length > 1 && (
        <div className="mb-6">
          <button onClick={() => setShowVersions((v) => !v)} className="text-sm text-slate-500 hover:text-slate-800 flex items-center gap-1.5">
            Version {survey.versionNumber} of {versions.length} <span className="text-xs">{showVersions ? '▲' : '▼'}</span>
          </button>
          {showVersions && (
            <div className="mt-3 space-y-2">
              {versions.map((v) => (
                <Link
                  key={v.id}
                  href={v.status === 'DRAFT' ? `/founder/surveys/${v.id}/edit` : `/founder/surveys/${v.id}/analytics`}
                  className={`flex items-center justify-between border rounded-lg px-4 py-2.5 text-sm ${v.id === survey.id ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                >
                  <span className="font-medium text-slate-900">Version {v.versionNumber}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${v.status === 'LIVE' ? 'bg-emerald-50 text-emerald-700' : v.status === 'CLOSED' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{v.status}</span>
                  <span className="text-xs text-slate-400">{v.responseCount} response{v.responseCount !== 1 ? 's' : ''}</span>
                  <span className="text-xs text-slate-400">{new Date(v.createdAt).toLocaleDateString()}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {saveError && <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 text-sm mb-6">{saveError}</div>}

      {survey.ideaTitle && (
        <p className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-2">{survey.ideaTitle}</p>
      )}

      {publicUrl && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 mb-6 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-slate-500 mb-0.5">Public link</p>
            <p className="text-sm text-slate-700 truncate">{publicUrl}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={copyLink} className="text-xs bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-md hover:border-slate-300">
              {linkCopied ? 'Copied!' : 'Copy'}
            </button>
            <button onClick={() => setShowQr(true)} className="text-xs bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-md hover:border-slate-300">
              QR Code
            </button>
          </div>
        </div>
      )}

      {showQr && publicUrl && (
        <SurveyQrModal url={publicUrl} title={survey.title || 'Survey'} onClose={() => setShowQr(false)} />
      )}

      {!isThreePane && incentiveCard}

      {survey.status !== 'DRAFT' ? (
        <>
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900 mb-1">{survey.title || 'Untitled survey'}</h1>
            {survey.description && <p className="text-sm text-slate-600">{survey.description}</p>}
          </div>
          <div className="space-y-4">
            {survey.questions.map((q, i) => (
              <QuestionPreview key={q.id} question={q} index={i} />
            ))}
          </div>
          <p className="text-center text-xs text-slate-400 mt-8">
            {survey.status === 'LIVE'
              ? 'This survey is live and can no longer be edited. Close it to stop accepting responses.'
              : 'This survey is closed and no longer accepting responses. Reopen it to resume collecting, or view responses above.'}
          </p>
        </>
      ) : mode === 'build' ? (
        <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_290px] lg:gap-6 lg:items-start">
          {/* Left: block navigation — jump between settings and questions. */}
          <aside className="hidden lg:block lg:sticky lg:top-24 max-h-[calc(100vh-7rem)] overflow-y-auto">
            <nav className="space-y-0.5 pr-1">
              <button type="button" onClick={() => document.getElementById('builder-settings')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="w-full text-left px-2.5 py-1.5 rounded-md text-sm text-slate-600 hover:bg-slate-100 transition">
                Survey details
              </button>
              <button type="button" onClick={() => document.getElementById('builder-incentive')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="w-full text-left px-2.5 py-1.5 rounded-md text-sm text-slate-600 hover:bg-slate-100 transition">
                Incentive
              </button>
              <p className="pt-4 pb-1 px-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                Questions ({survey.questions.length})
              </p>
              {survey.questions.map((q, i) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => selectQuestion(q.id)}
                  title={q.questionText || 'Untitled question'}
                  className={`w-full text-left px-2.5 py-1.5 rounded-md text-sm flex items-center gap-2 transition ${
                    q.id === selectedId ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className={`shrink-0 w-5 h-5 rounded text-[11px] flex items-center justify-center tabular-nums ${q.id === selectedId ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{i + 1}</span>
                  <span className="truncate">{q.questionText || 'Untitled question'}</span>
                </button>
              ))}
              <div ref={navAddRef} className="relative pt-2">
                <button type="button" onClick={() => setNavAddOpen((v) => !v)}
                  className="w-full border border-dashed border-slate-300 text-slate-600 hover:border-blue-400 hover:text-blue-600 px-2.5 py-2 rounded-lg text-sm font-medium transition">
                  + Add Question
                </button>
                {navAddOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg py-2 z-30 max-h-80 overflow-y-auto">
                    {QUESTION_TYPES.map((t) => (
                      <button key={t.value} type="button" onClick={() => addQuestion(t.value)}
                        className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700">
                        {t.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </nav>
          </aside>

          {/* Center: the form canvas. */}
          <div className="min-w-0">
          <div id="builder-settings" className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6 scroll-mt-24">
            <input
              type="text"
              value={survey.title}
              onChange={(e) => setSurvey({ ...survey, title: e.target.value })}
              placeholder="Survey title"
              className="w-full text-2xl font-bold text-slate-900 border-0 focus:outline-none mb-2 placeholder:text-slate-300"
            />
            <textarea
              value={survey.description}
              onChange={(e) => setSurvey({ ...survey, description: e.target.value })}
              placeholder="Description (optional)"
              rows={2}
              className="w-full text-sm text-slate-600 border-0 focus:outline-none resize-none placeholder:text-slate-400"
            />
            <div className="flex items-center gap-6 pt-4 mt-2 border-t border-slate-100 flex-wrap">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                Maximum responses
                <input
                  type="number"
                  min={1}
                  value={survey.responseLimit ?? ''}
                  onChange={(e) => setSurvey({ ...survey, responseLimit: e.target.value === '' ? null : Number(e.target.value) })}
                  placeholder="No limit"
                  className="w-24 border border-slate-200 rounded-md px-2 py-1 text-sm"
                />
              </label>
            </div>

            {/* Response identity — Google-Forms-style choice. Stored in the
                existing collectEmail flag; when ON, the public form requires a
                valid email before submitting and records it with the response. */}
            <div className="pt-4 mt-2 border-t border-slate-100">
              <p className="text-sm font-medium text-slate-700 mb-2">Responses</p>
              <div className="grid sm:grid-cols-2 gap-2">
                <label className={`flex items-start gap-2.5 border rounded-lg p-3 cursor-pointer select-none transition ${!survey.collectEmail ? 'border-blue-400 bg-blue-50/50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <input
                    type="radio"
                    name="responseIdentity"
                    checked={!survey.collectEmail}
                    onChange={() => setSurvey({ ...survey, collectEmail: false })}
                    className="accent-blue-600 mt-0.5"
                  />
                  <span>
                    <span className="block text-sm font-medium text-slate-800">Anonymous responses</span>
                    <span className="block text-xs text-slate-500 mt-0.5">No personal details asked — respondents stay completely anonymous.</span>
                  </span>
                </label>
                <label className={`flex items-start gap-2.5 border rounded-lg p-3 cursor-pointer select-none transition ${survey.collectEmail ? 'border-blue-400 bg-blue-50/50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <input
                    type="radio"
                    name="responseIdentity"
                    checked={survey.collectEmail}
                    onChange={() => setSurvey({ ...survey, collectEmail: true })}
                    className="accent-blue-600 mt-0.5"
                  />
                  <span>
                    <span className="block text-sm font-medium text-slate-800">Collect email addresses</span>
                    <span className="block text-xs text-slate-500 mt-0.5">Like Google Forms: respondents sign in with Google (auto-captured &amp; verified) or type their email — recorded with each response.</span>
                  </span>
                </label>
              </div>
            </div>

          </div>

          {incentiveCard}

          <div className="space-y-4">
            {survey.questions.map((q, i) => (
              <QuestionEditor
                key={q.id}
                question={q}
                index={i}
                total={survey.questions.length}
                allQuestions={survey.questions}
                onChange={(patch) => patchQuestion(q.id, patch)}
                onMoveUp={() => moveQuestion(i, -1)}
                onMoveDown={() => moveQuestion(i, 1)}
                onDuplicate={() => duplicateAt(i)}
                onDelete={() => deleteAt(i)}
                selected={q.id === selectedId}
                onSelect={() => setSelectedId(q.id)}
                hasInspector
              />
            ))}
          </div>

          {survey.questions.length === 0 && (
            <div className="text-center py-10 text-slate-400 text-sm">No questions yet. Add your first question below.</div>
          )}

          <div className="relative mt-6 flex justify-center" ref={addMenuRef}>
            <button
              onClick={() => setAddMenuOpen((v) => !v)}
              className="bg-white border border-dashed border-slate-300 text-slate-600 hover:border-blue-400 hover:text-blue-600 px-6 py-3 rounded-xl text-sm font-medium transition"
            >
              + Add Question
            </button>
            {addMenuOpen && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white border border-slate-200 rounded-xl shadow-lg py-2 w-56 z-20">
                {QUESTION_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => addQuestion(t.value)}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          </div>

          {/* Right: settings for the selected question (xl+; inline on the card below that). */}
          <aside className="hidden xl:block xl:sticky xl:top-24">
            {selectedQ ? (
              <QuestionInspector
                question={selectedQ}
                index={selectedIndex}
                total={survey.questions.length}
                allQuestions={survey.questions}
                onChange={(patch) => patchQuestion(selectedQ.id, patch)}
                onMoveUp={() => moveQuestion(selectedIndex, -1)}
                onMoveDown={() => moveQuestion(selectedIndex, 1)}
                onDuplicate={() => duplicateAt(selectedIndex)}
                onDelete={() => deleteAt(selectedIndex)}
              />
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 text-sm text-slate-400">
                Select a question on the canvas to edit its settings here.
              </div>
            )}
          </aside>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900 mb-1">{survey.title || 'Untitled survey'}</h1>
            {survey.description && <p className="text-sm text-slate-600">{survey.description}</p>}
          </div>
          <div className="space-y-4">
            {survey.questions.map((q, i) => (
              <QuestionPreview key={q.id} question={q} index={i} />
            ))}
          </div>
          {survey.questions.length === 0 && (
            <div className="text-center py-10 text-slate-400 text-sm">Nothing to preview yet — add questions in Build mode.</div>
          )}
          <p className="text-center text-xs text-slate-400 mt-8">This is a preview. No responses are collected here.</p>
        </>
      )}
    </div>
  );
}

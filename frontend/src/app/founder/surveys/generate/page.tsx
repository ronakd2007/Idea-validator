'use client';
import { Suspense, useRef, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { fromAiGenerated } from '@/lib/surveyTypes';

// useSearchParams() requires a Suspense boundary for static prerendering —
// dev mode never enforces this, only a real `next build` does.
export default function AiBuilderPage() {
  return (
    <Suspense fallback={null}>
      <AiBuilderInner />
    </Suspense>
  );
}

function AiBuilderInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Gap-to-Survey mode: arrived from the Weakness Detector's "Generate this
  // survey with AI" button — build the targeted survey immediately, no typing.
  const gapIdeaId = searchParams.get('ideaId');
  const gapKey = searchParams.get('gap');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [gapMode, setGapMode] = useState(!!(gapIdeaId && gapKey));
  const [gapLabel, setGapLabel] = useState('');

  useEffect(() => {
    const user = getStoredUser();
    if (!user || user.role !== 'FOUNDER') router.push('/auth/login');
  }, [router]);

  // Shared landing path: any AI draft becomes a real editable survey the
  // founder reviews in the normal editor before publishing.
  const buildAndOpen = async (ai: any, linkIdeaId?: string | null) => {
    const draft = fromAiGenerated(ai);
    const survey = await api.createSurvey({ ideaId: linkIdeaId || undefined, title: draft.title, description: draft.description });
    await api.updateSurvey(survey.id, {
      title: draft.title,
      description: draft.description,
      responseLimit: null,
      collectEmail: false,
      questions: draft.questions.map((q) => ({
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
    router.push(`/founder/surveys/${survey.id}/edit`);
  };

  // Auto-run the gap survey once on arrival.
  useEffect(() => {
    if (!gapIdeaId || !gapKey) return;
    let cancelled = false;
    (async () => {
      setGenerating(true);
      try {
        const ai = await api.generateGapSurvey(gapIdeaId, gapKey);
        if (cancelled) return;
        setGapLabel(ai.gapLabel || '');
        await buildAndOpen(ai, gapIdeaId);
      } catch (err: any) {
        if (cancelled) return;
        setError(err.message || 'Could not generate the gap survey — you can build one manually below.');
        setGapMode(false); // fall back to the manual builder
        setGenerating(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gapIdeaId, gapKey]);

  const handleFile = async (file: File) => {
    if (!/\.(txt|csv)$/i.test(file.name)) {
      setError('Please upload a .txt or .csv file.');
      return;
    }
    setError('');
    const content = await file.text();
    // CSV: treat each row's first column as the question, same as one-per-line text.
    const questions = file.name.toLowerCase().endsWith('.csv')
      ? content.split('\n').map((row) => row.split(',')[0])
      : content.split('\n');
    setText(questions.join('\n'));
    setFileName(file.name);
  };

  const generate = async () => {
    if (!text.trim()) return;
    setGenerating(true);
    setError('');
    try {
      const ai = await api.generateSurveyDraft(text);
      await buildAndOpen(ai);
    } catch (err: any) {
      setError(err.message || 'Something went wrong generating your survey.');
      setGenerating(false);
    }
  };

  // Full-screen progress state while the gap survey builds itself.
  if (gapMode) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 w-full max-w-md text-center">
          <div className="animate-spin w-10 h-10 border-[3px] border-blue-200 border-t-blue-600 rounded-full mx-auto mb-5" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Building your survey…</h2>
          <p className="text-sm text-slate-500">
            AI is writing targeted questions to close your{gapLabel ? ` “${gapLabel}”` : ''} validation gap.
            You&apos;ll land in the editor to review before publishing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <Link href="/founder/surveys" className="text-sm text-slate-500 hover:text-slate-800">&larr; Back to My Surveys</Link>

      <div className="mt-4 mb-8">
        <h1 className="text-2xl font-bold text-slate-900">AI Builder</h1>
        <p className="text-slate-500 mt-1">Paste your questions below — one per line. AI picks the right field for each, then you&apos;ll land in the survey editor to review and publish.</p>
      </div>

      {error && <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg px-4 py-3 mb-4 text-sm">{error}</div>}

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setFileName(''); }}
          disabled={generating}
          placeholder={'What is your age?\nWhich platform do you use most?\nTell us why you prefer that platform.\nHow satisfied are you with the product?\nWould you use this product again?'}
          rows={10}
          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900 font-mono disabled:opacity-60"
        />

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-xs text-slate-400">OR</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        <input ref={fileInputRef} type="file" accept=".txt,.csv" className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={generating}
          className="w-full border border-dashed border-slate-300 rounded-lg py-3 text-sm text-slate-600 hover:border-slate-400 hover:bg-slate-50 disabled:opacity-60">
          {fileName ? `✓ ${fileName} — click to replace` : 'Upload .txt or .csv'}
        </button>

        <button onClick={generate} disabled={!text.trim() || generating}
          className="w-full mt-6 bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50">
          {generating ? 'Reading your questions...' : 'Generate Form'}
        </button>
      </div>
    </div>
  );
}

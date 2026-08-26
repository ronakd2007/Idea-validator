'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getStoredUser, isViewMode } from '@/lib/auth';
import AIChatPanel from '@/components/chat/AIChatPanel';
import ShareSurveyReportModal from '@/components/survey/ShareSurveyReportModal';
import {
  SummaryCards,
  InsightsCard,
  TrendCard,
  ActivityTimeCards,
  QualityCard,
  SegmentImpactCard,
  DropOffCard,
  ABResultsCard,
  QuestionBreakdown,
} from '@/components/survey/reportSections';

export default function SurveyAnalyticsPage() {
  const router = useRouter();
  const params = useParams();
  const surveyId = params.surveyId as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [range, setRange] = useState('30d');
  const [outcomeQuestionId, setOutcomeQuestionId] = useState('');
  const [segmentQuestionId, setSegmentQuestionId] = useState('');
  const [exporting, setExporting] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState(false);
  const [share, setShare] = useState<{ shareId: string | null; shareEnabled: boolean; shareSettings: any } | null>(null);
  const [showShare, setShowShare] = useState(false);

  useEffect(() => {
    const user = getStoredUser();
    if (!user || user.role !== 'FOUNDER') { router.push('/auth/login'); return; }
    setViewMode(isViewMode());
  }, [router]);

  useEffect(() => {
    api.getSurveyShare(surveyId).then(setShare).catch(() => {});
  }, [surveyId]);

  // Open-text answers for the question breakdown, from the owner's endpoint.
  const loadText = useCallback(
    (questionId: string, search: string) =>
      api.getSurveyResponses(surveyId, { questionId, search: search || undefined, pageSize: 20 }).then((res: any) =>
        (res.responses || [])
          .map((r: any) => {
            const a = r.answers.find((x: any) => x.questionId === questionId);
            let text = '';
            try { text = a ? JSON.parse(a.value) : ''; } catch { text = a?.value || ''; }
            return { id: r.id, text };
          })
          .filter((r: any) => r.text)
      ),
    [surveyId]
  );

  useEffect(() => {
    setLoading(true);
    api.getSurveyAnalytics(surveyId, { range, outcomeQuestionId: outcomeQuestionId || undefined, segmentQuestionId: segmentQuestionId || undefined })
      // Clear any stale error on success — otherwise one transient failure
      // (e.g. a filter change against a cold backend) permanently replaced
      // the whole page with the error panel even though data was loaded.
      .then((d) => { setData(d); setError(''); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    api.getSurveyVersions(surveyId).then(setVersions).catch(() => {});
  }, [surveyId, range, outcomeQuestionId, segmentQuestionId]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const text = await api.exportSurveyResponses(surveyId);
      const blob = new Blob([text], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(data?.survey?.title || 'survey').replace(/[^a-z0-9]/gi, '_')}_responses.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // non-critical — the button simply stays enabled for a retry
    } finally {
      setExporting(false);
    }
  };

  if (loading && !data) return <div className="flex items-center justify-center min-h-screen"><div className="text-slate-500">Loading analytics...</div></div>;
  // Full-page error only when nothing has loaded; a failed refetch keeps the
  // last good data on screen with a banner instead of blanking the page.
  if (!data) return <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10"><div className="bg-red-50 text-red-700 border border-red-200 rounded-lg p-4">{error || 'Not found'}</div></div>;

  const { survey, summary, trend, activity, time, questions, dropOff, quality, eligibleOutcomeQuestions, eligibleSegmentQuestions, segmentation, impact, abResults, insights, sampleSizeLabel } = data;

  return (
    <div className="flex">
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex-1 min-w-0">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
        <Link href={`/founder/surveys/${surveyId}/edit`} className="text-sm text-slate-500 hover:text-slate-800">&larr; Back to Survey</Link>
        <div className="flex items-center gap-2 flex-wrap">
          {!viewMode && (
            <button onClick={() => setShowShare(true)} className="text-sm bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:border-slate-300">
              {share?.shareEnabled ? '🔗 Results Shared' : 'Share Results'}
            </button>
          )}
          <Link
            href={`/founder/surveys/${surveyId}/responses`}
            className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            View Responses{summary.totalResponses ? ` (${summary.totalResponses})` : ''}
          </Link>
          <button onClick={exportCsv} disabled={exporting} className="text-sm bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:border-slate-300 disabled:opacity-60">
            {exporting ? 'Exporting...' : 'Export Responses'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-amber-50 text-amber-800 border border-amber-200 rounded-lg px-4 py-2.5 text-sm mb-4">
          Couldn&apos;t refresh: {error} — showing the last loaded data.
        </div>
      )}

      <div className="mb-8">
        <p className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-1">{survey.ideaTitle || 'Standalone survey'}</p>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-slate-900">{survey.title}</h1>
          <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full font-medium ${survey.status === 'LIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${survey.status === 'LIVE' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {survey.status}
          </span>
        </div>
      </div>

      {versions.length > 1 && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 mb-6">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Versions</p>
          <div className="flex flex-wrap gap-3">
            {versions.map((v: any) => (
              <Link
                key={v.id}
                href={v.id === surveyId ? '#' : v.status === 'DRAFT' ? `/founder/surveys/${v.id}/edit` : `/founder/surveys/${v.id}/analytics`}
                className={`border rounded-lg px-4 py-2.5 text-sm ${v.id === surveyId ? 'border-blue-300 bg-blue-50 pointer-events-none' : 'border-slate-200 hover:border-slate-300'}`}
              >
                <span className="font-medium text-slate-900">Version {v.versionNumber}</span>
                <span className="text-slate-400 mx-1.5">&middot;</span>
                <span className="text-slate-600">{v._count?.responses ?? 0} responses</span>
              </Link>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Observed differences between versions — not a claim about what caused them.</p>
        </div>
      )}

      <SummaryCards summary={summary} sampleSizeLabel={sampleSizeLabel} />

      <InsightsCard insights={insights} />

      <TrendCard trend={trend} range={range} onRangeChange={setRange} />

      <ActivityTimeCards activity={activity} time={time} />

      <QualityCard quality={quality} linkBase={`/founder/surveys/${surveyId}/responses`} />

      <SegmentImpactCard
        eligibleSegmentQuestions={eligibleSegmentQuestions}
        eligibleOutcomeQuestions={eligibleOutcomeQuestions}
        segmentQuestionId={segmentQuestionId}
        outcomeQuestionId={outcomeQuestionId}
        onSegmentChange={setSegmentQuestionId}
        onOutcomeChange={setOutcomeQuestionId}
        segmentation={segmentation}
        impact={impact}
      />

      <ABResultsCard abResults={abResults} />

      <DropOffCard dropOff={dropOff} />

      <QuestionBreakdown questions={questions} loadText={loadText} />

      {showShare && (
        <ShareSurveyReportModal
          surveyId={surveyId}
          surveyTitle={survey.title}
          initialShare={share}
          onClose={() => setShowShare(false)}
          onChanged={setShare}
        />
      )}
    </div>
    <AIChatPanel targetType="survey" targetId={surveyId} readOnly={viewMode} />
    </div>
  );
}

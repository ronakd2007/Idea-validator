'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { formatAnswer, formatDuration } from '@/lib/surveyAnswers';
import {
  SummaryCards,
  InsightsCard,
  TrendCard,
  ActivityTimeCards,
  QualityCard,
  DropOffCard,
  ABResultsCard,
  QuestionBreakdown,
} from '@/components/survey/reportSections';

const QUALITY_BADGE: Record<string, string> = {
  HIGH: 'bg-emerald-50 text-emerald-700',
  MEDIUM: 'bg-amber-50 text-amber-700',
  POTENTIALLY_LOW: 'bg-red-50 text-red-700',
};

const QUALITY_LABEL: Record<string, string> = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  POTENTIALLY_LOW: 'LOW',
};

const PAGE_SIZE = 20;

/**
 * Public, unauthenticated results page for a shared survey. Everything it can
 * display is decided server-side: the payload arrives with hidden sections
 * already removed and respondent identities stripped, so this page never has
 * to be trusted to hide anything.
 */
export default function PublicSurveyReportPage() {
  const params = useParams();
  const shareId = params.shareId as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [range, setRange] = useState('30d');
  const [tab, setTab] = useState<'analytics' | 'responses'>('analytics');

  // Responses tab
  const [questions, setQuestions] = useState<any[]>([]);
  const [responses, setResponses] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [responsesLoading, setResponsesLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.getPublicSurveyReport(shareId, { range })
      .then((d) => { setData(d); setNotFound(false); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [shareId, range]);

  const canBrowseResponses = !!data?.settings?.showResponses;

  useEffect(() => {
    if (tab !== 'responses' || !canBrowseResponses) return;
    setResponsesLoading(true);
    Promise.all([
      questions.length ? Promise.resolve(questions) : api.getPublicSurveyReportQuestions(shareId),
      api.getPublicSurveyReportResponses(shareId, { page, pageSize: PAGE_SIZE }),
    ])
      .then(([qs, res]: any[]) => {
        setQuestions(qs);
        setResponses(res.responses);
        setTotal(res.total);
        setSelectedId((prev) => (res.responses.some((r: any) => r.id === prev) ? prev : res.responses[0]?.id ?? null));
      })
      .catch(() => { setResponses([]); setTotal(0); })
      .finally(() => setResponsesLoading(false));
    // `questions` intentionally omitted — it is a one-time cache, not an input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, canBrowseResponses, shareId, page]);

  // Open-text answers inside the question breakdown, via the public endpoint.
  const loadText = useCallback(
    (questionId: string, search: string) =>
      api.getPublicSurveyReportResponses(shareId, { questionId, search: search || undefined, pageSize: 20 }).then((res: any) =>
        (res.responses || [])
          .map((r: any) => {
            const a = r.answers.find((x: any) => x.questionId === questionId);
            let text = '';
            try { text = a ? JSON.parse(a.value) : ''; } catch { text = a?.value || ''; }
            return { id: r.id, text };
          })
          .filter((r: any) => r.text)
      ),
    [shareId]
  );

  if (loading && !data) {
    return <div className="flex items-center justify-center min-h-screen"><div className="text-slate-500">Loading results…</div></div>;
  }
  if (notFound || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <p className="text-4xl mb-3">🔒</p>
          <h1 className="text-xl font-bold text-slate-900 mb-2">These results aren&apos;t available</h1>
          <p className="text-sm text-slate-500">
            The link may have been turned off by its owner, or it may be incorrect.
          </p>
        </div>
      </div>
    );
  }

  const { survey, settings } = data;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const selected = responses.find((r) => r.id === selectedId);

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <p className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-1">
            {survey.ideaTitle || 'Survey results'}
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900">{survey.title}</h1>
            <span className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full font-medium bg-slate-100 text-slate-600">
              Live results
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {data.totalResponses} response{data.totalResponses !== 1 ? 's' : ''} · {data.sampleSizeLabel} · updates automatically as new responses arrive
          </p>
        </div>

        {canBrowseResponses && (
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 mb-6 w-fit">
            {(['analytics', 'responses'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize ${tab === t ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {tab === 'analytics' && (
          <>
            {settings.showSummary && data.summary && (
              <SummaryCards summary={data.summary} sampleSizeLabel={data.sampleSizeLabel} />
            )}
            {settings.showCharts && <InsightsCard insights={data.insights || []} />}
            {settings.showCharts && data.trend && (
              <TrendCard trend={data.trend} range={range} onRangeChange={setRange} />
            )}
            {settings.showSummary && data.activity && data.time && (
              <ActivityTimeCards activity={data.activity} time={data.time} />
            )}
            {settings.showQuality && data.quality && <QualityCard quality={data.quality} />}
            {settings.showCharts && <ABResultsCard abResults={data.abResults || []} />}
            {settings.showCharts && data.dropOff && <DropOffCard dropOff={data.dropOff} />}
            {settings.showCharts && data.questions && (
              <QuestionBreakdown questions={data.questions} loadText={canBrowseResponses ? loadText : undefined} />
            )}
            {!settings.showSummary && !settings.showCharts && !settings.showQuality && (
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 text-center text-sm text-slate-500">
                The owner has limited this page to individual responses only.
              </div>
            )}
          </>
        )}

        {tab === 'responses' && canBrowseResponses && (
          <>
            {responsesLoading && responses.length === 0 && <p className="text-sm text-slate-400">Loading responses…</p>}
            {!responsesLoading && total === 0 && (
              <div className="text-center py-20 text-slate-400 text-sm">No responses yet.</div>
            )}
            {total > 0 && (
              <div className="grid md:grid-cols-[280px_1fr] gap-6">
                <div>
                  <div className="space-y-2 mb-4">
                    {responses.map((r, i) => {
                      const globalIndex = total - ((page - 1) * PAGE_SIZE + i);
                      return (
                        <button
                          key={r.id}
                          onClick={() => setSelectedId(r.id)}
                          className={`w-full text-left border rounded-lg px-3 py-2.5 text-sm transition ${selectedId === r.id ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-slate-900">#{globalIndex}</span>
                            {r.quality?.label && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${QUALITY_BADGE[r.quality.label] || 'bg-slate-100 text-slate-500'}`}>
                                {QUALITY_LABEL[r.quality.label] || ''}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">{new Date(r.submittedAt).toLocaleDateString()}</p>
                        </button>
                      );
                    })}
                  </div>
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between text-sm">
                      <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1.5 rounded-md border border-slate-200 text-slate-600 disabled:opacity-30">Prev</button>
                      <span className="text-xs text-slate-400">Page {page} / {totalPages}</span>
                      <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1.5 rounded-md border border-slate-200 text-slate-600 disabled:opacity-30">Next</button>
                    </div>
                  )}
                </div>

                <div>
                  {selected && (
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
                      <div className="flex items-center justify-between flex-wrap gap-3 mb-4 pb-4 border-b border-slate-100">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Response</p>
                          <p className="text-xs text-slate-500 mt-0.5">Submitted {new Date(selected.submittedAt).toLocaleString()}</p>
                        </div>
                        {selected.quality?.label && (
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${QUALITY_BADGE[selected.quality.label] || 'bg-slate-100 text-slate-500'}`}>
                            {selected.quality.label === 'POTENTIALLY_LOW' ? 'POTENTIALLY LOW QUALITY' : `${selected.quality.label} QUALITY`}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-4 mb-5 text-center">
                        <div><p className="text-xs text-slate-500">Started</p><p className="text-sm font-medium text-slate-900">{selected.startedAt ? new Date(selected.startedAt).toLocaleTimeString() : '—'}</p></div>
                        <div><p className="text-xs text-slate-500">Submitted</p><p className="text-sm font-medium text-slate-900">{new Date(selected.submittedAt).toLocaleTimeString()}</p></div>
                        <div><p className="text-xs text-slate-500">Duration</p><p className="text-sm font-medium text-slate-900">{formatDuration(selected.duration)}</p></div>
                      </div>

                      <div className="space-y-5">
                        {questions.map((q: any, i: number) => {
                          const answer = selected.answers.find((a: any) => a.questionId === q.id);
                          return (
                            <div key={q.id}>
                              <p className="text-xs font-semibold text-slate-400 mb-1">Q{i + 1}</p>
                              <p className="text-sm font-medium text-slate-900 mb-1.5">{q.questionText}</p>
                              <p className="text-sm text-slate-600">
                                {answer ? formatAnswer(q, answer.value) : <span className="text-slate-300">Not answered</span>}
                              </p>
                            </div>
                          );
                        })}
                      </div>

                      {selected.quality?.flags?.length > 0 && (
                        <div className="pt-4 mt-5 border-t border-slate-100">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Potential consistency issues</p>
                          <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
                            {selected.quality.flags.map((f: string, i: number) => <li key={i}>{f}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        <p className="text-center text-xs text-slate-400 mt-10">
          Shared with IdeaValidator · Respondent identities are not shown on this page
        </p>
      </div>
    </div>
  );
}

'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAdminGuard } from '@/lib/adminGuard';
import { formatAnswer, formatDuration, QUALITY_STYLE, QUALITY_LABEL } from '@/lib/surveyAnswers';
import { CATEGORY_STYLE, SURVEY_STATUS_STYLE, formatDate, formatDateTime, timeAgo } from '@/lib/adminActivity';
import RichDescription from '@/components/survey/RichDescription';

const TABS = ['Questions', 'Responses', 'Analytics', 'Activity'];
const PAGE_SIZE = 20;

const QUALITY_TABS = [
  { value: 'ALL', label: 'All' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'POTENTIALLY_LOW', label: 'Potentially low' },
];

export default function AdminSurveyDetailPage() {
  const allowed = useAdminGuard();
  const params = useParams();
  const surveyId = String(params?.id || '');

  const [survey, setSurvey] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('Questions');

  // Responses are fetched separately and paginated — never all at once.
  const [responses, setResponses] = useState<any>(null);
  const [responsesLoading, setResponsesLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [quality, setQuality] = useState('ALL');
  const [search, setSearch] = useState('');

  const [analytics, setAnalytics] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [activity, setActivity] = useState<any[]>([]);

  useEffect(() => {
    if (!allowed || !surveyId) return;
    setLoading(true);
    Promise.all([api.getAdminSurveyDetail(surveyId), api.getAdminSurveyActivity(surveyId)])
      .then(([s, acts]) => { setSurvey(s); setActivity(acts); })
      .catch((err: any) => setError(err.message || 'Could not load this survey'))
      .finally(() => setLoading(false));
  }, [allowed, surveyId]);

  const loadResponses = useCallback(async () => {
    setResponsesLoading(true);
    try {
      const res = await api.getAdminSurveyResponses(surveyId, { page, pageSize: PAGE_SIZE, quality, search });
      setResponses(res);
    } catch (err: any) {
      setError(err.message || 'Could not load responses');
    } finally {
      setResponsesLoading(false);
    }
  }, [surveyId, page, quality, search]);

  useEffect(() => {
    if (!allowed || tab !== 'Responses') return;
    loadResponses();
  }, [allowed, tab, loadResponses]);

  useEffect(() => {
    if (!allowed || tab !== 'Analytics' || analytics) return;
    setAnalyticsLoading(true);
    api.getAdminSurveyAnalytics(surveyId)
      .then(setAnalytics)
      .catch(() => {})
      .finally(() => setAnalyticsLoading(false));
  }, [allowed, tab, surveyId, analytics]);

  if (!allowed) return null;
  if (loading) return <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 text-center text-slate-500">Loading...</div>;
  if (error && !survey) return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 text-center">
      <p className="text-red-600 mb-4">{error}</p>
      <Link href="/admin/surveys" className="text-blue-600 hover:text-blue-700">← Back to surveys</Link>
    </div>
  );
  if (!survey) return null;

  const totalPages = responses ? Math.max(1, Math.ceil(responses.total / responses.pageSize)) : 1;
  const questionById = new Map(survey.questions.map((q: any) => [q.id, q]));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-4">
          <Link href="/admin/surveys" className="text-slate-500 hover:text-slate-700">← Back</Link>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold text-slate-900">{survey.title}</h1>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${SURVEY_STATUS_STYLE[survey.status] || 'bg-slate-100 text-slate-700'}`}>
                {survey.status}
              </span>
              {survey.versionNumber > 1 && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">v{survey.versionNumber}</span>}
            </div>
            <p className="text-slate-500 mt-1">
              By <Link href={`/admin/users/${survey.founder.id}`} className="text-blue-600 hover:text-blue-700">{survey.founder.name}</Link>
              {survey.idea && <> · <Link href={`/admin/ideas/${survey.idea.id}`} className="text-blue-600 hover:text-blue-700">{survey.idea.title}</Link></>}
              {' · '}{formatDate(survey.createdAt)}
            </p>
          </div>
        </div>
        {survey.publicId && (
          <a href={`/survey/${survey.publicId}`} target="_blank" rel="noopener noreferrer"
            className="bg-slate-50 text-slate-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-100">
            Open public survey
          </a>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Stat label="Questions" value={survey._count.questions} />
        <Stat label="Responses" value={survey._count.responses} />
        <Stat label="Sessions started" value={survey._count.sessions} />
        <Stat label="Last response" value={survey.responseWindow.last ? timeAgo(survey.responseWindow.last) : '—'} />
      </div>

      <div className="flex gap-2 mb-6 border-b border-slate-200 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition ${
              tab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Questions' && (
        <div className="space-y-3">
          {survey.description && (
            <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-5 text-slate-700"><RichDescription text={survey.description} /></div>
          )}
          {survey.questions.map((q: any, i: number) => (
            <div key={q.id} className="bg-white border border-slate-200 shadow-sm rounded-xl p-5">
              <div className="flex items-start gap-3">
                <span className="text-slate-400 font-mono text-sm shrink-0">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-slate-900">{q.questionText}</h3>
                    {q.required && <span className="text-xs text-red-600">Required</span>}
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{q.type.replace(/_/g, ' ')}</span>
                  </div>
                  {q.description && <p className="text-sm text-slate-500 mt-1">{q.description}</p>}
                  {q.options.length > 0 && (
                    <ul className="mt-2 space-y-1 text-sm text-slate-600">
                      {q.options.map((o: any) => <li key={o.id}>• {o.label}</li>)}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          ))}
          {survey.questions.length === 0 && <Empty>This survey has no questions yet.</Empty>}
        </div>
      )}

      {tab === 'Responses' && (
        <>
          <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 mb-4">
            <div className="flex gap-3 flex-wrap items-center">
              <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search answer text..."
                className="flex-1 min-w-[200px] border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              <div className="flex gap-2 flex-wrap">
                {QUALITY_TABS.map((q) => (
                  <button key={q.value} onClick={() => { setQuality(q.value); setPage(1); }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                      quality === q.value ? 'bg-blue-600 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:border-blue-400'
                    }`}>
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {responsesLoading && <div className="text-center py-16 text-slate-500">Loading responses...</div>}

          {!responsesLoading && responses && (
            <>
              <p className="text-sm text-slate-500 mb-3">
                {responses.total} {responses.total === 1 ? 'response' : 'responses'}
                {responses.total > PAGE_SIZE && ` · showing ${(responses.page - 1) * responses.pageSize + 1}–${Math.min(responses.page * responses.pageSize, responses.total)}`}
              </p>

              <div className="space-y-4">
                {responses.responses.map((r: any, idx: number) => (
                  <div key={r.id} className="bg-white border border-slate-200 shadow-sm rounded-xl p-5">
                    <div className="flex items-start justify-between gap-4 flex-wrap mb-3 pb-3 border-b border-slate-100">
                      <div>
                        <h3 className="font-semibold text-slate-900">
                          Response #{(responses.page - 1) * responses.pageSize + idx + 1}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Submitted {formatDateTime(r.submittedAt)} · took {formatDuration(r.duration)}
                          {/* Only present when the founder turned on "collect email"; self-reported, never verified. */}
                          {r.respondentEmail && ` · ${r.respondentEmail}`}
                        </p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${QUALITY_STYLE[r.quality?.label] || 'bg-slate-100 text-slate-700'}`}>
                        {QUALITY_LABEL[r.quality?.label] || r.quality?.label}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {survey.questions.map((q: any) => {
                        const answer = r.answers.find((a: any) => a.questionId === q.id);
                        return (
                          <div key={q.id}>
                            <div className="text-sm text-slate-500">{q.questionText}</div>
                            <div className="text-sm text-slate-900 mt-0.5">
                              {answer ? formatAnswer(q, answer.value) : <span className="text-slate-300">Not answered</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {r.quality?.flags?.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Quality signals</div>
                        <ul className="text-xs text-slate-600 space-y-0.5">
                          {r.quality.flags.map((f: string, i: number) => <li key={i}>• {f}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {responses.responses.length === 0 && <Empty>No responses match these filters.</Empty>}

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <span className="text-sm text-slate-500">Page {responses.page} of {totalPages}</span>
                  <div className="flex gap-2">
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={responses.page <= 1}
                      className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-600 hover:border-blue-400 disabled:opacity-40">
                      Previous
                    </button>
                    <button onClick={() => setPage((p) => p + 1)} disabled={responses.page >= totalPages}
                      className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 text-slate-600 hover:border-blue-400 disabled:opacity-40">
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          <p className="mt-6 text-xs text-slate-500 bg-violet-50 border border-violet-100 rounded-lg p-3">
            Responses are anonymous. No account, session token or identity is attached to any answer,
            and giveaway entries are stored separately so they can never be matched to a response.
          </p>
        </>
      )}

      {tab === 'Analytics' && (
        <>
          {analyticsLoading && <div className="text-center py-16 text-slate-500">Loading analytics...</div>}
          {!analyticsLoading && analytics && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Responses" value={analytics.summary?.totalResponses ?? 0} />
                <Stat label="Completion rate" value={analytics.summary?.completionRate != null ? `${Math.round(analytics.summary.completionRate)}%` : '—'} />
                <Stat label="Median time" value={analytics.time?.median || '—'} />
                <Stat label="Sample" value={analytics.quality?.sampleSizeLabel || '—'} />
              </div>

              {analytics.quality && (
                <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6">
                  <h2 className="font-semibold text-slate-900 mb-4">Response quality</h2>
                  <div className="grid grid-cols-3 gap-3">
                    {['HIGH', 'MEDIUM', 'POTENTIALLY_LOW'].map((k) => (
                      <div key={k} className={`rounded-lg p-4 ${QUALITY_STYLE[k]}`}>
                        <div className="text-2xl font-black">{analytics.quality.buckets?.[k] ?? 0}</div>
                        <div className="text-xs mt-1">{QUALITY_LABEL[k]}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analytics.insights?.length > 0 && (
                <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6">
                  <h2 className="font-semibold text-slate-900 mb-3">Insights</h2>
                  <ul className="space-y-2 text-sm">
                    {analytics.insights.map((ins: any, i: number) => (
                      <li key={i} className="border-l-2 border-slate-200 pl-3">
                        <span className="font-medium text-slate-900">{ins.title}</span>
                        <span className="text-slate-600"> — {ins.body}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          {!analyticsLoading && !analytics && <Empty>Analytics are not available for this survey.</Empty>}
        </>
      )}

      {tab === 'Activity' && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-slate-500">User</th>
                <th className="text-left px-6 py-3 font-medium text-slate-500">Activity</th>
                <th className="text-left px-6 py-3 font-medium text-slate-500">When</th>
              </tr>
            </thead>
            <tbody>
              {activity.map((a) => (
                <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-6 py-4">
                    {a.userId
                      ? <Link href={`/admin/users/${a.userId}`} className="text-blue-600 hover:text-blue-700">{a.actorLabel}</Link>
                      : <span className="text-slate-500">{a.actorLabel}</span>}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-slate-900">{a.actionLabel}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_STYLE[a.category] || 'bg-slate-100 text-slate-700'}`}>
                        {a.category}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-500 whitespace-nowrap" title={formatDateTime(a.createdAt)}>
                    {timeAgo(a.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {activity.length === 0 && <Empty>No recorded activity for this survey yet.</Empty>}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4">
      <div className="text-2xl font-black text-slate-900">{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-center py-14 text-slate-500">{children}</div>;
}

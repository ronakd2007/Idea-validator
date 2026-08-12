'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { surveyFromServer, SurveyDraft, QuestionDraft } from '@/lib/surveyTypes';

function formatAnswer(question: QuestionDraft, rawValue: string) {
  let value: any;
  try {
    value = JSON.parse(rawValue);
  } catch {
    return rawValue;
  }

  if (question.type === 'MULTIPLE_CHOICE' || question.type === 'DROPDOWN') {
    return question.options.find((o) => o.id === value)?.label || String(value);
  }
  if (question.type === 'CHECKBOXES') {
    const ids = Array.isArray(value) ? value : [];
    const labels = ids.map((id: string) => question.options.find((o) => o.id === id)?.label || id);
    return labels.length ? labels.join(', ') : '—';
  }
  if (typeof value === 'number') return String(value);
  return value || '—';
}

function formatDuration(seconds: number | null) {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const QUALITY_TABS = [
  { value: 'ALL', label: 'All' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'POTENTIALLY_LOW', label: 'Potentially Low' },
];

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

export default function SurveyResponsesPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const surveyId = params.surveyId as string;
  const pageSize = 20;

  const [survey, setSurvey] = useState<SurveyDraft | null>(null);
  const [responses, setResponses] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [qualityFilter, setQualityFilter] = useState(searchParams.get('quality') || 'ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const user = getStoredUser();
    if (!user || user.role !== 'FOUNDER') { router.push('/auth/login'); return; }
    api.getSurvey(surveyId).then((s) => setSurvey(surveyFromServer(s))).catch((err) => setError(err.message));
  }, [surveyId, router]);

  useEffect(() => {
    setLoading(true);
    api.getSurveyResponses(surveyId, { page, pageSize, quality: qualityFilter !== 'ALL' ? qualityFilter : undefined })
      .then((res) => {
        setResponses(res.responses);
        setTotal(res.total);
        setSelectedId((prev: string | null) => (res.responses.some((r: any) => r.id === prev) ? prev : res.responses[0]?.id ?? null));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [surveyId, page, qualityFilter]);

  if (loading && !survey) return <div className="flex items-center justify-center min-h-screen"><div className="text-slate-500">Loading responses...</div></div>;
  if (error || !survey) return <div className="max-w-2xl mx-auto px-6 py-10"><div className="bg-red-50 text-red-700 border border-red-200 rounded-lg p-4">{error || 'Survey not found'}</div></div>;

  const selected = responses.find((r) => r.id === selectedId);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-8 pb-4 border-b border-slate-200">
        <Link href={`/founder/surveys/${surveyId}/edit`} className="text-sm text-slate-500 hover:text-slate-800">&larr; Back to Survey</Link>
        <Link href={`/founder/surveys/${surveyId}/analytics`} className="text-sm text-blue-600 hover:text-blue-700 font-medium">View Analytics &rarr;</Link>
      </div>

      <div className="mb-6 flex items-end justify-between flex-wrap gap-4">
        <div>
          <p className="text-sm text-slate-500">Responses</p>
          <p className="text-3xl font-bold text-slate-900">{total}</p>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          {QUALITY_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => { setQualityFilter(t.value); setPage(1); }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium ${qualityFilter === t.value ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {total === 0 && (
        <div className="text-center py-20 text-slate-400 text-sm">
          {qualityFilter !== 'ALL' ? 'No responses match this filter.' : 'No responses yet. Share the public link to start collecting.'}
        </div>
      )}

      {total > 0 && (
        <div className="grid md:grid-cols-[280px_1fr] gap-6">
          <div>
            <div className="space-y-2 mb-4">
              {responses.map((r, i) => {
                const globalIndex = total - ((page - 1) * pageSize + i);
                return (
                  <button
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className={`w-full text-left border rounded-lg px-3 py-2.5 text-sm transition ${selectedId === r.id ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-900">#{globalIndex}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${QUALITY_BADGE[r.quality?.label] || 'bg-slate-100 text-slate-500'}`}>
                        {QUALITY_LABEL[r.quality?.label] || ''}
                      </span>
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
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${QUALITY_BADGE[selected.quality?.label] || 'bg-slate-100 text-slate-500'}`}>
                    {selected.quality?.label === 'POTENTIALLY_LOW' ? 'POTENTIALLY LOW QUALITY' : `${selected.quality?.label} QUALITY`}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-5 text-center">
                  <div><p className="text-xs text-slate-500">Started</p><p className="text-sm font-medium text-slate-900">{selected.startedAt ? new Date(selected.startedAt).toLocaleTimeString() : '—'}</p></div>
                  <div><p className="text-xs text-slate-500">Submitted</p><p className="text-sm font-medium text-slate-900">{new Date(selected.submittedAt).toLocaleTimeString()}</p></div>
                  <div><p className="text-xs text-slate-500">Duration</p><p className="text-sm font-medium text-slate-900">{formatDuration(selected.duration)}</p></div>
                </div>

                {selected.respondentEmail && (
                  <p className="text-xs text-slate-500 mb-4">Respondent email: <span className="text-slate-700">{selected.respondentEmail}</span></p>
                )}

                <div className="space-y-5 mb-5">
                  {survey.questions.map((q, i) => {
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

                <div className="pt-4 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Potential consistency issues</p>
                  {selected.quality?.flags?.length ? (
                    <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
                      {selected.quality.flags.map((f: string, i: number) => <li key={i}>{f}</li>)}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-400">None</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

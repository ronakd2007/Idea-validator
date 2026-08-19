'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getStoredUser, isViewMode } from '@/lib/auth';
import BarChart from '@/components/BarChart';
import HBarChart from '@/components/HBarChart';
import StackedBar from '@/components/StackedBar';
import LineChart from '@/components/LineChart';
import { chartKindFor, readingFor, chartNoteFor, lowSampleNote } from '@/lib/questionChart';
import AIChatPanel from '@/components/chat/AIChatPanel';

const RANGES: { value: string; label: string }[] = [
  { value: '24h', label: '24 hours' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'all', label: 'All time' },
];

const TONE_STYLE: Record<string, { bg: string; text: string; icon: string }> = {
  positive: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', icon: '✓' },
  warning: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', icon: '⚠' },
  neutral: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', icon: '•' },
};

const QUALITY_STYLE: Record<string, { label: string; chip: string }> = {
  HIGH: { label: 'High Quality', chip: 'bg-emerald-50 text-emerald-700' },
  MEDIUM: { label: 'Medium', chip: 'bg-amber-50 text-amber-700' },
  POTENTIALLY_LOW: { label: 'Potentially Low Quality', chip: 'bg-red-50 text-red-700' },
};

const NOTE_TONE: Record<string, string> = {
  positive: 'text-emerald-600',
  warning: 'text-amber-600',
  neutral: 'text-slate-400',
};

// Every headline number carries one plain-language sentence saying what it
// means for the founder — the number alone never has to be interpreted.
function SummaryCard({ label, value, sub, note, noteTone = 'neutral' }: { label: string; value: string; sub?: string; note?: string; noteTone?: 'positive' | 'warning' | 'neutral' }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-1">{sub}</p>}
      {note && <p className={`text-[11px] leading-snug mt-1.5 ${NOTE_TONE[noteTone]}`}>{note}</p>}
    </div>
  );
}

// Interpretation rules — thresholds are product guidance, not statistics.
function interpret(summary: any): {
  confidence: { note: string; tone: 'positive' | 'warning' | 'neutral' };
  completion?: { note: string; tone: 'positive' | 'warning' | 'neutral' };
  quality?: { note: string; tone: 'positive' | 'warning' | 'neutral' };
} {
  const n = summary.totalResponses;
  const confidence =
    n === 0
      ? { note: 'No responses yet — share the link or QR code to start collecting.', tone: 'neutral' as const }
      : n < 10
        ? { note: 'Very limited data — treat everything below as hints, not conclusions.', tone: 'warning' as const }
        : n < 30
          ? { note: 'An early signal — enough to spot patterns, not to be sure of them.', tone: 'neutral' as const }
          : { note: 'A solid sample for an early-stage survey — patterns here are worth acting on.', tone: 'positive' as const };

  const rate = summary.completionRate;
  const completion =
    rate == null
      ? undefined
      : rate >= 70
        ? { note: 'Strong — most people who start actually finish.', tone: 'positive' as const }
        : rate >= 40
          ? { note: 'Moderate — trimming a question or two usually lifts this.', tone: 'neutral' as const }
          : { note: 'Low — the survey may be too long, or an early question puts people off.', tone: 'warning' as const };

  const q = summary.qualityHighPct;
  const quality =
    q == null
      ? undefined
      : q >= 80
        ? { note: 'Answers look considered — few rushed or contradictory responses.', tone: 'positive' as const }
        : q >= 50
          ? { note: 'Mostly fine — skim the flagged responses before relying on them.', tone: 'neutral' as const }
          : { note: 'Many responses show rushed patterns — review them before drawing conclusions.', tone: 'warning' as const };

  return { confidence, completion, quality };
}

function DistributionBar({ label, count, pct, imageUrl }: { label: string; count: number; pct: number; imageUrl?: string | null }) {
  return (
    <div className="mb-2.5">
      <div className="flex justify-between text-sm mb-1 gap-2">
        {/* truncate has to sit on the text itself — ellipsis never applies to a
            flex container, so it silently did nothing on the wrapper. */}
        <span className="text-slate-700 flex items-center gap-2 min-w-0">
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" loading="lazy" className="w-8 h-6 object-cover rounded border border-slate-200 shrink-0" />
          )}
          <span className="truncate">{label}</span>
        </span>
        <span className="text-slate-500 shrink-0 tabular-nums">{count} &middot; {pct.toFixed(0)}%</span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2">
        <div className="h-2 rounded-full bg-blue-600" style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

function OpenTextBrowser({ surveyId, questionId, total }: { surveyId: string; questionId: string; total: number }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<{ id: string; text: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.getSurveyResponses(surveyId, { questionId, search: search || undefined, pageSize: 20 })
      .then((res) => {
        const rows = (res.responses || []).map((r: any) => {
          const a = r.answers.find((x: any) => x.questionId === questionId);
          let text = '';
          try { text = a ? JSON.parse(a.value) : ''; } catch { text = a?.value || ''; }
          return { id: r.id, text };
        }).filter((r: any) => r.text);
        setItems(rows);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [surveyId, questionId, search]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  return (
    <div className="mt-3 pt-3 border-t border-slate-100">
      <button onClick={() => setOpen((v) => !v)} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
        {open ? 'Hide' : `Browse ${total} response${total !== 1 ? 's' : ''}`}
      </button>
      {open && (
        <div className="mt-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search responses..."
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3"
          />
          {loading && <p className="text-xs text-slate-400">Loading...</p>}
          {!loading && items.length === 0 && <p className="text-xs text-slate-400">No responses match.</p>}
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {items.map((item) => (
              <p key={item.id} className="text-sm text-slate-700 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">&ldquo;{item.text}&rdquo;</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

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

  useEffect(() => {
    const user = getStoredUser();
    if (!user || user.role !== 'FOUNDER') { router.push('/auth/login'); return; }
    setViewMode(isViewMode());
  }, [router]);

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
        <button onClick={exportCsv} disabled={exporting} className="text-sm bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:border-slate-300 disabled:opacity-60">
          {exporting ? 'Exporting...' : 'Export Responses'}
        </button>
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

      {/* Top summary cards — each with a plain-language read of the number */}
      {(() => {
        const meaning = interpret(summary);
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <SummaryCard label="Total Responses" value={String(summary.totalResponses)} sub={sampleSizeLabel} note={meaning.confidence.note} noteTone={meaning.confidence.tone} />
            <SummaryCard label="Completion Rate" value={summary.completionRate != null ? `${summary.completionRate.toFixed(0)}%` : 'N/A'} note={meaning.completion?.note} noteTone={meaning.completion?.tone} />
            <SummaryCard label="Avg. Completion Time" value={summary.avgCompletionTime} note="Typical time from opening the survey to submitting it." />
            <SummaryCard label="Response Quality" value={summary.qualityHighPct != null ? `${summary.qualityHighPct.toFixed(0)}%` : 'N/A'} sub="High quality" note={meaning.quality?.note} noteTone={meaning.quality?.tone} />
          </div>
        );
      })()}

      {/* Key Insights */}
      {insights.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-6">
          <h3 className="font-semibold text-slate-900 mb-4">Key Insights</h3>
          <div className="space-y-3">
            {insights.map((ins: any, i: number) => {
              const style = TONE_STYLE[ins.tone] || TONE_STYLE.neutral;
              return (
                <div key={i} className={`border rounded-lg px-4 py-3 ${style.bg}`}>
                  <p className={`text-sm font-semibold ${style.text} flex items-center gap-1.5`}><span>{style.icon}</span>{ins.title}</p>
                  <p className="text-sm text-slate-600 mt-0.5">{ins.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Response trend */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="font-semibold text-slate-900">Responses Over Time</h3>
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            {RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                className={`px-3 py-1 rounded-md text-xs font-medium ${range === r.value ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        {trend.length > 0 ? <LineChart data={trend.map((t: any) => ({ label: t.label, value: t.count }))} /> : <p className="text-sm text-slate-400 text-center py-8">No responses in this range.</p>}
      </div>

      {/* Survey Activity + Time Spent */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Survey Activity</h3>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Started</span><span className="font-semibold text-slate-900 tabular-nums">{activity.started}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Completed</span><span className="font-semibold text-slate-900 tabular-nums">{activity.completed}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Abandoned</span><span className="font-semibold text-slate-900 tabular-nums">{activity.abandoned}</span></div>
          </div>
          <div className="mt-4">
            <StackedBar
              segments={[
                { label: 'Completed', count: activity.completed, color: '#2563eb' },
                { label: 'Abandoned', count: activity.abandoned, color: '#cbd5e1' },
              ]}
            />
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between">
            <span className="text-sm text-slate-500">Completion Rate</span>
            <span className="text-sm font-bold text-blue-600">{activity.completionRate != null ? `${activity.completionRate.toFixed(1)}%` : 'N/A'}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Time Spent</h3>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div><p className="text-xl font-bold text-slate-900">{time.average}</p><p className="text-xs text-slate-500 mt-0.5">Average</p></div>
            <div><p className="text-xl font-bold text-slate-900">{time.median}</p><p className="text-xs text-slate-500 mt-0.5">Median</p></div>
            <div><p className="text-sm font-semibold text-slate-700">{time.fastest}</p><p className="text-xs text-slate-500 mt-0.5">Fastest</p></div>
            <div><p className="text-sm font-semibold text-slate-700">{time.longest}</p><p className="text-xs text-slate-500 mt-0.5">Longest</p></div>
          </div>
        </div>
      </div>

      {/* Response Quality */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-6">
        <h3 className="font-semibold text-slate-900 mb-1">Response Quality</h3>
        <p className="text-xs text-slate-500 mb-4">Based on multiple independent signals — never a single one alone. Nothing is hidden or deleted automatically.</p>
        {/* Status colours, so each segment carries an icon as well — the state
            is never signalled by colour alone. */}
        <div className="mb-5">
          <StackedBar
            segments={[
              { label: 'High quality', count: quality.buckets.HIGH || 0, color: '#059669', icon: '✓' },
              { label: 'Medium', count: quality.buckets.MEDIUM || 0, color: '#d97706', icon: '!' },
              { label: 'Potentially low', count: quality.buckets.POTENTIALLY_LOW || 0, color: '#dc2626', icon: '⚠' },
            ]}
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {(['HIGH', 'MEDIUM', 'POTENTIALLY_LOW'] as const).map((key) => {
            const count = quality.buckets[key] || 0;
            const pct = quality.total ? (count / quality.total) * 100 : 0;
            const style = QUALITY_STYLE[key];
            return (
              <Link key={key} href={`/founder/surveys/${surveyId}/responses?quality=${key}`} className="text-center block hover:opacity-80">
                <p className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mb-2 ${style.chip}`}>{style.label}</p>
                <p className="text-2xl font-bold text-slate-900 tabular-nums">{count}</p>
                <p className="text-xs text-slate-500">{pct.toFixed(0)}%</p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Segment Analysis + Question Impact share the outcome selector */}
      {(eligibleOutcomeQuestions.length > 0 || eligibleSegmentQuestions.length > 0) && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-6">
          <h3 className="font-semibold text-slate-900 mb-1">Who Actually Wants This?</h3>
          <p className="text-xs text-slate-500 mb-4">Compare responses by segment and see which factors associate with your outcome of interest.</p>

          <div className="flex flex-wrap gap-4 mb-6">
            {eligibleSegmentQuestions.length > 0 && (
              <label className="text-sm text-slate-600">
                Compare by
                <select value={segmentQuestionId} onChange={(e) => setSegmentQuestionId(e.target.value)} className="ml-2 border border-slate-200 rounded-md text-sm px-2 py-1.5">
                  <option value="">Select a question...</option>
                  {eligibleSegmentQuestions.map((q: any) => <option key={q.id} value={q.id}>{q.questionText}</option>)}
                </select>
              </label>
            )}
            {eligibleOutcomeQuestions.length > 0 && (
              <label className="text-sm text-slate-600">
                Outcome
                <select value={outcomeQuestionId} onChange={(e) => setOutcomeQuestionId(e.target.value)} className="ml-2 border border-slate-200 rounded-md text-sm px-2 py-1.5">
                  <option value="">Select a question...</option>
                  {eligibleOutcomeQuestions.filter((q: any) => q.id !== segmentQuestionId).map((q: any) => <option key={q.id} value={q.id}>{q.questionText}</option>)}
                </select>
              </label>
            )}
          </div>

          {segmentation && segmentation.segments.length === 0 && (
            <p className="text-sm text-slate-500 mb-6">No responses have answered that question yet.</p>
          )}

          {segmentation && segmentation.segments.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Segment Performance</p>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                {segmentation.segments.map((s: any) => (
                  <div key={s.label} className="border border-slate-200 rounded-lg p-4">
                    <p className="font-semibold text-slate-900">{s.label}</p>
                    <p className="text-xs text-slate-500 mb-2">{s.responseCount} response{s.responseCount !== 1 ? 's' : ''}</p>
                    {s.outcome?.value != null && (
                      <p className="text-lg font-bold text-blue-600">
                        {s.outcome.type === 'percent' ? `${s.outcome.value.toFixed(0)}%` : `${s.outcome.value.toFixed(1)}/${s.outcome.max}`}
                      </p>
                    )}
                    {s.outcome?.type === 'distribution' && s.outcome.items.length > 0 && (
                      <div className="space-y-1">
                        {s.outcome.items.map((it: any) => (
                          <div key={it.label} className="flex items-center justify-between gap-2 text-xs">
                            <span className="text-slate-600 truncate">{it.label}</span>
                            <span className="font-semibold text-blue-600 shrink-0">{it.pct.toFixed(0)}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {!outcomeQuestionId && eligibleOutcomeQuestions.filter((q: any) => q.id !== segmentQuestionId).length > 0 && (
                <p className="text-xs text-slate-400 mt-3">
                  Pick an Outcome question above to see how each group answered it.
                </p>
              )}
            </div>
          )}

          {impact && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Question Impact — factors associated with &ldquo;{impact.outcomeQuestionText}&rdquo;</p>
              <div className="space-y-2">
                {impact.factors.map((f: any, i: number) => (
                  <div key={i} className="flex items-center justify-between border-b border-slate-100 py-2 text-sm">
                    <span className="text-slate-700">{f.questionText}</span>
                    <span className={`font-medium ${f.strength?.startsWith('Strong') ? 'text-blue-700' : f.strength?.startsWith('Moderate') ? 'text-blue-500' : 'text-slate-400'}`}>
                      {f.strength || f.result}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* A/B Test Results */}
      {abResults.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-6">
          <h3 className="font-semibold text-slate-900 mb-4">A/B Test Results</h3>
          <div className="space-y-4">
            {abResults.map((r: any) => (
              <div key={r.groupKey} className="border border-slate-200 rounded-lg p-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  {[r.variantA, r.variantB].map((v: any, i: number) => (
                    <div key={i}>
                      <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Variant {i === 0 ? 'A' : 'B'}</p>
                      <p className="text-sm text-slate-700 mb-1">{v.questionText}</p>
                      <p className="text-xs text-slate-400 mb-1">{v.n} response{v.n !== 1 ? 's' : ''}</p>
                      {v.positivePct != null && <p className="text-lg font-bold text-blue-600">{v.positivePct.toFixed(0)}% Yes</p>}
                      {v.average != null && <p className="text-lg font-bold text-blue-600">{v.average.toFixed(1)}/{v.max}</p>}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-3 pt-3 border-t border-slate-100">{r.note}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drop-off */}
      {dropOff.length > 1 && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-6">
          <h3 className="font-semibold text-slate-900 mb-1">Question Drop-off</h3>
          <p className="text-xs text-slate-500 mb-4">
            How far respondents get before giving up. A steep fall after one question usually means that question is
            confusing, too personal, or too much effort — fixing it is the fastest way to get more complete responses.
          </p>
          {(() => {
            // The story is the biggest single fall, not the absolute heights —
            // so find it, paint that step red, and say it in words.
            let worstIdx = -1, worstDrop = 0;
            for (let i = 1; i < dropOff.length; i++) {
              const drop = dropOff[i - 1].reachedPct - dropOff[i].reachedPct;
              if (drop > worstDrop) { worstDrop = drop; worstIdx = i; }
            }
            return (
              <>
                <HBarChart
                  sorted={false}
                  maxBars={dropOff.length}
                  data={dropOff.map((d: any, i: number) => ({
                    label: `Q${d.index + 1}. ${d.questionText}`,
                    count: d.reachedCount,
                    pct: d.reachedPct,
                    highlight: i === worstIdx && worstDrop >= 10,
                  }))}
                />
                {worstIdx > 0 && worstDrop >= 10 && (
                  <p className="text-sm text-slate-600 mt-3 leading-relaxed">
                    You lose most people at <span className="font-semibold text-slate-900">Question {worstIdx + 1}</span> —
                    a {worstDrop.toFixed(0)} point drop. Shortening or simplifying it is the fastest way to more complete responses.
                  </p>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Per-question analytics */}
      <div className="space-y-4">
        <h3 className="font-semibold text-slate-900">Question Breakdown</h3>
        {questions.map((q: any, i: number) => (
          <div key={q.id} className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-xs font-semibold text-slate-400 mb-1">Q{i + 1}</p>
                <p className="text-sm font-medium text-slate-900">{q.questionText}</p>
              </div>
              <span className="text-xs text-slate-400 shrink-0">{q.answeredCount} answered</span>
            </div>

            {(() => {
              const kind = chartKindFor(q);
              const reading = readingFor(q);
              const note = chartNoteFor(q);
              const low = lowSampleNote(q.answeredCount);

              return (
                <div className="mt-3">
                  {low && (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5 mb-3">
                      {low}
                    </p>
                  )}

                  {kind === 'EMPTY' && <p className="text-sm text-slate-400">No answers yet.</p>}

                  {/* Yes/No — one proportion, so one stacked bar. */}
                  {kind === 'STACKED' && (
                    <StackedBar
                      segments={['Yes', 'No'].map((label) => ({
                        label,
                        count: q.distribution?.find((d: any) => d.label === label)?.count ?? 0,
                        color: label === 'Yes' ? '#2563eb' : '#cbd5e1',
                      }))}
                    />
                  )}

                  {/* Choice-style answers — horizontal bars, most-picked first. */}
                  {kind === 'HBAR' && (
                    <>
                      {note && <p className="text-xs text-slate-500 mb-2.5">{note}</p>}
                      <HBarChart
                        data={q.distribution.map((d: any) => ({ label: d.label, count: d.count, pct: d.pct, imageUrl: d.imageUrl }))}
                      />
                    </>
                  )}

                  {/* Rating / linear scale — ordered columns, never sorted: the
                      shape of the distribution is the finding (two humps = two
                      audiences), which an average alone would hide. */}
                  {kind === 'COLUMNS' && (
                    <>
                      {q.average != null && (
                        <p className="text-sm text-slate-600 mb-2">
                          Average: <span className="text-lg font-bold text-blue-600">{q.average.toFixed(1)}</span>
                          <span className="text-slate-400"> out of {q.max}</span>
                        </p>
                      )}
                      <BarChart data={q.distribution.map((d: any) => ({ label: String(d.value), value: d.count }))} height={90} />
                    </>
                  )}

                  {reading && <p className="text-sm text-slate-600 mt-3 leading-relaxed">{reading}</p>}
                </div>
              );
            })()}

            {q.isText && (
              <OpenTextBrowser surveyId={surveyId} questionId={q.id} total={q.answeredCount} />
            )}
          </div>
        ))}
      </div>
    </div>
    <AIChatPanel targetType="survey" targetId={surveyId} readOnly={viewMode} />
    </div>
  );
}

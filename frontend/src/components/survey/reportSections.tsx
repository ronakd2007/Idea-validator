'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import BarChart from '@/components/BarChart';
import HBarChart from '@/components/HBarChart';
import StackedBar from '@/components/StackedBar';
import LineChart from '@/components/LineChart';
import { chartKindFor, readingFor, chartNoteFor, lowSampleNote } from '@/lib/questionChart';

/**
 * Presentational blocks of a survey report, shared by the founder's analytics
 * page and the public share link so the two can never drift apart. Everything
 * here is driven purely by the payload it is handed — the public page simply
 * receives a payload with the hidden sections already removed server-side.
 */

export const RANGES: { value: string; label: string }[] = [
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
// means for the reader — the number alone never has to be interpreted.
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
export function interpret(summary: any): {
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

export function SummaryCards({ summary, sampleSizeLabel }: { summary: any; sampleSizeLabel: string }) {
  const meaning = interpret(summary);
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <SummaryCard label="Total Responses" value={String(summary.totalResponses)} sub={sampleSizeLabel} note={meaning.confidence.note} noteTone={meaning.confidence.tone} />
      <SummaryCard label="Completion Rate" value={summary.completionRate != null ? `${summary.completionRate.toFixed(0)}%` : 'N/A'} note={meaning.completion?.note} noteTone={meaning.completion?.tone} />
      <SummaryCard label="Typical Completion Time" value={summary.avgCompletionTime} note="Median active time spent filling in the survey. Responses recorded before active-time tracking may include idle time." />
      <SummaryCard label="Response Quality" value={summary.qualityHighPct != null ? `${summary.qualityHighPct.toFixed(0)}%` : 'N/A'} sub="High quality" note={meaning.quality?.note} noteTone={meaning.quality?.tone} />
    </div>
  );
}

export function InsightsCard({ insights }: { insights: any[] }) {
  if (!insights?.length) return null;
  return (
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
  );
}

export function TrendCard({ trend, range, onRangeChange }: { trend: any[]; range: string; onRangeChange: (r: string) => void }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h3 className="font-semibold text-slate-900">Responses Over Time</h3>
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => onRangeChange(r.value)}
              className={`px-3 py-1 rounded-md text-xs font-medium ${range === r.value ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      {trend.length > 0 ? <LineChart data={trend.map((t: any) => ({ label: t.label, value: t.count }))} /> : <p className="text-sm text-slate-400 text-center py-8">No responses in this range.</p>}
    </div>
  );
}

export function ActivityTimeCards({ activity, time }: { activity: any; time: any }) {
  return (
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
  );
}

// `linkBase` is the founder's responses page; the public report passes nothing
// and the buckets render as plain figures instead of links.
export function QualityCard({ quality, linkBase }: { quality: any; linkBase?: string }) {
  return (
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
          const body = (
            <>
              <p className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mb-2 ${style.chip}`}>{style.label}</p>
              <p className="text-2xl font-bold text-slate-900 tabular-nums">{count}</p>
              <p className="text-xs text-slate-500">{pct.toFixed(0)}%</p>
            </>
          );
          return linkBase ? (
            <Link key={key} href={`${linkBase}?quality=${key}`} className="text-center block hover:opacity-80">{body}</Link>
          ) : (
            <div key={key} className="text-center">{body}</div>
          );
        })}
      </div>
    </div>
  );
}

// The card is always visible; it shows an empty state until someone actually
// starts answering, so the feature stays discoverable.
export function DropOffCard({ dropOff }: { dropOff: any[] }) {
  const rows = dropOff || [];
  // The story is the biggest single fall, not the absolute heights — so find
  // it, paint that step red, and say it in words.
  let worstIdx = -1, worstDrop = 0;
  for (let i = 1; i < rows.length; i++) {
    const drop = rows[i - 1].reachedPct - rows[i].reachedPct;
    if (drop > worstDrop) { worstDrop = drop; worstIdx = i; }
  }
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 mb-6">
      <h3 className="font-semibold text-slate-900 mb-1">Question Drop-off</h3>
      <p className="text-xs text-slate-500 mb-4">
        How far respondents get before giving up. A steep fall after one question usually means that question is
        confusing, too personal, or too much effort — fixing it is the fastest way to get more complete responses.
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">
          No one has started answering yet. This chart appears once a respondent answers at least one question —
          people who only open the link without answering anything are not counted.
        </p>
      ) : (
        <>
          <HBarChart
            sorted={false}
            maxBars={rows.length}
            data={rows.map((d: any, i: number) => ({
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
      )}
    </div>
  );
}

export function ABResultsCard({ abResults }: { abResults: any[] }) {
  if (!abResults?.length) return null;
  return (
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
  );
}

// `loadText` abstracts where the open-text answers come from: the founder's
// authenticated endpoint, or the public share endpoint. Omitted entirely when
// individual responses are not shared.
function OpenTextBrowser({ questionId, total, loadText }: {
  questionId: string;
  total: number;
  loadText: (questionId: string, search: string) => Promise<{ id: string; text: string }[]>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<{ id: string; text: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    loadText(questionId, search)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [questionId, search, loadText]);

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

export function QuestionBreakdown({ questions, loadText }: {
  questions: any[];
  loadText?: (questionId: string, search: string) => Promise<{ id: string; text: string }[]>;
}) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-slate-900">Question Breakdown</h3>
      {questions.map((q: any, i: number) => {
        const kind = chartKindFor(q);
        const reading = readingFor(q);
        const note = chartNoteFor(q);
        const low = lowSampleNote(q.answeredCount);
        return (
          <div key={q.id} className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-xs font-semibold text-slate-400 mb-1">Q{i + 1}</p>
                <p className="text-sm font-medium text-slate-900">{q.questionText}</p>
              </div>
              <span className="text-xs text-slate-400 shrink-0">{q.answeredCount} answered</span>
            </div>

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

            {q.isText && loadText && (
              <OpenTextBrowser questionId={q.id} total={q.answeredCount} loadText={loadText} />
            )}
          </div>
        );
      })}
    </div>
  );
}

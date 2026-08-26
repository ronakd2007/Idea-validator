'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import ValidationProgress, { ProgressStep } from '@/components/founder/ValidationProgress';
import StatusBadge, { type BadgeTone } from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { TONE_DOM, riskTone, breakdownStatus } from '@/lib/reportStatus';

/**
 * AI Deep Dive — the autonomous research layer.
 *
 * It is one evidence source among three: the AI researches, experts judge, and
 * customers answer surveys. The copy here is deliberate about that — this panel
 * reports what research found and what it could not verify, and never claims an
 * idea has been "validated" by the AI.
 *
 * Runs start themselves when an idea is paid for. This component watches one
 * (polling only while it is actually running) and renders the finished report
 * decision-first: verdict, evidence coverage, opportunity and risk before any
 * of the underlying research.
 */

const POLL_MS = 2500;
const ACTIVE = ['QUEUED', 'RUNNING'];

const VERDICT_META: Record<string, { label: string; tone: BadgeTone; blurb: string }> = {
  GO: { label: 'Go', tone: 'success', blurb: 'The research supports moving forward.' },
  GO_WITH_CHANGES: { label: 'Go with changes', tone: 'info', blurb: 'Promising, but something needs to change first.' },
  PIVOT: { label: 'Pivot', tone: 'warning', blurb: 'The core idea needs rethinking before more is invested.' },
  NO_GO: { label: 'No go', tone: 'danger', blurb: 'The research argues against pursuing this as it stands.' },
};

const COVERAGE_META: Record<string, { label: string; tone: BadgeTone }> = {
  STRONG: { label: 'Strong', tone: 'success' },
  MODERATE: { label: 'Moderate', tone: 'warning' },
  LIMITED: { label: 'Limited', tone: 'danger' },
};

const LEVEL_TONE: Record<string, BadgeTone> = { LOW: 'success', MEDIUM: 'warning', HIGH: 'danger' };
const THREAT_TONE: Record<string, BadgeTone> = { LOW: 'neutral', MEDIUM: 'warning', HIGH: 'danger' };
const AGREEMENT_TONE: Record<string, BadgeTone> = { HIGH: 'success', MODERATE: 'warning', LOW: 'danger' };

function Card({ title, hint, children, className = '' }: { title?: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-slate-200 shadow-sm rounded-xl p-6 mb-6 ${className}`}>
      {title && <h3 className="font-semibold text-slate-900 mb-1">{title}</h3>}
      {hint && <p className="text-xs text-slate-500 mb-4">{hint}</p>}
      {children}
    </div>
  );
}

function Bullets({ items, tone = 'text-slate-600' }: { items: string[]; tone?: string }) {
  if (!items?.length) return null;
  return (
    <ul className={`text-sm space-y-1.5 ${tone}`}>
      {items.map((item, i) => (
        <li key={i} className="flex gap-2"><span className="text-slate-300 shrink-0">•</span><span>{item}</span></li>
      ))}
    </ul>
  );
}

function Chips({ items }: { items: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, i) => (
        <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md">{item}</span>
      ))}
    </div>
  );
}

export default function AiValidationPanel({
  ideaId,
  report: publicReport,
  isPublic = false,
  viewMode = false,
  eligible = true,
}: {
  ideaId?: string;
  report?: any;
  isPublic?: boolean;
  viewMode?: boolean;
  eligible?: boolean;
}) {
  const [run, setRun] = useState<any>(publicReport ? { status: 'COMPLETED', report: publicReport } : null);
  const [loading, setLoading] = useState(!isPublic);
  const [loaded, setLoaded] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  // A failed poll keeps the last good data on screen rather than blanking a
  // report the founder is reading — the same behaviour survey analytics uses.
  const [staleWarning, setStaleWarning] = useState(false);

  const active = !isPublic && run && ACTIVE.includes(run.status);

  // `loaded` flips once, so load() keeps a stable identity across polls —
  // depending on `run` would rebuild the interval on every tick.
  const load = useCallback(async () => {
    if (!ideaId) return;
    try {
      const res: any = await api.getLatestAiDeepDive(ideaId);
      setRun(res.run);
      setLoaded(true);
      setStaleWarning(false);
    } catch (err: any) {
      if (loaded) setStaleWarning(true);
      else setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [ideaId, loaded]);

  useEffect(() => {
    if (isPublic) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPublic]);

  // Poll only while a run is genuinely in progress, and only while the tab is
  // visible — a backgrounded dashboard should not keep hitting the API.
  useEffect(() => {
    if (isPublic || !active) return;
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      load();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [isPublic, active, load]);

  const startRun = async () => {
    if (!ideaId) return;
    setStarting(true);
    setError('');
    try {
      await api.runAiDeepDive(ideaId);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-28 bg-slate-200/70 rounded-xl" />
        <div className="h-56 bg-slate-200/70 rounded-xl" />
      </div>
    );
  }

  if (error && !run) {
    return <div className="bg-red-50 text-red-700 border border-red-200 rounded-lg p-4 text-sm">{error}</div>;
  }

  // ---------- no run yet ----------
  if (!run) {
    if (!eligible) {
      return (
        <EmptyState
          title="AI Deep Dive starts once your idea is submitted"
          body="When your submission is complete, the research agent automatically studies your market, finds real competitors and reports what the evidence does and doesn't support."
        />
      );
    }
    return (
      <Card>
        <div className="text-center py-4">
          <div className="text-3xl mb-3">✦</div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Run an AI Deep Dive</h3>
          <p className="text-sm text-slate-600 max-w-lg mx-auto mb-1">
            An autonomous research agent studies your idea on the live web: who you are competing with, what the market
            looks like, what customers complain about, and which assumptions are still untested.
          </p>
          <p className="text-xs text-slate-500 max-w-lg mx-auto mb-5">
            It is a research layer, not a replacement for expert reviews or customer surveys — it tells you what the
            evidence shows and, just as importantly, what it could not verify.
          </p>
          <button
            onClick={startRun}
            disabled={starting || viewMode}
            title={viewMode ? 'Not available while viewing as this user' : undefined}
            className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-60"
          >
            {starting ? 'Starting…' : 'Run AI Deep Dive'}
          </button>
          {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
        </div>
      </Card>
    );
  }

  // ---------- running ----------
  if (ACTIVE.includes(run.status)) {
    const steps: ProgressStep[] = (run.steps || []).map((s: any) => ({
      label: s.label,
      state: s.status === 'DONE' ? 'done' : s.status === 'RUNNING' ? 'active' : 'pending',
      detail: s.detail,
    }));
    return (
      <>
        <div className="bg-gradient-to-br from-blue-50 to-slate-50 border border-blue-200 rounded-xl p-5 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
            <div>
              <p className="text-sm font-semibold text-slate-900">AI research in progress</p>
              <p className="text-xs text-slate-600">Researching the live web and your existing evidence. This usually takes 2–4 minutes — you can leave this page and come back.</p>
            </div>
          </div>
        </div>
        <ValidationProgress steps={steps} />
        {staleWarning && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
            Couldn&apos;t refresh just now — showing the last update received.
          </p>
        )}
      </>
    );
  }

  // ---------- failed ----------
  if (run.status === 'FAILED') {
    return (
      <Card>
        <div className="flex items-start gap-3">
          <span className="text-red-500 text-lg leading-none">▲</span>
          <div className="flex-1">
            <h3 className="font-semibold text-slate-900 mb-1">AI research didn&apos;t finish</h3>
            <p className="text-sm text-slate-600 mb-4">{run.error || 'Something went wrong during the research run.'}</p>
            {!isPublic && (
              <button
                onClick={startRun}
                disabled={starting || viewMode}
                title={viewMode ? 'Not available while viewing as this user' : undefined}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-60"
              >
                {starting ? 'Starting…' : 'Retry'}
              </button>
            )}
            {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
          </div>
        </div>
      </Card>
    );
  }

  const r = run.report;
  if (!r) {
    return <EmptyState title="No report available" body="This run finished without a readable report. Running it again should produce one." />;
  }

  const verdict = r.verdict ? VERDICT_META[r.verdict] : null;
  const coverage = COVERAGE_META[r.evidenceCoverage?.level] || COVERAGE_META.LIMITED;

  return (
    <>
      {staleWarning && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          Couldn&apos;t refresh just now — showing the last loaded report.
        </p>
      )}

      {/* Web research unavailable — stated up front, never buried. */}
      {!r.webSearchUsed && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
          <p className="text-sm text-amber-800">
            <span className="font-semibold">Live web research was unavailable for this run.</span> Some findings are based
            on available model knowledge and existing IdeaValidator data.
          </p>
        </div>
      )}

      {/* 1. VERDICT */}
      <div className="bg-gradient-to-br from-blue-50 to-slate-50 border border-blue-200 rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
          <div>
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">AI assessment</p>
            <div className="flex items-center gap-2 flex-wrap">
              {verdict ? <StatusBadge tone={verdict.tone} dot>{verdict.label}</StatusBadge> : <StatusBadge tone="neutral">No verdict</StatusBadge>}
              <span className="text-xs text-slate-500">{verdict?.blurb}</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black text-slate-900 tabular-nums">{r.confidence}%</div>
            <div className="text-[11px] text-slate-500">confidence</div>
          </div>
        </div>
        {r.verdictSummary && <p className="text-sm text-slate-700 leading-relaxed mb-4">{r.verdictSummary}</p>}
        <p className="text-xs text-slate-500 mb-4">{r.confidenceRationale}</p>

        <div className="grid md:grid-cols-2 gap-4">
          {r.keyEvidence?.length > 0 && (
            <div className="bg-white/70 rounded-lg p-4">
              <div className="text-xs font-semibold text-slate-700 mb-2">What supports this</div>
              <Bullets items={r.keyEvidence} />
            </div>
          )}
          <div className="bg-white/70 rounded-lg p-4 space-y-3">
            {r.biggestUncertainty && (
              <div>
                <div className="text-xs font-semibold text-slate-700 mb-1">Biggest uncertainty</div>
                <p className="text-sm text-slate-600">{r.biggestUncertainty}</p>
              </div>
            )}
            {r.nextValidationStep && (
              <div>
                <div className="text-xs font-semibold text-blue-700 mb-1">→ Test this next</div>
                <p className="text-sm text-slate-600">{r.nextValidationStep}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. EVIDENCE COVERAGE — how much evidence exists, not how sure the AI is. */}
      <Card>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
          <h3 className="font-semibold text-slate-900">Evidence coverage</h3>
          <StatusBadge tone={coverage.tone} dot>{coverage.label}</StatusBadge>
        </div>
        <p className="text-sm text-slate-600 mb-2">{r.evidenceCoverage?.explanation}</p>
        <p className="text-xs text-slate-400">
          Coverage is how much real evidence this run had to work with. Confidence, above, is how strongly that evidence
          points one way. They are not the same thing.
        </p>
      </Card>

      {/* 3 + 4. THE TWO HEADLINES */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 mb-2"><span>▲</span>Biggest opportunity</div>
          <p className="text-sm text-slate-700">{r.biggestOpportunity || 'No clear standout opportunity was identified.'}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-red-700 mb-2"><span>▼</span>Biggest risk</div>
          <p className="text-sm text-slate-700">{r.biggestRisk || 'No single dominant risk was identified.'}</p>
        </div>
      </div>

      {/* 5. COMPETITORS */}
      <Card title="Competitors" hint="Who this idea is up against. Links and prices come only from sources the agent actually found.">
        {r.competitors?.summary && <p className="text-sm text-slate-600 mb-5">{r.competitors.summary}</p>}
        {r.competitors?.direct?.length > 0 ? (
          <div className="space-y-4">
            {r.competitors.direct.map((c: any, i: number) => (
              <div key={i} className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                  <div>
                    {c.url ? (
                      <a href={c.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-700 hover:underline">{c.name} ↗</a>
                    ) : (
                      <span className="font-semibold text-slate-900">{c.name}</span>
                    )}
                    <p className="text-sm text-slate-600 mt-0.5">{c.whatTheyDo}</p>
                  </div>
                  <StatusBadge tone={THREAT_TONE[c.threat] || 'neutral'}>{c.threat} threat</StatusBadge>
                </div>
                <p className={`text-xs mb-3 ${c.pricing ? 'text-slate-600' : 'text-slate-400 italic'}`}>
                  {c.pricing ? `Pricing: ${c.pricing}` : 'Pricing not publicly verified.'}
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {c.strengths?.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 mb-1"><span>▲</span>Strengths</div>
                      <Bullets items={c.strengths} />
                    </div>
                  )}
                  {c.weaknesses?.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-red-600 mb-1"><span>▼</span>Weaknesses</div>
                      <Bullets items={c.weaknesses} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No direct competitors were confirmed by the research.</p>
        )}

        {r.competitors?.indirect?.length > 0 && (
          <div className="mt-5 pt-5 border-t border-slate-100">
            <div className="text-xs font-semibold text-slate-700 mb-2">Indirect alternatives</div>
            <div className="space-y-1.5">
              {r.competitors.indirect.map((c: any, i: number) => (
                <p key={i} className="text-sm text-slate-600"><span className="font-medium text-slate-800">{c.name}</span> — {c.description}</p>
              ))}
            </div>
          </div>
        )}

        {r.competitors?.substitutes?.length > 0 && (
          <div className="mt-5 pt-5 border-t border-slate-100">
            <div className="text-xs font-semibold text-slate-700 mb-2">What customers do instead today</div>
            <Chips items={r.competitors.substitutes} />
          </div>
        )}

        {r.competitors?.differentiationInference && (
          <div className="mt-5 bg-violet-50 border border-violet-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge tone="accent">AI inference</StatusBadge>
              <span className="text-xs font-semibold text-slate-700">Potential differentiation</span>
            </div>
            <p className="text-sm text-slate-700">{r.competitors.differentiationInference}</p>
            <p className="text-[11px] text-slate-500 mt-2">This is the agent&apos;s reasoning, not an observed fact.</p>
          </div>
        )}
      </Card>

      {/* 6. MARKET */}
      <Card title="Market" hint="Figures appear only where a real source stated them.">
        {r.market?.summary && <p className="text-sm text-slate-600 mb-5">{r.market.summary}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          {(['tam', 'sam', 'som'] as const).map(key => (
            <div key={key} className="border border-slate-200 rounded-lg p-4">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">{key}</div>
              {r.market?.size?.[key] ? (
                <p className="text-sm font-semibold text-slate-900">{r.market.size[key]}</p>
              ) : (
                <p className="text-xs text-slate-400 italic">Insufficient public evidence to estimate this reliably.</p>
              )}
            </div>
          ))}
        </div>
        {r.market?.growth && (
          <p className="text-sm text-slate-600 mb-4"><span className="font-semibold text-slate-800">Growth:</span> {r.market.growth}</p>
        )}
        <div className="grid md:grid-cols-2 gap-5">
          {r.market?.trends?.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-emerald-700 mb-2">Tailwinds &amp; trends</div>
              <Bullets items={r.market.trends} />
            </div>
          )}
          {r.market?.headwinds?.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-amber-700 mb-2">Headwinds</div>
              <Bullets items={r.market.headwinds} />
            </div>
          )}
        </div>
        {r.market?.regulation && (
          <p className="text-sm text-slate-600 mt-4 pt-4 border-t border-slate-100"><span className="font-semibold text-slate-800">Regulation:</span> {r.market.regulation}</p>
        )}
      </Card>

      {/* 7. CUSTOMERS — three evidence classes kept visually separate. */}
      <Card title="Customers" hint="Web research, your own survey data, and AI inference are kept apart on purpose.">
        {r.customers?.summary && <p className="text-sm text-slate-600 mb-5">{r.customers.summary}</p>}

        {r.customers?.segments?.length > 0 && (
          <div className="space-y-3 mb-5">
            {r.customers.segments.map((s: any, i: number) => (
              <div key={i} className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="font-semibold text-slate-900 text-sm">{s.name}</span>
                  <StatusBadge tone={LEVEL_TONE[s.intensity] || 'neutral'}>{s.intensity} pain</StatusBadge>
                </div>
                {s.painPoints?.length > 0 && (
                  <div className="mb-2">
                    <div className="text-xs font-semibold text-slate-600 mb-1">Pain points</div>
                    <Bullets items={s.painPoints} />
                  </div>
                )}
                {s.jobsToBeDone?.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-slate-600 mb-1">Jobs to be done</div>
                    <Bullets items={s.jobsToBeDone} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <div className="text-xs font-semibold text-slate-700 mb-2">From web research</div>
            {r.customers?.webEvidence?.length > 0
              ? <Bullets items={r.customers.webEvidence} />
              : <p className="text-xs text-slate-400 italic">No external customer evidence was found.</p>}
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-xs font-semibold text-blue-800 mb-2">From your survey data</div>
            {r.customers?.surveyEvidence
              ? <p className="text-sm text-slate-700 whitespace-pre-line">{r.customers.surveyEvidence}</p>
              : <p className="text-xs text-slate-500 italic">No customer survey responses collected yet.</p>}
          </div>
          <div className="bg-violet-50 border border-violet-200 rounded-lg p-4">
            <div className="text-xs font-semibold text-violet-800 mb-2">AI inference</div>
            {r.customers?.inferences?.length > 0
              ? <Bullets items={r.customers.inferences} />
              : <p className="text-xs text-slate-500 italic">No inferences drawn.</p>}
          </div>
        </div>

        {r.customers?.currentAlternatives?.length > 0 && (
          <div className="mt-5 pt-5 border-t border-slate-100">
            <div className="text-xs font-semibold text-slate-700 mb-2">What they use today</div>
            <Chips items={r.customers.currentAlternatives} />
          </div>
        )}
        {r.customers?.buyingBehavior && (
          <p className="text-sm text-slate-600 mt-4"><span className="font-semibold text-slate-800">Buying behaviour:</span> {r.customers.buyingBehavior}</p>
        )}
      </Card>

      {/* 8. SWOT */}
      {(r.swot?.strengths?.length || r.swot?.weaknesses?.length || r.swot?.opportunities?.length || r.swot?.threats?.length) > 0 && (
        <Card title="SWOT">
          <div className="grid sm:grid-cols-2 gap-4">
            {([
              { key: 'strengths', label: 'Strengths', cls: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-800' },
              { key: 'weaknesses', label: 'Weaknesses', cls: 'bg-red-50 border-red-200', text: 'text-red-800' },
              { key: 'opportunities', label: 'Opportunities', cls: 'bg-blue-50 border-blue-200', text: 'text-blue-800' },
              { key: 'threats', label: 'Threats', cls: 'bg-amber-50 border-amber-200', text: 'text-amber-800' },
            ] as const).map(q => (
              <div key={q.key} className={`border rounded-lg p-4 ${q.cls}`}>
                <div className={`text-xs font-semibold mb-2 ${q.text}`}>{q.label}</div>
                {r.swot?.[q.key]?.length > 0
                  ? <Bullets items={r.swot[q.key]} tone="text-slate-700" />
                  : <p className="text-xs text-slate-500 italic">None identified.</p>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 9. RISK REGISTER */}
      {r.risks?.length > 0 && (
        <Card title="Risk register" hint="Each risk carries what would still need checking before it can be ruled out.">
          <div className="space-y-4">
            {r.risks.map((risk: any, i: number) => (
              <div key={i} className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                  <p className="font-medium text-slate-900 text-sm flex-1 min-w-[12rem]">{risk.risk}</p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <StatusBadge tone="neutral">{risk.category}</StatusBadge>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TONE_DOM[riskTone(risk.likelihood)].chip}`}>{risk.likelihood} likelihood</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TONE_DOM[riskTone(risk.impact)].chip}`}>{risk.impact} impact</span>
                  </div>
                </div>
                {risk.whyItMatters && <p className="text-sm text-slate-600 mb-2">{risk.whyItMatters}</p>}
                {risk.mitigation && <p className="text-sm text-slate-600"><span className="font-semibold text-slate-800">Mitigation:</span> {risk.mitigation}</p>}
                {risk.missingEvidence && (
                  <p className="text-xs text-amber-700 mt-2 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                    Still unverified: {risk.missingEvidence}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 10. BUSINESS MODEL */}
      <Card title="Business model &amp; pricing">
        {r.businessModel?.revenueModelFit && <p className="text-sm text-slate-600 mb-3">{r.businessModel.revenueModelFit}</p>}
        {r.businessModel?.pricingLogic && (
          <p className="text-sm text-slate-600 mb-4"><span className="font-semibold text-slate-800">Pricing logic:</span> {r.businessModel.pricingLogic}</p>
        )}
        <div className="grid md:grid-cols-3 gap-5">
          {r.businessModel?.costDrivers?.length > 0 && (
            <div><div className="text-xs font-semibold text-slate-700 mb-2">Cost drivers</div><Bullets items={r.businessModel.costDrivers} /></div>
          )}
          {r.businessModel?.monetizationRisks?.length > 0 && (
            <div><div className="text-xs font-semibold text-amber-700 mb-2">Monetization risks</div><Bullets items={r.businessModel.monetizationRisks} /></div>
          )}
          {r.businessModel?.keyAssumptions?.length > 0 && (
            <div><div className="text-xs font-semibold text-slate-700 mb-2">Must be true</div><Bullets items={r.businessModel.keyAssumptions} /></div>
          )}
        </div>
      </Card>

      {/* 11. GTM */}
      <Card title="Go-to-market">
        {r.gtm?.initialCustomer && (
          <p className="text-sm text-slate-600 mb-4"><span className="font-semibold text-slate-800">Start with:</span> {r.gtm.initialCustomer}</p>
        )}
        <div className="grid md:grid-cols-2 gap-5">
          {r.gtm?.channels?.length > 0 && (
            <div><div className="text-xs font-semibold text-slate-700 mb-2">Channels</div><Chips items={r.gtm.channels} /></div>
          )}
          {r.gtm?.adoptionBarriers?.length > 0 && (
            <div><div className="text-xs font-semibold text-amber-700 mb-2">Adoption barriers</div><Bullets items={r.gtm.adoptionBarriers} /></div>
          )}
        </div>
        {r.gtm?.earlyExperiment && (
          <p className="text-sm text-slate-600 mt-4 pt-4 border-t border-slate-100">
            <span className="font-semibold text-slate-800">First experiment:</span> {r.gtm.earlyExperiment}
          </p>
        )}
      </Card>

      {/* 12. EXPERIMENTS — survey-testable ones link into the existing generator. */}
      {r.experiments?.length > 0 && (
        <Card title="What to test next" hint="Ordered by how much the answer would change your decision.">
          <div className="space-y-4">
            {r.experiments.map((e: any, i: number) => (
              <div key={i} className="border border-slate-200 rounded-lg p-4">
                <p className="font-semibold text-slate-900 text-sm mb-2">{i + 1}. {e.title}</p>
                <div className="space-y-1.5 text-sm text-slate-600">
                  {e.hypothesis && <p><span className="font-medium text-slate-800">Hypothesis:</span> {e.hypothesis}</p>}
                  {e.whatToTest && <p><span className="font-medium text-slate-800">Test:</span> {e.whatToTest}</p>}
                  {e.targetUsers && <p><span className="font-medium text-slate-800">With:</span> {e.targetUsers}</p>}
                  {e.successMetric && <p><span className="font-medium text-slate-800">Success looks like:</span> {e.successMetric}{e.sampleThreshold ? ` (${e.sampleThreshold})` : ''}</p>}
                  {e.decisionInformed && <p className="text-xs text-slate-500 pt-1">Informs: {e.decisionInformed}</p>}
                </div>
                {e.gapKey && !isPublic && !viewMode && ideaId && (
                  <Link
                    href={`/founder/surveys/generate?ideaId=${ideaId}&gap=${e.gapKey}`}
                    className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold text-blue-700 hover:text-blue-800"
                  >
                    <span>⚡</span> Build this survey with AI
                  </Link>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 13. AI vs EXPERT */}
      <Card
        title="AI research vs expert judgement"
        hint="Two independent reads on the same rubric. The point is where they agree, where they don't, and what that means you should look into."
      >
        {r.aiVsExpert ? (
          <>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-5">
              <p className="text-sm text-slate-700">{r.aiVsExpert.headline}</p>
              <p className="text-xs text-slate-500 mt-2 tabular-nums">
                AI overall {r.aiVsExpert.aiOverall.toFixed(0)}/100 · Experts {r.aiVsExpert.expertOverall.toFixed(0)}/100
                {' '}· {r.aiVsExpert.expertValidations} expert review{r.aiVsExpert.expertValidations === 1 ? '' : 's'}
              </p>
            </div>
            <div className="space-y-4">
              {r.aiVsExpert.dimensions.map((d: any) => (
                <div key={d.key}>
                  <div className="flex justify-between items-baseline mb-1.5 gap-2">
                    <span className="text-sm text-slate-700">{d.label}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      {d.agreement && <StatusBadge tone={AGREEMENT_TONE[d.agreement]}>{d.agreement} agreement</StatusBadge>}
                      {d.delta !== null && (
                        <span className="text-xs font-semibold text-slate-500 tabular-nums">
                          {d.delta > 0 ? '+' : ''}{d.delta.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-violet-600 w-10 shrink-0">AI</span>
                      <div className="flex-1 bg-slate-100 rounded-full h-2">
                        <div className="h-2 rounded-full bg-violet-500" style={{ width: `${Math.min((d.ai / 50) * 100, 100)}%` }} />
                      </div>
                      <span className="text-xs text-slate-600 tabular-nums w-12 text-right shrink-0">{d.ai.toFixed(1)}/50</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-blue-600 w-10 shrink-0">Experts</span>
                      <div className="flex-1 bg-slate-100 rounded-full h-2">
                        <div className="h-2 rounded-full bg-blue-600" style={{ width: `${d.expert !== null ? Math.min((d.expert / 50) * 100, 100) : 0}%` }} />
                      </div>
                      <span className="text-xs text-slate-600 tabular-nums w-12 text-right shrink-0">
                        {d.expert !== null ? `${d.expert.toFixed(1)}/50` : '—'}
                      </span>
                    </div>
                  </div>
                  {r.scores?.rationale?.[d.key] && <p className="text-[11px] text-slate-400 mt-1.5">AI: {r.scores.rationale[d.key]}</p>}
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-500 mb-5">
              No expert reviews have been submitted yet, so there is nothing to compare against. These are the AI&apos;s
              independent scores on the same rubric your expert validators use.
            </p>
            <div className="space-y-4">
              {Object.entries(r.scores?.dimensions || {}).map(([key, value]) => {
                const score = value as number;
                const st = breakdownStatus((score / 50) * 100);
                return (
                  <div key={key}>
                    <div className="flex justify-between items-baseline mb-1.5 gap-2">
                      <span className="text-sm text-slate-700">{key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase())}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TONE_DOM[st.tone].chip}`}>{st.label}</span>
                        <span className="text-sm font-semibold text-slate-900 tabular-nums">{score.toFixed(1)}/50</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                      <div className="h-2 rounded-full bg-violet-500" style={{ width: `${Math.min((score / 50) * 100, 100)}%` }} />
                    </div>
                    {r.scores?.rationale?.[key] && <p className="text-[11px] text-slate-400 mt-1.5">{r.scores.rationale[key]}</p>}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      {/* 14. SOURCES */}
      {r.sources?.length > 0 && (
        <Card title="Sources" hint="Every external claim in this report traces back to one of these.">
          <ol className="space-y-2.5">
            {r.sources.map((s: any, i: number) => (
              <li key={i} className="text-sm flex gap-2">
                <span className="text-slate-400 tabular-nums shrink-0">{i + 1}.</span>
                <div>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline font-medium">{s.title}</a>
                  <span className="text-xs text-slate-400 ml-2">{s.usedFor}</span>
                  {s.finding && <p className="text-xs text-slate-500 mt-0.5">{s.finding}</p>}
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {/* 15. LIMITATIONS */}
      {r.limitations?.length > 0 && (
        <Card title="Limitations of this run" hint="What this research could not cover, stated plainly.">
          <Bullets items={r.limitations} />
        </Card>
      )}

      {/* 16. WHAT WE COULD NOT VERIFY */}
      {r.couldNotVerify?.length > 0 && (
        <div className="bg-slate-50 border-2 border-slate-300 rounded-xl p-6 mb-6">
          <h3 className="font-semibold text-slate-900 mb-1">What we could not verify</h3>
          <p className="text-xs text-slate-500 mb-4">
            These gaps were left as gaps on purpose. An unknown you can go and test is worth more than a confident guess.
          </p>
          <div className="space-y-2.5">
            {r.couldNotVerify.map((item: any, i: number) => (
              <div key={i} className="bg-white border border-slate-200 rounded-lg p-3 flex items-start gap-3">
                <StatusBadge tone={item.kind === 'UNKNOWN' ? 'warning' : 'neutral'}>
                  {item.kind === 'UNKNOWN' ? 'Unknown' : 'Unverified'}
                </StatusBadge>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">{item.item}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{item.note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400 text-center mb-4">
        AI research is one evidence layer — expert judgement and real customer responses are the other two. Generated{' '}
        {r.generatedAt ? new Date(r.generatedAt).toLocaleString() : 'recently'}
        {r.searchCount > 0 && ` · ${r.searchCount} web searches`}
      </p>
    </>
  );
}

'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { GapFinding, GapConfidence } from '@/lib/validationGap';

const CONF_STYLE: Record<GapConfidence, { dot: string; text: string; label: string }> = {
  HIGH: { dot: 'bg-emerald-500', text: 'text-emerald-700', label: 'Strong evidence' },
  MEDIUM: { dot: 'bg-blue-500', text: 'text-blue-700', label: 'Decent evidence' },
  LOW: { dot: 'bg-amber-500', text: 'text-amber-700', label: 'Weak evidence' },
  INSUFFICIENT: { dot: 'bg-slate-400', text: 'text-slate-500', label: 'Not enough evidence yet' },
};

const TONE_STYLE = {
  gap: { border: 'border-rose-200', chip: 'bg-rose-100 text-rose-700', icon: '🔥', chipLabel: "THE BIGGEST THING YOU HAVEN'T PROVEN" },
  info: { border: 'border-blue-200', chip: 'bg-blue-100 text-blue-700', icon: 'ℹ', chipLabel: 'STILL TO PROVE' },
  ok: { border: 'border-emerald-200', chip: 'bg-emerald-100 text-emerald-700', icon: '✓', chipLabel: 'EVIDENCE CHECK' },
} as const;

const SOURCE_STYLE: Record<string, string> = {
  'Survey respondents': 'bg-blue-50 text-blue-700',
  'Expert validators': 'bg-emerald-50 text-emerald-700',
  Derived: 'bg-slate-100 text-slate-600',
};

/**
 * "Your score tells you how validated your idea is. This card tells you what
 * you still need to prove." Pure presentation — every number arrives already
 * computed by detectValidationGap from real dashboard data.
 */
export default function ValidationGapCard({ finding, ideaId }: { finding: GapFinding; ideaId?: string }) {
  const [showWhy, setShowWhy] = useState(false);
  const tone = TONE_STYLE[finding.tone];
  const conf = CONF_STYLE[finding.confidence];
  // Gap-to-Survey: when the recommended next step is a survey and we know the
  // idea, offer to build that survey with AI in one click.
  const canGenerate = !!ideaId && !!finding.nextStepHref?.startsWith('/founder/surveys/generate');

  return (
    <div className={`bg-white border ${tone.border} shadow-sm rounded-xl p-6 mb-6`}>
      <div className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full mb-3 ${tone.chip}`}>
        <span>{tone.icon}</span>{tone.chipLabel}
      </div>

      <h3 className="text-xl font-bold text-slate-900 mb-2">{finding.title}</h3>
      <p className="text-sm text-slate-700 leading-relaxed">{finding.headline}</p>
      {finding.detail && <p className="text-sm text-slate-500 leading-relaxed mt-1.5">{finding.detail}</p>}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-4 pt-4 border-t border-slate-100">
        <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">How sure we are</p>
          <p className={`text-sm font-semibold flex items-center gap-1.5 ${conf.text}`}>
            <span className={`w-2 h-2 rounded-full ${conf.dot}`} />{conf.label}
          </p>
          <p className="text-[11px] text-slate-400">{finding.confidenceNote}</p>
        </div>
        <div className="flex-1 min-w-[200px]">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">What to do next</p>
          <p className="text-sm text-slate-800">
            → {finding.nextStep}
            {finding.nextStepHref && !canGenerate && (
              <Link href={finding.nextStepHref} className="ml-2 text-blue-600 hover:text-blue-700 font-semibold whitespace-nowrap">
                Start →
              </Link>
            )}
          </p>
          {canGenerate && (
            <Link
              href={`/founder/surveys/generate?ideaId=${ideaId}&gap=${encodeURIComponent(finding.key)}`}
              className="inline-flex items-center gap-1.5 mt-2 bg-blue-600 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 transition"
            >
              ⚡ Generate this survey with AI
            </Link>
          )}
        </div>
      </div>

      <button onClick={() => setShowWhy((v) => !v)} className="mt-4 text-xs text-blue-600 hover:underline font-medium">
        {showWhy ? 'Hide evidence ▲' : `Why ${finding.tone === 'gap' ? `“${finding.title}”` : 'this result'}? Show evidence ▼`}
      </button>

      {showWhy && (
        <div className="mt-3 border border-slate-200 rounded-lg divide-y divide-slate-100">
          {finding.evidence.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="text-sm text-slate-600">{row.label}</span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-semibold text-slate-900 tabular-nums">{row.value}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${SOURCE_STYLE[row.source] || SOURCE_STYLE.Derived}`}>
                  {row.source}
                </span>
              </span>
            </div>
          ))}
          <p className="px-4 py-2 text-[11px] text-slate-400">
            All figures come directly from your validation and survey data — nothing is estimated.
          </p>
        </div>
      )}
    </div>
  );
}

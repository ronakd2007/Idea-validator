'use client';
import { useState } from 'react';

// The 7 categories that actually make up the overall score, in the exact
// order aggregateScores averages them. Investor Attractiveness is scored but
// deliberately NOT part of the overall average — shown separately and labeled.
const INCLUDED: { key: string; label: string }[] = [
  { key: 'marketOpportunityAvg', label: 'Market Opportunity' },
  { key: 'feasibilityAvg', label: 'Feasibility' },
  { key: 'founderFitAvg', label: 'Founder Fit' },
  { key: 'revenuePotentialAvg', label: 'Revenue Potential' },
  { key: 'scalabilityAvg', label: 'Scalability' },
  { key: 'innovationAvg', label: 'Innovation' },
  { key: 'socialImpactAvg', label: 'Social Impact' },
];

function barColor(pct: number) {
  if (pct >= 70) return 'bg-emerald-500';
  if (pct >= 40) return 'bg-blue-500';
  return 'bg-amber-500';
}

/**
 * "Why this score?" — the transparent breakdown of the overall score using the
 * existing category averages (each /50, normalized to /100 here), plus a plain
 * statement of the formula and where the evidence comes from.
 */
export default function ScoreBreakdown({ aggregated }: { aggregated: any }) {
  const [open, setOpen] = useState(false);
  const a = aggregated || {};
  const overall = Math.round(a.overallScore || 0);

  const rows = INCLUDED.map((c) => ({ label: c.label, pct: Math.round(((a[c.key] || 0) / 50) * 100) }));
  const investor = Math.round(((a.investorAttractivenessAvg || 0) / 50) * 100);

  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-xl mb-8">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between px-6 py-4 text-left">
        <div>
          <h3 className="font-semibold text-slate-900">Why {overall}/100?</h3>
          <p className="text-xs text-slate-500 mt-0.5">See exactly how your overall score is calculated</p>
        </div>
        <span className="text-slate-400 text-sm">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-6 pb-6 border-t border-slate-100 pt-5">
          <div className="grid sm:grid-cols-2 gap-x-10 gap-y-4 mb-5">
            {rows.map((r) => (
              <div key={r.label}>
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-sm text-slate-700">{r.label}</span>
                  <span className="text-sm font-semibold text-slate-900 tabular-nums">{r.pct}/100</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2">
                  <div className={`h-2 rounded-full ${barColor(r.pct)}`} style={{ width: `${Math.min(r.pct, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-slate-500 mb-4">
            Your overall score is the simple average of these {rows.length} categories — no hidden weighting.
            Each category is the average of what every expert scored it, out of 50, shown here out of 100.
          </p>

          {investor > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-700">Investor Attractiveness</p>
                <p className="text-[11px] text-slate-400">Scored separately — not part of the overall average</p>
              </div>
              <span className="text-sm font-semibold text-slate-900 tabular-nums shrink-0">{investor}/100</span>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
            <p className="text-xs text-blue-900 font-medium mb-1">Validation is evidence, not a guarantee of success.</p>
            <p className="text-xs text-blue-800/80">
              This score reflects {a.totalValidations || 0} independent expert evaluation{a.totalValidations !== 1 ? 's' : ''}
              {a.customerValidation ? ', their customer-perspective answers,' : ''} and their risk assessments.
              It tells you how strong the evidence looks today — the market has the final word.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

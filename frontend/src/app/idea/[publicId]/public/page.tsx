'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

/**
 * The public validation card — a certificate-style, read-only page anyone with
 * the link can open. Every field here was explicitly enabled by the founder;
 * the API returns nothing for disabled sections, so this page can't leak them.
 */
export default function PublicIdeaPage() {
  const params = useParams();
  const publicId = params.publicId as string;
  const [data, setData] = useState<any>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'not_found'>('loading');

  useEffect(() => {
    api.getPublicIdea(publicId)
      .then((d) => { setData(d); setState('ready'); })
      .catch(() => setState('not_found'));
  }, [publicId]);

  if (state === 'loading') {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading validation…</div>;
  }
  if (state === 'not_found' || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-xl font-semibold text-slate-800">This validation page is not available</h1>
          <p className="text-slate-500 mt-2 text-sm">The founder may have disabled sharing, or the link is incorrect.</p>
          <Link href="/" className="inline-block mt-6 text-sm text-blue-600 hover:underline">Go to IdeaValidator →</Link>
        </div>
      </div>
    );
  }

  const scores = data.scores;
  const counts = data.counts;
  const isValidated = data.status === 'VALIDATED';

  const riskChip =
    scores?.riskLevel === 'LOW' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : scores?.riskLevel === 'MEDIUM' ? 'bg-amber-50 text-amber-700 border-amber-200'
    : scores?.riskLevel === 'HIGH' ? 'bg-red-50 text-red-600 border-red-200'
    : 'bg-slate-50 text-slate-500 border-slate-200';

  const recTone = data.recommendation.startsWith('CONTINUE')
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : data.recommendation.startsWith('IMPROVE')
    ? 'bg-blue-50 text-blue-700 border-blue-200'
    : data.recommendation.startsWith('HIGH RISK')
    ? 'bg-red-50 text-red-600 border-red-200'
    : 'bg-slate-50 text-slate-600 border-slate-200';

  return (
    <div className="min-h-screen bg-[#f8fafc] py-10 px-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="text-center px-6 pt-8 pb-6 border-b border-slate-100">
            <p className="text-[11px] font-semibold text-slate-400 tracking-[0.2em] uppercase">Idea Validation</p>
            <span className={`inline-flex items-center gap-1.5 mt-2 text-[11px] font-bold px-3 py-1 rounded-full ${isValidated ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}`}>
              {isValidated ? '✓ VALIDATED' : '⏳ VALIDATION IN PROGRESS'}
            </span>
            <h1 className="text-2xl font-bold text-slate-900 mt-4">{data.title}</h1>
            <p className="text-xs text-slate-400 mt-1">
              {data.industryCategory} · {String(data.stage || '').replace('_', ' ')}{data.version > 1 ? ` · Version ${data.version}` : ''}
            </p>

            {scores && (
              <div className="mt-6">
                <p className="text-xs text-slate-500 mb-1">Validation Score</p>
                <p className="text-5xl font-black text-slate-900 tabular-nums">
                  {scores.overall}<span className="text-xl font-semibold text-slate-300">/100</span>
                </p>
                {data.benchmark?.percentile != null && (
                  <p className="mt-2 inline-block text-[11px] font-semibold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full">
                    Scores higher than {data.benchmark.percentile}% of ideas validated on this platform
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Evidence row */}
          {scores && (
            <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100 text-center">
              <div className="px-2 py-5">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Expert Validation</p>
                <p className="text-xl font-bold text-slate-900 tabular-nums">{scores.expert}<span className="text-xs text-slate-400">/100</span></p>
                {counts && <p className="text-[11px] text-slate-400 mt-0.5">{counts.validators} validator{counts.validators !== 1 ? 's' : ''}</p>}
              </div>
              <div className="px-2 py-5">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Customer Validation</p>
                {scores.customerPositivePct != null ? (
                  <>
                    <p className="text-xl font-bold text-slate-900 tabular-nums">{scores.customerPositivePct}%</p>
                    {counts && <p className="text-[11px] text-slate-400 mt-0.5">{counts.responses} response{counts.responses !== 1 ? 's' : ''}</p>}
                  </>
                ) : (
                  <p className="text-sm text-slate-400 mt-1.5">Not tested yet</p>
                )}
              </div>
              <div className="px-2 py-5">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Risk Level</p>
                {scores.riskLevel ? (
                  <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full border mt-1 ${riskChip}`}>{scores.riskLevel}</span>
                ) : (
                  <p className="text-sm text-slate-400 mt-1.5">—</p>
                )}
              </div>
            </div>
          )}

          <div className="px-6 py-6 space-y-6">
            {/* Problem / solution — only present if the founder enabled them */}
            {data.problem && (
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2 text-center">The Problem</p>
                <p className="text-sm text-slate-700 leading-relaxed">{data.problem}</p>
              </div>
            )}
            {data.solution && (
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2 text-center">The Solution</p>
                <p className="text-sm text-slate-700 leading-relaxed">{data.solution}</p>
              </div>
            )}

            {data.strengths && data.strengths.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2 text-center">Key Strengths</p>
                <ul className="space-y-1.5">
                  {data.strengths.map((s: string) => (
                    <li key={s} className="flex items-start gap-2 text-sm text-slate-700 justify-center">
                      <span className="text-emerald-500 font-bold shrink-0">✓</span>{s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.risks && data.risks.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2 text-center">Key Risks</p>
                <ul className="space-y-1.5">
                  {data.risks.map((r: string) => (
                    <li key={r} className="flex items-start gap-2 text-sm text-slate-700 justify-center">
                      <span className="text-amber-500 font-bold shrink-0">!</span>{r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.aiInsight && (
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2 text-center">AI Insight</p>
                <p className="text-sm text-slate-600 leading-relaxed italic text-center">&ldquo;{data.aiInsight}&rdquo;</p>
              </div>
            )}

            <div className="text-center">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Recommended Next Step</p>
              <span className={`inline-block text-sm font-bold px-4 py-2 rounded-lg border ${recTone}`}>{data.recommendation}</span>
            </div>
          </div>

          {/* Evidence provenance + footer */}
          <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 text-center">
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Based on {counts ? `${counts.validators} independent expert evaluation${counts.validators !== 1 ? 's' : ''}` : 'independent expert evaluations'}
              {counts && counts.responses > 0 ? ` and ${counts.responses} public survey response${counts.responses !== 1 ? 's' : ''}` : ''}.
              Validation is evidence, not a guarantee of success.
            </p>
          </div>
        </div>

        <div className="text-center mt-6">
          <p className="text-xs text-slate-400 mb-2">Powered by <span className="font-semibold text-slate-500">IdeaValidator</span></p>
          <Link href="/auth/register/founder" className="inline-block text-sm bg-blue-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-blue-700">
            Validate your own idea →
          </Link>
        </div>
      </div>
    </div>
  );
}

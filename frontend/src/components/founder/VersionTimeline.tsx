'use client';
import Link from 'next/link';

export interface IdeaVersion {
  id: string;
  version: number;
  title: string;
  createdAt: string;
  paymentStatus: string;
  totalValidations: number;
  overallScore: number | null;
  isCurrent: boolean;
}

/**
 * "Your idea is improving based on validation" — the revision family with each
 * version's score, oldest first. Only rendered when more than one version
 * exists; the Improve CTA lives on the dashboard either way.
 */
export default function VersionTimeline({ versions }: { versions: IdeaVersion[] }) {
  if (versions.length < 2) return null;

  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 mb-8">
      <h3 className="font-semibold text-slate-900 mb-1">Validation History</h3>
      <p className="text-xs text-slate-500 mb-5">How this idea&apos;s score has moved across versions.</p>
      <ol className="space-y-1">
        {versions.map((v, i) => {
          const prev = i > 0 ? versions[i - 1] : null;
          const delta = prev?.overallScore != null && v.overallScore != null ? v.overallScore - prev.overallScore : null;
          return (
            <li key={v.id}>
              {i > 0 && <div className="ml-4 h-4 border-l-2 border-slate-200" />}
              <Link
                href={`/founder/ideas/${v.id}/dashboard`}
                className={`flex items-center justify-between gap-3 border rounded-lg px-4 py-3 ${
                  v.isCurrent ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">
                    Version {v.version}
                    {v.isCurrent && <span className="ml-2 text-[10px] font-semibold bg-blue-600 text-white px-1.5 py-0.5 rounded-full align-middle">CURRENT</span>}
                  </p>
                  <p className="text-xs text-slate-400">
                    {new Date(v.createdAt).toLocaleDateString()} · {v.totalValidations} validation{v.totalValidations !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {v.overallScore != null ? (
                    <>
                      <span className="text-lg font-bold text-slate-900 tabular-nums">{v.overallScore}</span>
                      <span className="text-xs text-slate-400">/100</span>
                      {delta != null && delta !== 0 && (
                        <span className={`block text-[11px] font-semibold ${delta > 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {delta > 0 ? '▲' : '▼'} {Math.abs(delta)} vs v{prev!.version}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-slate-400">{v.paymentStatus === 'COMPLETED' ? 'Awaiting validation' : 'Draft — unpaid'}</span>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

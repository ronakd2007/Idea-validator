'use client';
import { FRAMEWORKS } from '@/lib/frameworks';

interface Props {
  currentStepIndex: number;
  scores: Record<string, number | null>;
  overallAveragePct: number;
  completedCount: number;
}

function statusFor(stepIndex: number, currentStepIndex: number): 'done' | 'current' | 'pending' {
  if (stepIndex < currentStepIndex) return 'done';
  if (stepIndex === currentStepIndex) return 'current';
  return 'pending';
}

export default function FrameworkOverviewPanel({ currentStepIndex, scores, overallAveragePct, completedCount }: Props) {
  return (
    <div className="w-full lg:w-72 shrink-0 space-y-4">
      {/* Overall score */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-5">
        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase mb-3">Overall Validation Score</p>
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-16 shrink-0">
            <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="3"
              />
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="#2563eb"
                strokeWidth="3"
                strokeDasharray={`${overallAveragePct}, 100`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-slate-900">
              {Math.round(overallAveragePct)}%
            </div>
          </div>
          <div>
            <p className="text-lg font-bold text-slate-900">{(overallAveragePct / 10).toFixed(1)} / 10</p>
            <p className="text-xs text-slate-500">Based on {completedCount} completed framework{completedCount !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      {/* Framework list */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-5">
        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase mb-3">12 Validation Frameworks</p>
        <ul className="space-y-1">
          {FRAMEWORKS.map((fw, i) => {
            const status = statusFor(fw.stepIndex, currentStepIndex);
            const score = scores[fw.name];
            return (
              <li
                key={fw.name}
                className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-sm ${
                  status === 'current' ? 'bg-blue-50' : ''
                }`}
              >
                <span className={`flex items-center gap-2 ${status === 'pending' ? 'text-slate-400' : 'text-slate-800'}`}>
                  <span className="text-xs tabular-nums text-slate-400 w-5">{String(i + 1).padStart(2, '0')}</span>
                  {fw.name}
                </span>
                {fw.maxScore != null ? (
                  <span className={`text-xs font-semibold tabular-nums ${status === 'pending' ? 'text-slate-300' : 'text-slate-600'}`}>
                    {score != null ? `${score.toFixed(0)} / ${fw.maxScore}` : `-- / ${fw.maxScore}`}
                  </span>
                ) : (
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      status === 'done'
                        ? 'bg-emerald-50 text-emerald-700'
                        : status === 'current'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {status === 'done' ? 'Reviewed' : status === 'current' ? 'In progress' : 'Pending'}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Score guide */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-5">
        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase mb-3">Score Guide</p>
        <ul className="space-y-2 text-xs">
          <li className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-slate-600"><span className="w-2 h-2 rounded-full bg-emerald-500" />8–10</span>
            <span className="text-slate-500">Strong / Excellent</span>
          </li>
          <li className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-slate-600"><span className="w-2 h-2 rounded-full bg-blue-500" />5–7</span>
            <span className="text-slate-500">Average / Moderate</span>
          </li>
          <li className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-slate-600"><span className="w-2 h-2 rounded-full bg-amber-500" />3–4</span>
            <span className="text-slate-500">Weak / Needs Attention</span>
          </li>
          <li className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-slate-600"><span className="w-2 h-2 rounded-full bg-red-500" />1–2</span>
            <span className="text-slate-500">Very Weak / Critical</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

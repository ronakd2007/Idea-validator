'use client';
import { useScrollProgress } from '@/components/landing/useScrollProgress';
import { windowActivation, clamp, easeInOutCubic, lerp } from '@/components/landing/utils';
import { VERDICT_RANGE, SCORECARD_ROWS, SCORECARD_VERDICT, TEXT_FADE } from './validatorSceneConfig';

/**
 * The verdict act's DOM layer: a scorecard filling itself in as the facet
 * chips stack up in 3D beside it. Sliders stagger in, the verdict counts up,
 * and the one weak row stays amber — honest scrutiny, not a highlight reel.
 */
export default function ScorecardPanel() {
  const progress = useScrollProgress();
  const activation = windowActivation(progress, VERDICT_RANGE, TEXT_FADE, TEXT_FADE);
  if (activation <= 0.01) return null;

  const [start, end] = VERDICT_RANGE;
  const local = clamp((progress - start) / (end - start));
  const verdict = Math.round(lerp(0, SCORECARD_VERDICT, easeInOutCubic(clamp(local * 1.6))));

  return (
    <div
      className="fixed inset-0 flex items-center justify-end px-6 md:pr-16 pointer-events-none"
      style={{ opacity: activation, zIndex: 20 }}
    >
      <div className="w-full max-w-md" style={{ transform: `translateY(${lerp(16, 0, activation)}px)` }}>
        <h2 className="text-3xl md:text-5xl font-semibold text-slate-900 tracking-tight leading-tight mb-3 text-right">
          Your scores become
          <span className="block">their roadmap.</span>
        </h2>
        <p className="text-base text-slate-600 mb-6 text-right">
          Every dimension you score flows into the founder&apos;s validation report — with your written reasoning beside it.
        </p>

        <div className="bg-white/85 backdrop-blur-md border border-slate-200 rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] font-semibold tracking-[0.2em] text-slate-400">YOUR SCORECARD</p>
            <p className="text-[11px] text-slate-400">1 of 12 validators</p>
          </div>
          <div className="space-y-3.5">
            {SCORECARD_ROWS.map((row, i) => {
              // each slider begins after the previous one is underway
              const rowT = easeInOutCubic(clamp(local * 2.2 - i * 0.18));
              const width = (row.score / 10) * 100 * rowT;
              return (
                <div key={row.name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-700">{row.name}</span>
                    <span className={`tabular-nums font-semibold ${row.weak ? 'text-amber-600' : 'text-slate-900'}`}>
                      {Math.round(row.score * rowT)}/10
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${row.weak ? 'bg-amber-500' : 'bg-blue-600'}`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-sm text-slate-500">Weighted verdict</span>
            <span className="text-2xl font-bold text-blue-600 tabular-nums">{verdict}</span>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-3 text-right">
          Combined with the other validators into one weighted report.
        </p>
      </div>
    </div>
  );
}

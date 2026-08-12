'use client';
import { useScrollProgress } from './useScrollProgress';
import { SCORE_RANGE, FINAL_SCORE, FRAMEWORKS } from './sceneConfig';
import { clamp, lerp, windowActivation } from './utils';

const BREAKDOWN = ['Market Opportunity', 'Innovation', 'Feasibility', 'Revenue Potential', 'Risk Assessment'];

function scoreFor(name: string) {
  const fw = FRAMEWORKS.find((f) => f.name === name)!;
  return fw.improvedScore ?? fw.score;
}

/**
 * The score is the payoff of everything before it (frameworks converging
 * into the bulb — handled in OrbitNodes) — this component only owns the
 * DOM readout: the number itself climbs with scroll, it never just appears.
 */
export default function ScoreReveal() {
  const progress = useScrollProgress();
  const activation = windowActivation(progress, SCORE_RANGE, 0.02, 0.02);
  if (activation <= 0.001) return null;

  const [start, end] = SCORE_RANGE;
  const raw = clamp((progress - start) / (end - start));
  const shown = Math.round(lerp(0, FINAL_SCORE, raw));
  const breakdownOpacity = clamp((raw - 0.5) / 0.4);

  return (
    <div className="fixed inset-0 flex items-center justify-center px-6 pointer-events-none" style={{ opacity: activation, zIndex: 20 }}>
      {/* the bulb converges directly behind this text at this point in the
          story — a frosted panel keeps the score readable without moving
          the bulb off-center, which is the point of this moment */}
      <div className="text-center bg-white/65 backdrop-blur-md rounded-3xl px-10 py-10 md:px-16 md:py-12">
        <p className="text-blue-600/90 text-xs font-semibold tracking-[0.3em] uppercase mb-6">04 — VALIDATION SCORE</p>
        <div
          className="text-8xl md:text-[10rem] font-semibold text-blue-700 leading-none tabular-nums"
          style={{ textShadow: '0 8px 30px rgba(37,99,235,0.18)' }}
        >
          {shown}
        </div>
        <p className="text-slate-500 text-sm mt-2 mb-10">out of 100</p>
        <p className="text-lg text-slate-600 max-w-md mx-auto">Strong potential — with opportunities to improve.</p>

        <div
          className="mt-12 flex flex-wrap justify-center gap-x-8 gap-y-3 max-w-2xl mx-auto"
          style={{ opacity: breakdownOpacity }}
        >
          {BREAKDOWN.map((name) => (
            <div key={name} className="text-left">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">{name}</div>
              <div className="text-xl font-semibold text-slate-900 tabular-nums">{scoreFor(name)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

'use client';
import { useScrollProgress } from './useScrollProgress';
import { INSIGHTS_RANGE } from './sceneConfig';
import { windowActivation, lerp } from './utils';

const STRENGTHS = ['Strong market opportunity', 'High innovation score', 'Clear customer problem'];
const WEAKNESSES = ['Revenue model needs work', 'Customer validation needs improvement'];
const RECOMMENDATIONS = ['Test pricing with real customers', 'Interview 20 target customers', 'Validate acquisition channels'];

function Column({ title, items, tone }: { title: string; items: string[]; tone: 'up' | 'down' | 'neutral' }) {
  const dot = tone === 'up' ? 'bg-emerald-500' : tone === 'down' ? 'bg-amber-500' : 'bg-blue-500';
  return (
    <div>
      <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-slate-500 mb-3">{title}</p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
            <span className={`mt-1.5 w-1 h-1 rounded-full shrink-0 ${dot}`} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Clean premium DOM panel — solid white card, subtle border, soft shadow.
 * Deliberately kept as real HTML (not 3D geometry) since this is the
 * readable payoff of the score, and legibility matters most here.
 */
export default function InsightDashboard() {
  const progress = useScrollProgress();
  const activation = windowActivation(progress, INSIGHTS_RANGE, 0.02, 0.02);
  if (activation <= 0.001) return null;

  const translateX = lerp(24, 0, activation);

  return (
    <div className="fixed inset-0 flex items-center justify-end px-6 md:px-16 pointer-events-none" style={{ opacity: activation, zIndex: 20 }}>
      <div
        className="relative w-full max-w-md p-8 rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/40"
        style={{ transform: `translateX(${translateX}px)` }}
      >
        <p className="text-blue-600/90 text-xs font-semibold tracking-[0.3em] uppercase mb-4">THE FULL PICTURE</p>
        <h3 className="text-2xl font-semibold text-slate-900 mb-8 leading-snug">
          Strengths, weaknesses,
          <br />
          and what to do next.
        </h3>

        <div className="grid grid-cols-1 gap-6">
          <Column title="Strengths" items={STRENGTHS} tone="up" />
          <Column title="Weaknesses" items={WEAKNESSES} tone="down" />
          <Column title="Recommendations" items={RECOMMENDATIONS} tone="neutral" />
        </div>
      </div>
    </div>
  );
}

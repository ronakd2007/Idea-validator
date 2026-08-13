'use client';

export interface ProgressStep {
  label: string;
  state: 'done' | 'active' | 'pending';
  detail?: string;
}

/**
 * The idea's position in the validation journey, derived entirely from data
 * already on the dashboard — no new backend state. Horizontal on desktop,
 * vertical list on phones.
 */
export default function ValidationProgress({ steps }: { steps: ProgressStep[] }) {
  return (
    <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-5 mb-8">
      {/* Desktop: horizontal track */}
      <ol className="hidden md:flex items-start">
        {steps.map((step, i) => (
          <li key={step.label} className="flex-1 flex flex-col items-center text-center relative">
            {i > 0 && (
              <div className={`absolute top-3.5 right-1/2 w-full h-0.5 ${steps[i - 1].state === 'done' ? 'bg-emerald-400' : 'bg-slate-200'}`} style={{ zIndex: 0 }} />
            )}
            <div
              className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                step.state === 'done'
                  ? 'bg-emerald-500 border-emerald-500 text-white'
                  : step.state === 'active'
                  ? 'bg-white border-blue-500 text-blue-600'
                  : 'bg-white border-slate-300 text-slate-400'
              }`}
            >
              {step.state === 'done' ? '✓' : i + 1}
            </div>
            <p className={`text-xs font-medium mt-2 ${step.state === 'pending' ? 'text-slate-400' : 'text-slate-800'}`}>{step.label}</p>
            {step.detail && <p className="text-[11px] text-slate-400 mt-0.5 px-1">{step.detail}</p>}
          </li>
        ))}
      </ol>

      {/* Mobile: vertical list */}
      <ol className="md:hidden space-y-3">
        {steps.map((step, i) => (
          <li key={step.label} className="flex items-start gap-3">
            <div
              className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold border-2 ${
                step.state === 'done'
                  ? 'bg-emerald-500 border-emerald-500 text-white'
                  : step.state === 'active'
                  ? 'bg-white border-blue-500 text-blue-600'
                  : 'bg-white border-slate-300 text-slate-400'
              }`}
            >
              {step.state === 'done' ? '✓' : i + 1}
            </div>
            <div>
              <p className={`text-sm font-medium ${step.state === 'pending' ? 'text-slate-400' : 'text-slate-800'}`}>{step.label}</p>
              {step.detail && <p className="text-xs text-slate-400">{step.detail}</p>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

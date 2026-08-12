'use client';
import { useScrollProgress } from './useScrollProgress';
import { FINAL_MOMENT_RANGE } from './sceneConfig';
import { windowActivation } from './utils';

/**
 * The closing beat: decision CTA has already faded, this is the quiet
 * brand moment — dark, the bulb fully lit behind it, minimal wordmark.
 */
export default function FinalMoment() {
  const progress = useScrollProgress();
  const activation = windowActivation(progress, FINAL_MOMENT_RANGE, 0.006, 0.006);
  if (activation <= 0.001) return null;

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ opacity: activation, zIndex: 25 }}>
      <div className="text-center bg-white/60 backdrop-blur-md rounded-3xl px-10 py-8">
        <p className="text-slate-500 text-sm mb-4 tracking-wide">Good ideas deserve to be tested.</p>
        <p className="text-slate-900 text-2xl md:text-3xl font-semibold tracking-[0.35em]">IDEAVALIDATOR</p>
      </div>
    </div>
  );
}

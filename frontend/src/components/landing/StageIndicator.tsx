'use client';
import { useScrollProgress } from './useScrollProgress';
import { STAGE_INDICATOR } from './sceneConfig';

/**
 * Minimal cinematic progress marker — a thin fill line + small label,
 * not a conventional website progress bar.
 */
export default function StageIndicator() {
  const progress = useScrollProgress();

  let label = STAGE_INDICATOR[0].label;
  for (const stage of STAGE_INDICATOR) {
    if (progress >= stage.t) label = stage.label;
  }

  return (
    <div className="fixed left-6 bottom-8 z-40 flex items-center gap-3 pointer-events-none select-none">
      <div className="relative w-px h-16 bg-slate-300 overflow-hidden">
        <div
          className="absolute bottom-0 left-0 w-px bg-blue-600"
          style={{ height: `${progress * 100}%` }}
        />
      </div>
      <span className="text-[10px] font-semibold tracking-[0.25em] text-slate-500 uppercase">{label}</span>
    </div>
  );
}

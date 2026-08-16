'use client';
import Link from 'next/link';
import { useScrollProgress } from './useScrollProgress';
import { STAGES, TEXT_FADE, type StageText } from './sceneConfig';
import { windowActivation, lerp } from './utils';
import WatchDemoButton from '@/components/WalkthroughModal';

const SIDE_CLASSES: Record<StageText['side'], string> = {
  center: 'items-center justify-center text-center left-0 right-0',
  // 46%, not 52% — the side columns used to run past the halfway line and meet
  // the bulb's node cluster coming the other way.
  // narrows again at xl, where HeroFeatures needs the gutter between the
  // headline column and the bulb for its left-hand callouts
  left: 'items-center justify-start text-left left-0 w-full md:w-[46%] xl:w-[38%] pl-6 md:pl-16',
  right: 'items-center justify-end text-right left-0 w-full md:w-[46%] xl:w-[38%] md:ml-auto pr-6 md:pr-16',
  top: 'items-start justify-center text-center left-0 right-0 pt-24 md:pt-32',
};

function TextBlock({ stage, activation }: { stage: StageText; activation: number }) {
  const translateY = lerp(16, 0, activation);
  // 'center' and 'top' share the same horizontal zone as the bulb at those
  // points in the story — a soft frosted panel behind the text guarantees
  // readability without needing to move the bulb or shrink the heading
  const needsScrim = stage.side === 'center' || stage.side === 'top';

  return (
    <div
      className={`fixed inset-0 flex px-6 pointer-events-none ${SIDE_CLASSES[stage.side]}`}
      style={{ opacity: activation, zIndex: 20 }}
    >
      <div
        className={`relative max-w-xl ${needsScrim ? 'bg-white/60 backdrop-blur-md rounded-3xl px-8 py-8 md:px-10 md:py-10' : ''}`}
        style={{ transform: `translateY(${translateY}px)`, pointerEvents: activation > 0.5 ? 'auto' : 'none' }}
      >
        <p className="text-blue-600/90 text-xs font-semibold tracking-[0.3em] uppercase mb-6">{stage.eyebrow}</p>

        {stage.headline.length > 0 && (
          <h2 className="text-4xl md:text-6xl font-semibold text-slate-900 leading-[1.08] tracking-tight mb-5">
            {stage.headline.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h2>
        )}

        {stage.body && <p className="text-base md:text-lg text-slate-600 leading-relaxed mb-8">{stage.body}</p>}

        {stage.cta && (
          <div className={`flex gap-4 flex-wrap ${stage.side === 'right' ? 'justify-end' : stage.side === 'center' ? 'justify-center' : 'justify-start'}`}>
            <Link
              href={stage.cta.primary.href}
              className="group relative overflow-hidden bg-blue-600 text-white px-8 py-3.5 rounded-full text-sm font-semibold transition-transform duration-300 hover:scale-[1.03] hover:bg-blue-700"
            >
              <span className="relative z-10">{stage.cta.primary.label}</span>
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent group-hover:translate-x-full transition-transform duration-700" />
            </Link>
            {stage.cta.secondary && (
              <Link
                href={stage.cta.secondary.href}
                className="bg-white border border-slate-300 text-slate-900 px-8 py-3.5 rounded-full text-sm font-semibold hover:border-slate-400 transition-colors duration-300"
              >
                {stage.cta.secondary.label}
              </Link>
            )}
            {/* Appears in both CTA rows — the opening hero and the closing
                "Build it. Improve it." — so a visitor can watch the product
                demo at the moment they're deciding, whenever that is. */}
            <WatchDemoButton />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * DOM text overlay for every stage that has copy (score/insights stages
 * render empty headlines and are handled by their own dedicated
 * components instead). Contrast is guaranteed by a fixed scrim, not by
 * hoping the 3D scene is bright enough at that moment.
 */
export default function SceneText() {
  const progress = useScrollProgress();

  // Only the single most-active stage is ever mounted. Every TextBlock is its
  // own `fixed inset-0` layer, so two live at once is literally two headlines
  // stacked in the same box — mapping the whole list was what produced the
  // doubled text through each transition.
  let winner: { stage: StageText; activation: number } | null = null;
  for (const stage of STAGES) {
    if (stage.headline.length === 0) continue;
    const activation = windowActivation(progress, stage.range, TEXT_FADE, TEXT_FADE);
    if (activation > (winner?.activation ?? 0.001)) winner = { stage, activation };
  }

  return (
    <>
      <div className="fixed inset-0 bg-gradient-to-b from-white/45 via-transparent to-white/55 pointer-events-none" style={{ zIndex: 15 }} />
      {winner && <TextBlock key={winner.stage.id} stage={winner.stage} activation={winner.activation} />}
    </>
  );
}

'use client';
import { useScrollProgress } from './useScrollProgress';
import { STAGES, TEXT_FADE } from './sceneConfig';
import { windowActivation, lerp } from './utils';

/**
 * The six value props that flank the bulb in the hero. Lives on its own DOM
 * layer rather than as 3D labels: these are static marketing copy, not part of
 * the scroll narrative, so anchoring them to moving world-space nodes (the way
 * OrbitNodes does) would just reintroduce the label/headline collisions.
 *
 * Shares the hero stage's activation window, so it fades out on the same beat
 * as the headline instead of lingering over the components stage.
 */

const HERO_RANGE = STAGES.find((s) => s.id === 'idea')!.range;

const ICON = 'w-5 h-5';
const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const IconExperts = () => (
  <svg viewBox="0 0 24 24" className={ICON} {...stroke}>
    <path d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19" />
    <circle cx="10" cy="8" r="3.2" />
    <path d="M19.5 19v-1.4a3.4 3.4 0 0 0-2.6-3.3M15.6 5.2a3.2 3.2 0 0 1 0 5.9" />
  </svg>
);
const IconScores = () => (
  <svg viewBox="0 0 24 24" className={ICON} {...stroke}>
    <path d="M4 20h16" />
    <rect x="5.5" y="12" width="3.4" height="5.5" rx="0.8" />
    <rect x="10.3" y="8" width="3.4" height="9.5" rx="0.8" />
    <rect x="15.1" y="4.5" width="3.4" height="13" rx="0.8" />
  </svg>
);
const IconRisk = () => (
  <svg viewBox="0 0 24 24" className={ICON} {...stroke}>
    <path d="M12 3.5 5 6.4v5c0 4.2 2.9 8 7 9.1 4.1-1.1 7-4.9 7-9.1v-5Z" />
    <path d="m9.2 11.9 2 2 3.6-3.7" />
  </svg>
);
const IconDecisions = () => (
  <svg viewBox="0 0 24 24" className={ICON} {...stroke}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3.4" />
    <path d="M12 4V2M12 22v-2M20 12h2M2 12h2" />
  </svg>
);
const IconIterate = () => (
  <svg viewBox="0 0 24 24" className={ICON} {...stroke}>
    <path d="m4 16.5 5-5 3.5 3.5L20 7.5" />
    <path d="M15.5 7.5H20V12" />
  </svg>
);
const IconBuild = () => (
  <svg viewBox="0 0 24 24" className={ICON} {...stroke}>
    <path d="M12 3c2.8 2.1 4.3 5.2 4.3 8.7L14.6 16H9.4l-1.7-4.3C7.7 8.2 9.2 5.1 12 3Z" />
    <circle cx="12" cy="10" r="1.7" />
    <path d="M9.4 16c-1.5 1-2.2 2.6-2.2 4.4 1.7 0 3.2-.7 4.2-1.9M14.6 16c1.5 1 2.2 2.6 2.2 4.4-1.7 0-3.2-.7-4.2-1.9" />
  </svg>
);

type Feature = { angle: number; title: string; body: string; Icon: () => React.ReactElement };

/**
 * Six evenly spaced points, 60° apart, laid out on an ellipse centred on the
 * bulb. Squashed horizontally (rx < ry) because screen width is the scarce
 * axis — a true circle wide enough to clear the bulb would push the outer
 * cards into the headline column on the left and off-canvas on the right.
 */
const RADIUS_X = 190;
const RADIUS_Y = 255;

const FEATURES: Feature[] = [
  { angle: 120, title: 'Expert Feedback', body: 'Get insights from industry experts', Icon: IconExperts },
  { angle: 180, title: 'Data-Driven Scores', body: 'Score your idea across 12 key frameworks', Icon: IconScores },
  { angle: 240, title: 'Reduce Risk', body: 'Identify potential gaps before you invest', Icon: IconRisk },
  { angle: 60, title: 'Better Decisions', body: 'Make confident, informed decisions', Icon: IconDecisions },
  { angle: 0, title: 'Improve & Iterate', body: 'Refine your idea based on real validation', Icon: IconIterate },
  { angle: 300, title: 'Build Smarter', body: 'Move forward with a validated foundation', Icon: IconBuild },
];

function Card({ feature }: { feature: Feature }) {
  const { Icon, title, body, angle } = feature;
  const rad = (angle * Math.PI) / 180;
  const x = Math.cos(rad) * RADIUS_X;
  const y = -Math.sin(rad) * RADIUS_Y;
  const isLeft = Math.cos(rad) < -0.01;

  // Cards mirror across the bulb so every icon faces inward and every dashed
  // leader points at the centre — the arrangement reads as one ring rather
  // than two lists that happen to sit on either side.
  const leader = <span className="h-px w-9 2xl:w-14 shrink-0 border-t border-dashed border-blue-300/80" />;

  return (
    <div
      className={`absolute flex items-center gap-3 ${isLeft ? 'flex-row-reverse text-right' : 'text-left'}`}
      style={{ left: `${x}px`, top: `${y}px`, transform: `translate(${isLeft ? '-100%' : '0'}, -50%)` }}
    >
      {leader}
      <span className="shrink-0 w-14 h-14 rounded-full bg-white border border-slate-100 shadow-lg shadow-slate-300/30 flex items-center justify-center text-blue-600">
        <Icon />
      </span>
      <span className="block">
        <span className="block text-base font-semibold text-slate-900 leading-tight">{title}</span>
        <span className="block text-sm text-slate-500 leading-snug mt-1 max-w-[172px]">{body}</span>
      </span>
    </div>
  );
}

export default function HeroFeatures() {
  const progress = useScrollProgress();
  const activation = windowActivation(progress, HERO_RANGE, TEXT_FADE, TEXT_FADE);
  if (activation <= 0.001) return null;

  // Below xl the bulb fills the width and there are no free side gutters to
  // flank it — the hero stays headline + bulb at those sizes.
  return (
    <div className="fixed inset-0 z-[19] pointer-events-none hidden xl:block" style={{ opacity: activation }}>
      {/* zero-size anchor sitting on the bulb's centre — every card is placed
          radially from this point, so the ring stays concentric with the bulb */}
      <div className="absolute left-[67%] top-1/2" style={{ transform: `translateY(${lerp(14, 0, activation)}px)` }}>
        {FEATURES.map((f) => (
          <Card key={f.title} feature={f} />
        ))}
      </div>
    </div>
  );
}

import type { Vec3 } from '@/components/landing/utils';
import { clamp, easeInOutCubic } from '@/components/landing/utils';

/**
 * Single source of truth for the validator landing's scroll timeline (0->1).
 * Mirrors the founder landing's sceneConfig pattern: every visual system
 * (camera, bulb, lens, facet cards, halo, DOM text) reads from here so pacing
 * only ever changes in one place.
 *
 * The story, in four acts: an idea arrives on the specimen stage → the lens
 * sweeps it and it fractures into the 12 scoring dimensions → the dimensions
 * become the validator's scorecard → sharp judgment builds a reputation halo.
 */

export const TOTAL_VALIDATOR_SCROLL_VH = 850;

export const HERO_RANGE: [number, number] = [0.0, 0.14];
export const LENS_RANGE: [number, number] = [0.18, 0.4]; // lens visible
export const LENS_SWEEP_RANGE: [number, number] = [0.19, 0.34]; // ring travels across the bulb
export const FACETS_BURST_RANGE: [number, number] = [0.28, 0.4]; // cards explode outward
export const FACETS_ORBIT_END = 0.54; // cards orbit until the verdict pulls them in
export const STACK_RANGE: [number, number] = [0.54, 0.64]; // cards fly into the scorecard stack
export const STACK_FADE_RANGE: [number, number] = [0.72, 0.78];
export const VERDICT_RANGE: [number, number] = [0.56, 0.72]; // DOM scorecard panel
export const HALO_RANGE: [number, number] = [0.76, 0.92];
export const FINAL_RANGE: [number, number] = [0.955, 1.0];

export const TEXT_FADE = 0.01;

// ---------------------------------------------------------------------------
// Camera — consecutive identical stops = a hold. Text side and bulb side are
// always opposite: the look target decides which half the scene occupies.
// ---------------------------------------------------------------------------
export const CAMERA_KEYFRAMES: { t: number; pos: Vec3; look: Vec3 }[] = [
  { t: 0.0, pos: [0, 0.6, 9.6], look: [-0.8, 0.25, 0] }, // hero — text left, stage right
  { t: 0.14, pos: [0, 0.6, 9.6], look: [-0.8, 0.25, 0] }, // HOLD
  { t: 0.19, pos: [0.2, 0.4, 8.2], look: [0.85, 0.05, 0] }, // lens — text right, bulb left
  { t: 0.4, pos: [0.2, 0.4, 8.2], look: [0.85, 0.05, 0] }, // HOLD through the sweep/burst
  { t: 0.44, pos: [0, 0.5, 8.9], look: [-0.85, 0.1, 0] }, // facet ring — text left, ring right
  { t: 0.52, pos: [0, 0.5, 8.9], look: [-0.85, 0.1, 0] }, // HOLD
  { t: 0.56, pos: [0.15, 0.2, 7.7], look: [0.95, -0.05, 0] }, // verdict — stack left, panel right
  { t: 0.72, pos: [0.15, 0.2, 7.7], look: [0.95, -0.05, 0] }, // HOLD
  { t: 0.78, pos: [0, 0.45, 8.6], look: [-0.85, 0.12, 0] }, // halo — text left, haloed bulb right
  { t: 0.92, pos: [0, 0.45, 8.6], look: [-0.85, 0.12, 0] }, // HOLD
  { t: 0.96, pos: [0, 0.2, 6.5], look: [0, 0.05, 0] }, // final push-in, centred
  { t: 1.0, pos: [0, 0.28, 7.0], look: [0, 0.05, 0] },
];

// ---------------------------------------------------------------------------
// The specimen bulb: descends onto the stage during the hero, then rests.
// ---------------------------------------------------------------------------
export const BULB_Y_KEYFRAMES: { t: number; y: number }[] = [
  { t: 0.0, y: 2.9 },
  { t: 0.1, y: -0.18 },
  { t: 1.0, y: -0.18 },
];

// Filament glow across the story. The lens pulse is layered on top of this.
export const GLOW_KEYFRAMES: { t: number; glow: number }[] = [
  { t: 0.0, glow: 0.4 },
  { t: 0.18, glow: 0.45 },
  { t: 0.4, glow: 0.55 },
  { t: 0.56, glow: 0.62 },
  { t: 0.72, glow: 0.72 },
  { t: 0.85, glow: 0.85 },
  { t: 1.0, glow: 0.95 },
];

/** Lens x-position across LENS_SWEEP_RANGE: enters left, exits right. */
export function lensX(progress: number): number {
  const [start, end] = LENS_SWEEP_RANGE;
  const t = easeInOutCubic(clamp((progress - start) / (end - start)));
  return -3.6 + t * 7.2;
}

/** 0->1 pulse as the lens ring passes directly over the bulb (x ~ 0). */
export function lensProximityPulse(progress: number): number {
  if (progress < LENS_RANGE[0] || progress > LENS_RANGE[1]) return 0;
  const x = lensX(progress);
  return Math.exp(-(x * x) / 0.5);
}

// ---------------------------------------------------------------------------
// DOM text stages — same shape as the founder landing's STAGES.
// ---------------------------------------------------------------------------
export type TextSide = 'left' | 'right' | 'center';

export interface ValidatorStageText {
  id: string;
  range: [number, number];
  side: TextSide;
  eyebrow: string;
  headline: string[];
  body: string;
  cta?: { primary: { label: string; href: string }; secondary?: { label: string; href: string } };
}

export const VALIDATOR_STAGES: ValidatorStageText[] = [
  {
    id: 'hero',
    range: [0.0, 0.13],
    side: 'left',
    eyebrow: 'FOR EXPERTS & OPERATORS',
    headline: ['Ideas are cheap.', 'Your judgment isn’t.'],
    body: 'Founders bring the ideas. You bring the scrutiny that separates the ones worth building from the ones worth rethinking.',
    cta: {
      primary: { label: 'Become a Validator →', href: '/auth/register/validator' },
      secondary: { label: 'I’m a founder', href: '/founders' },
    },
  },
  {
    id: 'lens',
    range: [0.2, 0.39],
    side: 'right',
    eyebrow: 'THE LENS',
    headline: ['Put every idea', 'under the lens.'],
    body: 'No vibes, no hot takes. Every idea gets the same structured examination across the dimensions that decide whether a business survives.',
  },
  {
    id: 'facets',
    range: [0.44, 0.52],
    side: 'left',
    eyebrow: '12 DIMENSIONS',
    headline: ['One idea splits into', '12 scoring dimensions.'],
    body: 'Market opportunity, feasibility, founder fit, revenue, scalability, risk — each one scored independently, on its own merits.',
  },
  // the verdict stage's copy lives inside ScorecardPanel so the panel and its
  // headline move as one block
  {
    id: 'halo',
    range: [0.78, 0.915],
    side: 'left',
    eyebrow: 'REPUTATION',
    headline: ['Great judgment', 'builds your name.'],
    body: 'Founders rate how helpful every review is. Consistently sharp reviews grow your public reputation — and earn you early looks at the most promising ideas.',
  },
  {
    id: 'final',
    range: [0.958, 1.0],
    side: 'center',
    eyebrow: 'THE INVITATION',
    headline: ['Lend your judgment.'],
    body: 'Real founders are waiting for expert eyes on their ideas. Review on your schedule, from anywhere.',
    cta: {
      primary: { label: 'Start Validating →', href: '/auth/register/validator' },
      secondary: { label: 'Explore as Founder', href: '/founders' },
    },
  },
];

// The example scorecard the verdict act animates. Deliberately imperfect —
// a 4 with an honest note sells "real scrutiny" better than a row of 9s.
export const SCORECARD_ROWS: { name: string; score: number; weak?: boolean }[] = [
  { name: 'Market Opportunity', score: 8 },
  { name: 'Feasibility', score: 7 },
  { name: 'Founder Fit', score: 9 },
  { name: 'Revenue Potential', score: 6 },
  { name: 'Risk Assessment', score: 4, weak: true },
];
export const SCORECARD_VERDICT = 76;

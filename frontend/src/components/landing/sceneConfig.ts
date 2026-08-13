import type { Vec3 } from './utils';

/**
 * Single source of truth for the whole scroll-driven timeline (progress 0->1).
 * Every visual system (camera, bulb, nodes, text) reads from here so stage
 * boundaries and pacing only ever need to change in one place.
 */

export const TOTAL_SCROLL_VH = 1300;

// ---------------------------------------------------------------------------
// Camera: consecutive stops with identical pos/look = a hold (nothing to
// interpolate -> the camera sits still while scene content transforms).
// ---------------------------------------------------------------------------
export const CAMERA_KEYFRAMES: { t: number; pos: Vec3; look: Vec3 }[] = [
  // Hero: look target is offset LEFT of the bulb's actual position, which
  // pushes the bulb to the right third of frame (rule-of-thirds) — the
  // headline gets the clear left half instead of sitting behind the bulb.
  // look.x is well left of the bulb's x=1.5, which throws the bulb into the
  // right third — far enough that HeroFeatures' two callout columns get a clear
  // gutter on each side of it.
  { t: 0.0, pos: [0, 0.2, 9.2], look: [-0.7, -0.02, 0] },
  { t: 0.08, pos: [0, 0.2, 9.2], look: [-0.7, -0.02, 0] }, // HOLD — headline reads
  { t: 0.18, pos: [0.15, 0.3, 7.0], look: [0.55, 0.1, 0] }, // dolly in, bulb stays right-framed
  { t: 0.22, pos: [0.15, 0.3, 7.0], look: [0.55, 0.1, 0] }, // HOLD — idea components
  { t: 0.3, pos: [0.1, 0.35, 6.4], look: [0.5, 0.15, 0] },
  { t: 0.32, pos: [0.1, 0.35, 6.4], look: [0.5, 0.15, 0] }, // HOLD — submit
  { t: 0.4, pos: [-0.1, 0.3, 6.1], look: [-0.5, 0.1, 0] }, // tracking bulb left
  { t: 0.45, pos: [-0.1, 0.3, 6.1], look: [-0.5, 0.1, 0] }, // HOLD — experts
  // From here the bulb sits at world origin, so the look target alone decides
  // which side of frame it occupies: looking LEFT of it pushes it right, and
  // vice versa. Each of these mirrors its stage's text side so the bulb and the
  // headline never share a half of the screen.
  { t: 0.5, pos: [0, 0.35, 5.9], look: [-0.75, 0.12, 0] }, // frameworks — text left, bulb right
  { t: 0.64, pos: [0, 0.3, 5.6], look: [-0.75, 0.12, 0] }, // slow settle through framework activations
  { t: 0.7, pos: [0.3, 0.15, 5.1], look: [0.7, 0.02, 0] }, // weakness — text right, bulb left
  { t: 0.75, pos: [0.3, 0.15, 5.1], look: [0.7, 0.02, 0] }, // HOLD — weaknesses visible
  { t: 0.8, pos: [-0.2, 0.2, 4.9], look: [-0.7, 0.05, 0] }, // improvement — text left, bulb right
  { t: 0.85, pos: [-0.2, 0.2, 4.9], look: [-0.7, 0.05, 0] }, // HOLD — improved
  { t: 0.89, pos: [0, 0.08, 3.5], look: [0, 0.1, 0] }, // push in — convergence
  { t: 0.93, pos: [0, 0.08, 3.5], look: [0, 0.1, 0] }, // HOLD — score
  { t: 0.95, pos: [-0.55, 0.2, 4.3], look: [-0.4, 0.15, 0] }, // shift — insights panel
  { t: 0.97, pos: [-0.55, 0.2, 4.3], look: [-0.4, 0.15, 0] }, // HOLD
  { t: 1.0, pos: [0, 0.3, 4.9], look: [0, 0.15, 0] }, // final brand moment, pulled back
];

// Small additional camera nudge toward the currently spotlighted framework
// node, layered on top of CAMERA_KEYFRAMES during the frameworks stage only.
export const FRAMEWORKS_CAMERA_NUDGE_RANGE: [number, number] = [0.45, 0.65];

// ---------------------------------------------------------------------------
// Bulb position — the bulb is not fixed at the origin. It relocates to make
// room for text/experts/components at specific points in the story.
// ---------------------------------------------------------------------------
export const BULB_POSITION_KEYFRAMES: { t: number; pos: Vec3 }[] = [
  // Bulb sits right-of-center for the whole hero/components/submit run —
  // one clear composition instead of drifting, matching the camera framing
  // above (text occupies the left, bulb owns the right).
  { t: 0.0, pos: [1.5, -0.05, 0] },
  { t: 0.32, pos: [1.5, -0.05, 0] }, // HOLD through idea / components / submit
  { t: 0.38, pos: [-1.5, 0.1, 0] },
  { t: 0.45, pos: [-1.5, 0.1, 0] }, // HOLD — experts
  { t: 0.49, pos: [0, 0, 0] },
  { t: 0.93, pos: [0, 0, 0] }, // HOLD through frameworks/weakness/improvement/score
  { t: 0.95, pos: [-0.9, 0.1, 0] },
  { t: 0.97, pos: [-0.9, 0.1, 0] }, // HOLD — insights
  { t: 0.99, pos: [0, 0, 0] },
  { t: 1.0, pos: [0, 0, 0] }, // HOLD — final
];

// Hero-only emphasis: the reference hero shows the bulb filling roughly half the
// viewport height, where the scene's natural framing put it at about a quarter.
// Scaling the bulb (rather than dollying the camera) keeps the rest of the
// timeline's framing untouched — it eases back to 1.0 before the components stage.
export const BULB_SCALE_KEYFRAMES: { t: number; scale: number }[] = [
  { t: 0.0, scale: 1.75 },
  { t: 0.08, scale: 1.75 },
  { t: 0.18, scale: 1.0 },
  { t: 1.0, scale: 1.0 },
];

// ---------------------------------------------------------------------------
// Bulb brightness / tint / instability. instability drives the crack overlay
// and jitter during the weakness stage; it stays 0 everywhere else.
// ---------------------------------------------------------------------------
export const BULB_TIMELINE: { t: number; brightness: number; tint: string; instability: number }[] = [
  // Hero matches the reference: a lit bulb with a bright blue-white filament,
  // not the near-dark one this timeline originally opened on. The whole early
  // curve was lifted with it so brightness still climbs into the score and the
  // weakness dip still reads — the arc is shallower, not removed.
  { t: 0.0, brightness: 0.5, tint: '#8fc0ff', instability: 0 },
  { t: 0.1, brightness: 0.52, tint: '#8fc0ff', instability: 0 },
  { t: 0.2, brightness: 0.55, tint: '#7db4ff', instability: 0 }, // idea takes shape
  { t: 0.3, brightness: 0.58, tint: '#60a5fa', instability: 0 },
  { t: 0.45, brightness: 0.62, tint: '#60a5fa', instability: 0 }, // experts arrive
  { t: 0.5, brightness: 0.66, tint: '#60a5fa', instability: 0 },
  { t: 0.65, brightness: 0.72, tint: '#60a5fa', instability: 0 }, // frameworks validated — brighter blue
  { t: 0.68, brightness: 0.5, tint: '#c99a5a', instability: 0.85 }, // weakness — restrained amber, not red
  { t: 0.75, brightness: 0.48, tint: '#c99a5a', instability: 0.9 },
  { t: 0.8, brightness: 0.7, tint: '#3b82f6', instability: 0.25 }, // improving — amber recovers to blue
  { t: 0.85, brightness: 0.8, tint: '#60a5fa', instability: 0 },
  { t: 0.89, brightness: 0.85, tint: '#93c5fd', instability: 0 },
  { t: 0.93, brightness: 1.0, tint: '#eaf2ff', instability: 0 }, // score — bright blue-white, the peak
  { t: 1.0, brightness: 0.95, tint: '#dceaff', instability: 0 }, // final — stable soft blue-white
];

// ---------------------------------------------------------------------------
// The 12 validation frameworks. Sequential spotlight windows live in the
// 0.45–0.65 range; scores/weak flags are used again in the weakness and
// score-reveal stages (same data, different visual treatment).
// ---------------------------------------------------------------------------
export interface Framework {
  name: string;
  score: number;
  weak?: boolean; // gets the crack/red treatment during the weakness stage
  improvedScore?: number; // value it recovers to during the improvement stage
}

export const FRAMEWORKS: Framework[] = [
  { name: 'Market Opportunity', score: 89 },
  { name: 'Feasibility', score: 81 },
  { name: 'Founder Fit', score: 74 },
  { name: 'Revenue Potential', score: 76 },
  { name: 'Scalability', score: 79 },
  { name: 'Risk Assessment', score: 42, weak: true, improvedScore: 68 },
  { name: 'Investor Attractiveness', score: 77 },
  { name: 'Innovation', score: 89 },
  { name: 'Social Impact', score: 71 },
  { name: 'Customer Validation', score: 48, weak: true, improvedScore: 72 },
  { name: 'Shark Tank Score', score: 80 },
  { name: 'Startup Success', score: 82 },
];

export const COMPONENTS_APPEAR_RANGE: [number, number] = [0.11, 0.2];
export const COMPONENTS_CONVERGE_RANGE: [number, number] = [0.23, 0.31];
export const EXPERTS_RANGE: [number, number] = [0.34, 0.44];
export const FRAMEWORKS_RANGE: [number, number] = [0.45, 0.65];
export const WEAKNESS_RANGE: [number, number] = [0.65, 0.75];
export const IMPROVEMENT_RANGE: [number, number] = [0.75, 0.85];
// The four DOM overlay windows below must stay disjoint once TEXT_FADE is
// added to each edge — every overlay is a `fixed inset-0` layer, so any two
// that are simultaneously non-zero render their text on top of each other.
// Previously SCORE_RANGE and INSIGHTS_RANGE shared the 0.93 boundary, which
// put both at FULL opacity at that exact point.
export const SCORE_RANGE: [number, number] = [0.85, 0.922];
export const INSIGHTS_RANGE: [number, number] = [0.938, 0.959];
export const FINAL_SCORE = 82;
export const FINAL_MOMENT_RANGE: [number, number] = [0.994, 1.0];

/** Fade applied to each edge of a DOM text window. Must be <= half the
 *  smallest gap between consecutive overlay ranges (currently 0.02). */
export const TEXT_FADE = 0.008;

// ---------------------------------------------------------------------------
// DOM text overlay content per stage. `side` controls composition so text
// never sits behind the bulb.
// ---------------------------------------------------------------------------
export type TextSide = 'left' | 'right' | 'center' | 'top';

export interface StageText {
  id: string;
  range: [number, number];
  side: TextSide;
  // No numbered stage markers anywhere in the scene — eyebrows are plain labels.
  eyebrow: string;
  headline: string[];
  body: string;
  cta?: { primary: { label: string; href: string }; secondary?: { label: string; href: string } };
}

export const STAGES: StageText[] = [
  {
    id: 'idea',
    range: [0.0, 0.09],
    side: 'left',
    eyebrow: 'THE IDEA',
    headline: ['Validate Before', 'You Build.'],
    body: 'Get structured, expert feedback on your business idea before you invest your time and money.',
    cta: {
      primary: { label: 'Validate My Idea →', href: '/auth/register/founder' },
      secondary: { label: 'Become a Validator', href: '/auth/register/validator' },
    },
  },
  {
    id: 'components',
    range: [0.11, 0.2],
    side: 'left',
    eyebrow: 'AN IDEA TAKES SHAPE',
    headline: ['Every great business', 'starts with an idea.'],
    body: 'But an idea needs more than excitement — problem, solution, customer, market, and a way to make money.',
  },
  {
    id: 'submit',
    range: [0.23, 0.31],
    side: 'left',
    eyebrow: 'SUBMIT',
    headline: ['Turn your idea into', 'something we can test.'],
    body: 'A structured submission becomes a testable object — ready to enter the validation system.',
  },
  {
    id: 'experts',
    range: [0.34, 0.44],
    side: 'right',
    eyebrow: 'EXPERT VALIDATION',
    headline: ['Your idea shouldn’t be', 'judged by one perspective.'],
    body: 'Industry, market, finance, technology, customer, and founder experts each examine your idea.',
  },
  {
    id: 'frameworks',
    range: [0.5, 0.63],
    // 'left', not 'top' — a top-centred panel sat directly on top of the bulb
    // and its node ring. Text owns one side, the bulb owns the other.
    side: 'left',
    eyebrow: '12 DIMENSIONS',
    headline: ['One idea.', '12 dimensions of validation.'],
    body: 'Every angle that matters to the market and to investors, scored independently.',
  },
  {
    id: 'weakness',
    range: [0.66, 0.74],
    side: 'right',
    eyebrow: 'HONEST FEEDBACK',
    headline: ['Validation isn’t about', 'proving you’re perfect.'],
    body: 'It’s about discovering, precisely, what needs to change before you build.',
  },
  {
    id: 'improvement',
    range: [0.76, 0.834], // ends before SCORE_RANGE's faded-in edge at 0.842
    side: 'left',
    eyebrow: 'IMPROVEMENT',
    headline: ['Turn feedback', 'into insight.'],
    body: 'Clarify the target customer. Improve the pricing model. Reduce execution risk.',
  },
  {
    id: 'score',
    range: [0.855, 0.925],
    side: 'center',
    eyebrow: 'VALIDATION SCORE',
    headline: [],
    body: '',
  },
  {
    // handled entirely by InsightDashboard.tsx (eyebrow + headline + panel
    // together) so this doesn't compete with a separate SceneText block
    id: 'insights',
    range: [0.935, 0.965],
    side: 'right',
    eyebrow: 'THE FULL PICTURE',
    headline: [],
    body: '',
  },
  {
    id: 'decision',
    range: [0.975, 0.984], // must clear FINAL_MOMENT_RANGE, which used to start at 0.988
    side: 'center',
    eyebrow: 'THE DECISION',
    headline: ['Build it. Improve it.', 'Or rethink it.'],
    body: 'Make your next decision with evidence, not assumptions.',
    cta: {
      primary: { label: 'Validate My Idea →', href: '/auth/register/founder' },
      secondary: { label: 'Become a Validator', href: '/auth/register/validator' },
    },
  },
];

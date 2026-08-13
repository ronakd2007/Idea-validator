import type { Vec3 } from './utils';
import { clamp, lerp } from './utils';
import { FRAMEWORKS, FRAMEWORKS_RANGE } from './sceneConfig';

/**
 * Fixed loose-ring layout around the bulb — deliberately not a full
 * Fibonacci sphere. A shallow arc reads as a halo of context rather than
 * a dashboard, and keeps most nodes visually secondary to the bulb.
 * Generous radius/vertical spread so the handful of nodes that can be
 * on-screen labelled at once (spotlit + weak ones) never collide.
 */
export function frameworkNodePosition(index: number): Vec3 {
  const total = FRAMEWORKS.length;
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
  // 1.45, not 2.35 — at the old radius the ring was far wider than the bulb, so
  // node labels ("RISK ASSESSMENT 42/100") landed on top of the DOM headline
  // column. The cluster now stays visually attached to the bulb it describes.
  const radius = 1.45;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius * 0.6;
  const y = Math.sin(index * 1.7) * 0.38 + Math.cos(index * 0.9) * 0.1;
  return [x, y, z];
}

/**
 * Vertical fan arrangement used for idea components and expert nodes —
 * strong Y separation is the primary anti-collision axis for text labels
 * that read left-to-right, with a gentle depth curve for parallax.
 */
export function fanLayout(index: number, total: number, radius: number, arcSpan = 2.4, depth = 0.55): Vec3 {
  const tNorm = total <= 1 ? 0.5 : index / (total - 1);
  const angle = (tNorm - 0.5) * arcSpan;
  const x = Math.sin(angle) * radius;
  const y = (tNorm - 0.5) * radius * 1.5;
  const z = (Math.cos(angle) - 1) * depth;
  return [x, y, z];
}

/**
 * Which framework is currently "in focus" (0..11), and how far into its
 * spotlight window we are (0..1) — used for scale/opacity/label easing.
 * Returns -1 outside the frameworks range.
 */
export function activeFrameworkIndex(progress: number): { index: number; localT: number } {
  const [start, end] = FRAMEWORKS_RANGE;
  if (progress < start || progress > end) return { index: -1, localT: 0 };
  const span = end - start;
  const slice = span / FRAMEWORKS.length;
  const rel = progress - start;
  const index = clamp(Math.floor(rel / slice), 0, FRAMEWORKS.length - 1);
  const localT = clamp((rel - index * slice) / slice);
  return { index, localT };
}

/**
 * 0..1 activation strength for a given node index at the current progress:
 * ramps in as its spotlight window approaches, peaks during its window,
 * settles to a low "already validated" glow afterward (never fully off).
 */
export function frameworkActivation(index: number, progress: number): number {
  const [start, end] = FRAMEWORKS_RANGE;
  const span = end - start;
  const slice = span / FRAMEWORKS.length;
  const windowStart = start + index * slice;
  const windowCenter = windowStart + slice * 0.5;

  if (progress < windowStart - slice * 0.6) return 0;
  if (progress < windowCenter) {
    return clamp((progress - (windowStart - slice * 0.6)) / (slice * 1.1));
  }
  if (progress < end) {
    return lerp(1, 0.45, clamp((progress - windowCenter) / (end - windowCenter)));
  }
  return 0.45; // settled, quietly present through weakness/improvement/score
}

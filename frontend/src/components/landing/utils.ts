export function clamp(v: number, min = 0, max = 1) {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export type Vec3 = [number, number, number];

export function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

/**
 * Given a sorted list of { t, ...values } keyframes and a global progress,
 * find the bracketing pair and return an eased local t (0-1) between them.
 * Consecutive keyframes with identical values at different `t` act as a
 * "hold" — nothing to interpolate, camera/scene just sits still.
 */
export function findSegment<T extends { t: number }>(
  keyframes: T[],
  progress: number
): { from: T; to: T; localT: number } {
  const p = clamp(progress);
  let from = keyframes[0];
  let to = keyframes[keyframes.length - 1];

  for (let i = 0; i < keyframes.length - 1; i++) {
    if (p >= keyframes[i].t && p <= keyframes[i + 1].t) {
      from = keyframes[i];
      to = keyframes[i + 1];
      break;
    }
  }

  const span = to.t - from.t;
  const raw = span <= 0 ? 0 : (p - from.t) / span;
  return { from, to, localT: easeInOutCubic(clamp(raw)) };
}

/** 0->1 activation for a [start,end] window, with linear fade in/out edges. */
export function windowActivation(progress: number, range: [number, number], fadeIn = 0.035, fadeOut = 0.035) {
  const [start, end] = range;
  if (progress < start - fadeIn || progress > end + fadeOut) return 0;
  if (progress < start) return clamp((progress - (start - fadeIn)) / fadeIn);
  if (progress > end) return 1 - clamp((progress - end) / fadeOut);
  return 1;
}

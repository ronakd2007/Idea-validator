import type { Vec3 } from './utils';
import { clamp } from './utils';

/**
 * The validation journey, rendered as seven points inside the glass:
 *
 *   idea -> expert feedback -> market response -> data -> risk -> validation -> decision
 *
 * Deliberately never labelled in the scene. The meaning is carried by the
 * ascent (the journey climbs the bulb) and by the ORDER the nodes illuminate
 * in as you scroll — an idea entering, being examined, and coming out stronger.
 *
 * Every point sits in the shell between the filament coil (radius 0.2) and the
 * glass wall, so the network reads as signals travelling around the idea rather
 * than as clutter tangled up in the filament itself.
 */
export const VALIDATION_NODES: Vec3[] = [
  [0.0, -0.3, 0.34], // idea — enters low and to the front
  [-0.36, -0.1, 0.1], // expert feedback
  [0.34, -0.06, -0.06], // market response
  [-0.26, 0.16, -0.3], // data
  [0.28, 0.24, 0.22], // risk
  [-0.18, 0.42, -0.24], // validation
  [0.16, 0.58, 0.24], // decision — exits high
];

/**
 * The six sequential hops of the journey plus three cross-links. Kept this
 * sparse on purpose: a fully connected graph reads as a circuit board, which is
 * exactly the wrong association. Nine thin lines read as a network of signals.
 */
export const VALIDATION_EDGES: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 6],
  [0, 2],
  [1, 4],
  [3, 6],
];

// Node 0 lights just after the hero settles; the last is fully lit shortly
// before the score reveal, so the network completes as the score lands.
const REVEAL_START = 0.04;
const REVEAL_SPAN = 0.74;

/** 0 -> 1 for node `i`. Nodes illuminate in journey order across the scroll. */
export function nodeActivation(i: number, progress: number): number {
  const step = REVEAL_SPAN / VALIDATION_NODES.length;
  return clamp((progress - (REVEAL_START + i * step)) / (step * 1.5));
}

/** Mean node activation — drives edge visibility, signal travel and core glow. */
export function networkActivation(progress: number): number {
  let sum = 0;
  for (let i = 0; i < VALIDATION_NODES.length; i++) sum += nodeActivation(i, progress);
  return sum / VALIDATION_NODES.length;
}

import type { RngState } from '../types.js';

const UINT32_RANGE = 0x1_0000_0000;

/** Seeds one independent sfc32 stream from a numeric seed and stream name. */
export function seedStream(seed: number, name: string): RngState {
  let hash = 0x811c9dc5;
  for (const char of `${seed}:${name}`) {
    hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193);
  }
  const state: RngState = [0, 0, 0, 0];
  for (let index = 0; index < state.length; index += 1) {
    hash = (hash + 0x9e3779b9) >>> 0;
    let value = hash;
    value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
    value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
    state[index] = (value ^ (value >>> 16)) >>> 0;
  }
  return state;
}

/** Advances an sfc32 state and returns a value in [0, 1). */
export function next(state: RngState): number {
  let [a, b, c, d] = state;
  const value = (((a + b) | 0) + d) | 0;
  d = (d + 1) | 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) | 0;
  c = (((c << 21) | (c >>> 11)) + value) | 0;
  state[0] = a >>> 0;
  state[1] = b >>> 0;
  state[2] = c >>> 0;
  state[3] = d >>> 0;
  return (value >>> 0) / UINT32_RANGE;
}

/** Returns a uniform value from [min, max). */
export function uniform(state: RngState, min: number, max: number): number {
  return min + next(state) * (max - min);
}

/** Returns a uniformly sampled integer from the inclusive bounds. */
export function int(state: RngState, min: number, max: number): number {
  return min + Math.floor(next(state) * (max - min + 1));
}

/** Returns a normally distributed value using two stream draws. */
export function normal(state: RngState, mean: number, sigma: number): number {
  const u = 1 - next(state);
  const v = next(state);
  return mean + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Returns whether an event with probability p occurs. */
export function chance(state: RngState, probability: number): boolean {
  return next(state) < probability;
}

/** Normalizes a compass angle to [0, 360). */
export function normalizeAngle(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/** Returns the signed shortest turn from one compass angle to another. */
export function angleDifference(from: number, to: number): number {
  return ((normalizeAngle(to - from) + 540) % 360) - 180;
}

/** Interpolates compass angles along the shortest arc. */
export function lerpAngle(from: number, to: number, fraction: number): number {
  return normalizeAngle(from + angleDifference(from, to) * fraction);
}

/** Restricts a value to an inclusive interval. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Linearly interpolates between two values. */
export function lerp(from: number, to: number, fraction: number): number {
  return from + (to - from) * fraction;
}

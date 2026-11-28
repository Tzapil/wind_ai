import type { Balance } from './data/schemas.js';
import type { GameData, GameEvent, WorldState } from './types.js';
import { realDistance } from './util/geo.js';
import { clamp, lerpAngle, normalizeAngle } from './util/math.js';
import { int, normal } from './util/rng.js';

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const MIN_DISTANCE_KM = 50;
const NEAREST_REGIONS = 3;

/** Chooses new regional targets on a day boundary using only the wind stream. */
export function changeDailyWind(
  state: WorldState,
  data: GameData,
  day: number,
): void {
  for (const region of data.wind.regions) {
    const current = state.wind.regions[region.id];
    if (!current || day < current.nextChangeDay) continue;
    const offset = clamp(
      normal(state.rng.wind, 0, region.spreadDeg / 2),
      -region.spreadDeg,
      region.spreadDeg,
    );
    current.targetFromDeg = normalizeAngle(region.prevailingFromDeg + offset);
    current.transitionLeft = data.wind.transitionTicks;
    current.nextChangeDay =
      day + int(state.rng.wind, ...data.wind.changeEveryDays);
  }
}

/** Advances regional wind along the shortest arc and reports completed changes. */
export function advanceWind(state: WorldState): GameEvent[] {
  const events: GameEvent[] = [];
  for (const [regionId, region] of Object.entries(state.wind.regions)) {
    if (region.transitionLeft === 0) continue;
    region.fromDeg = lerpAngle(
      region.fromDeg,
      region.targetFromDeg,
      1 / region.transitionLeft,
    );
    region.transitionLeft -= 1;
    if (region.transitionLeft === 0) {
      region.fromDeg = region.targetFromDeg;
      events.push({ type: 'WindChanged', regionId, fromDeg: region.fromDeg });
    }
  }
  return events;
}

/** Returns the meteorological wind azimuth at a Mercator map point. */
export function windAt(
  state: WorldState,
  data: GameData,
  x: number,
  y: number,
): number {
  const nearest = data.wind.regions
    .map((region) => ({
      region,
      distance: realDistance({ x, y }, region),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, NEAREST_REGIONS);
  if (nearest.length === 0) throw new RangeError('No wind regions');

  let east = 0;
  let north = 0;
  for (const { region, distance } of nearest) {
    const fromDeg = state.wind.regions[region.id]?.fromDeg;
    if (fromDeg === undefined)
      throw new RangeError(`Missing wind state for ${region.id}`);
    const weight = 1 / Math.max(distance, MIN_DISTANCE_KM) ** 2;
    east += Math.sin(fromDeg * DEG_TO_RAD) * weight;
    north += Math.cos(fromDeg * DEG_TO_RAD) * weight;
  }
  if (Math.hypot(east, north) < Number.EPSILON) {
    return state.wind.regions[nearest[0]!.region.id]!.fromDeg;
  }
  return normalizeAngle(Math.atan2(east, north) * RAD_TO_DEG);
}

/** Interpolates the sail-speed multiplier for an angle to the wind. */
export function pointOfSailMultiplier(theta: number, balance: Balance): number {
  if (!Number.isFinite(theta) || theta < 0 || theta > 180)
    throw new RangeError('Point-of-sail angle must be between 0 and 180');
  const curve = balance.windCurve;
  for (let index = 1; index < curve.length; index += 1) {
    const previous = curve[index - 1]!;
    const next = curve[index]!;
    if (theta <= next[0]) {
      const fraction = (theta - previous[0]) / (next[0] - previous[0]);
      return previous[1] + (next[1] - previous[1]) * fraction;
    }
  }
  return curve[curve.length - 1]![1];
}

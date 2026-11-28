const EARTH_RADIUS_KM = 6371;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export interface MapPoint {
  x: number;
  y: number;
}

/** Projects longitude and latitude to Mercator map kilometres, with Y pointing down. */
export function project(lon: number, lat: number): MapPoint {
  const phi = lat * DEG_TO_RAD;
  return {
    x: EARTH_RADIUS_KM * lon * DEG_TO_RAD,
    y: -EARTH_RADIUS_KM * Math.log(Math.tan(Math.PI / 4 + phi / 2)),
  };
}

/** Returns latitude in degrees for a Mercator map Y coordinate. */
export function latOf(y: number): number {
  return Math.atan(Math.sinh(-y / EARTH_RADIUS_KM)) * RAD_TO_DEG;
}

/** Returns the local ratio of real distance to Mercator map distance. */
export function scaleAt(y: number): number {
  return Math.cos(latOf(y) * DEG_TO_RAD);
}

/** Approximates real kilometres between nearby map points at their mean latitude. */
export function realDistance(a: MapPoint, b: MapPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y) * scaleAt((a.y + b.y) / 2);
}

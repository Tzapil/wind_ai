import { describe, expect, it } from 'vitest';

import { latOf, project, realDistance, scaleAt } from '../src/util/geo';

describe('Mercator map helpers', () => {
  it.each([
    { lon: 0, lat: 0, x: 0, y: 0 },
    { lon: 10, lat: 0, x: 1111.9492664455872, y: 0 },
    { lon: 0, lat: 45, x: 0, y: -5615.231122901508 },
  ])('projects the control point ($lon, $lat)', ({ lon, lat, x, y }) => {
    const point = project(lon, lat);
    expect(point.x).toBeCloseTo(x, 9);
    expect(point.y).toBeCloseTo(y, 9);
    expect(latOf(point.y)).toBeCloseTo(lat, 6);
  });

  it('returns latitude and scale across the map extent', () => {
    for (const lat of [29.5, 37.94, 45.42, 47.5]) {
      const y = project(0, lat).y;
      expect(latOf(y)).toBeCloseTo(lat, 6);
      expect(scaleAt(y)).toBeCloseTo(Math.cos((lat * Math.PI) / 180), 12);
    }
  });

  it('estimates Piraeus to Alexandria within 1% of geodesic distance', () => {
    const piraeus = project(23.62, 37.94);
    const alexandria = project(29.88, 31.21);
    const actual = realDistance(piraeus, alexandria);
    const phi1 = (37.94 * Math.PI) / 180;
    const phi2 = (31.21 * Math.PI) / 180;
    const deltaPhi = phi2 - phi1;
    const deltaLambda = ((29.88 - 23.62) * Math.PI) / 180;
    const haversine = 2 * 6371 * Math.asin(Math.sqrt(
      Math.sin(deltaPhi / 2) ** 2 +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2,
    ));
    expect(Math.abs(actual - haversine) / haversine).toBeLessThan(0.01);
    expect(actual).toBeGreaterThan(900);
    expect(actual).toBeLessThan(1000);
  });
});

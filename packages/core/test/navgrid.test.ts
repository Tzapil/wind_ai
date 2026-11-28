import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

import {
  buildCoarseGrid,
  isWater,
  parseNavGrid,
  toCell,
  toWorld,
} from '../src/nav/navgrid.js';
import type { NavGrid } from '../src/types.js';
import { project } from '../src/util/geo.js';

const binary = await readFile(
  new URL('../../client/public/data/navgrid.bin', import.meta.url),
);

describe('NavGrid binary loader', () => {
  it('reads the real header and builds the 2 km grid at load time', () => {
    const grid = parseNavGrid(binary);
    expect(grid.cellKm).toBe(1);
    expect(grid.width).toBeGreaterThan(0);
    expect(grid.height).toBeGreaterThan(0);
    expect(grid.bits).toHaveLength(Math.ceil((grid.width * grid.height) / 8));
    expect(grid.pathGrid?.cellKm).toBe(2);
    expect(grid.pathGrid?.width).toBe(Math.ceil(grid.width / 2));
    expect(grid.pathGrid?.height).toBe(Math.ceil(grid.height / 2));
    expect(grid.pathGrid?.originX).toBe(grid.originX);
    expect(grid.pathGrid?.originY).toBe(grid.originY);

    const point = toWorld(grid, 100, 200);
    const cell = toCell(grid, point.x, point.y);
    expect(cell).toEqual({ col: 100, row: 200 });
    expect(isWater(grid, grid.originX - 0.01, grid.originY)).toBe(false);
    expect(isWater(grid, Number.NaN, grid.originY)).toBe(false);
  });

  it('rejects wrong magic, version, and truncated payload', () => {
    const wrongMagic = Uint8Array.from(binary);
    wrongMagic[0] = 0;
    expect(() => parseNavGrid(wrongMagic)).toThrow(/magic/);
    const wrongVersion = Uint8Array.from(binary);
    wrongVersion[4] = 2;
    expect(() => parseNavGrid(wrongVersion)).toThrow(/version/);
    expect(() => parseNavGrid(binary.subarray(0, 20))).toThrow(/truncated/);
    expect(() => parseNavGrid(binary.subarray(0, -1))).toThrow(/length/);
  });

  it('matches T-12 land and sea control points in the real file', () => {
    const grid = parseNavGrid(binary);
    for (const [lon, lat] of [
      [18.5, 37.5],
      [25.5, 38],
      [27.8, 40.7],
      [33, 34.5],
      [16, 42],
    ]) {
      const { x, y } = project(lon, lat);
      expect(isWater(grid, x, y), `sea at ${lon}, ${lat}`).toBe(true);
    }
    for (const [lon, lat] of [
      [14, 37.5],
      [25, 35.2],
      [33.3, 35],
      [30, 39],
      [22.4, 37.3],
      [29.2, 41.3],
    ]) {
      const { x, y } = project(lon, lat);
      expect(isWater(grid, x, y), `land at ${lon}, ${lat}`).toBe(false);
    }
  });

  it('keeps narrow water cells in the coarse grid without inventing water blocks', () => {
    const fine: NavGrid = {
      cellKm: 1,
      width: 4,
      height: 3,
      originX: -2,
      originY: 10,
      bits: new Uint8Array([1 << 1, 1 << 2]),
    };
    const coarse = buildCoarseGrid(fine);
    expect(coarse).toMatchObject({
      cellKm: 2,
      width: 2,
      height: 2,
      originX: -2,
      originY: 10,
    });
    expect(isWater(coarse, -1, 11)).toBe(true);
    expect(isWater(coarse, 1, 11)).toBe(false);
    expect(isWater(coarse, -1, 13)).toBe(false);
    expect(isWater(coarse, 1, 13)).toBe(true);
  });
});

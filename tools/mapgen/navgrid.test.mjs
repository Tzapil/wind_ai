import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { describe, expect, it } from 'vitest';

import { project } from '../../packages/core/src/util/geo.ts';

const root = new URL('../../', import.meta.url);
const bin = await readFile(
  new URL('packages/client/public/data/navgrid.bin', root),
);
const ports = JSON.parse(
  await readFile(new URL('data/generated/ports.geo.json', root), 'utf8'),
);
const sourcePorts = JSON.parse(
  await readFile(new URL('data/ports.json', root), 'utf8'),
);
const builtPorts = JSON.parse(
  await readFile(
    new URL('packages/client/public/data/ports.json', root),
    'utf8',
  ),
);

const grid = {
  cellKm: bin.readFloatLE(6),
  width: bin.readUInt32LE(10),
  height: bin.readUInt32LE(14),
  originX: bin.readFloatLE(18),
  originY: bin.readFloatLE(22),
};

function indexOf(x, y) {
  const col = Math.floor((x - grid.originX) / grid.cellKm);
  const row = Math.floor((y - grid.originY) / grid.cellKm);
  return col < 0 || row < 0 || col >= grid.width || row >= grid.height
    ? -1
    : row * grid.width + col;
}

function waterIndex(index) {
  return index >= 0 && (bin[26 + (index >> 3)] & (1 << (index & 7))) !== 0;
}

function waterAt(lon, lat) {
  const point = project(lon, lat);
  return waterIndex(indexOf(point.x, point.y));
}

function reachable(start, blocked = () => false) {
  const seen = new Uint8Array(grid.width * grid.height);
  const queue = new Uint32Array(seen.length);
  queue[0] = start;
  seen[start] = 1;
  let head = 0;
  let tail = 1;
  while (head < tail) {
    const index = queue[head++];
    const col = index % grid.width;
    const row = Math.floor(index / grid.width);
    for (const neighbor of [
      col > 0 ? index - 1 : -1,
      col + 1 < grid.width ? index + 1 : -1,
      row > 0 ? index - grid.width : -1,
      row + 1 < grid.height ? index + grid.width : -1,
    ]) {
      if (
        neighbor < 0 ||
        seen[neighbor] ||
        !waterIndex(neighbor) ||
        blocked(neighbor)
      )
        continue;
      seen[neighbor] = 1;
      queue[tail++] = neighbor;
    }
  }
  return seen;
}

describe('generated navigation grid', () => {
  it('has the specified binary header and ten land/sea control points', () => {
    expect(bin.toString('ascii', 0, 4)).toBe('PVNG');
    expect(bin.readUInt16LE(4)).toBe(1);
    expect(grid.cellKm).toBe(1);
    expect(bin.length).toBe(26 + Math.ceil((grid.width * grid.height) / 8));
    for (const [lon, lat] of [
      [18.5, 37.5],
      [25.5, 38],
      [27.8, 40.7],
      [33, 34.5],
      [16, 42],
    ])
      expect(waterAt(lon, lat)).toBe(true);
    for (const [lon, lat] of [
      [14, 37.5],
      [25, 35.2],
      [33.3, 35],
      [30, 39],
      [22.4, 37.3],
    ])
      expect(waterAt(lon, lat)).toBe(false);
  });

  it('connects all five ports, including Istanbul through the Dardanelles and Marmara', () => {
    const start = ports.athens.anchorage;
    const connected = reachable(indexOf(start.x, start.y));
    for (const [id, port] of Object.entries(ports)) {
      const index = indexOf(port.anchorage.x, port.anchorage.y);
      expect(waterIndex(index), id).toBe(true);
      expect(connected[index], id).toBe(1);
    }
    const marmara = project(27.8, 40.7);
    expect(connected[indexOf(marmara.x, marmara.y)]).toBe(1);
    const west = project(26.0, 39.8);
    const east = project(26.9, 40.6);
    const minCol = Math.floor((west.x - grid.originX) / grid.cellKm);
    const maxCol = Math.floor((east.x - grid.originX) / grid.cellKm);
    const minRow = Math.floor((east.y - grid.originY) / grid.cellKm);
    const maxRow = Math.floor((west.y - grid.originY) / grid.cellKm);
    const withoutDardanelles = reachable(indexOf(start.x, start.y), (index) => {
      const col = index % grid.width;
      const row = Math.floor(index / grid.width);
      return col >= minCol && col <= maxCol && row >= minRow && row <= maxRow;
    });
    const istanbul = ports.istanbul.anchorage;
    expect(withoutDardanelles[indexOf(istanbul.x, istanbul.y)]).toBe(0);
    expect(waterAt(29.2, 41.3)).toBe(false);
  });

  it('merges generated port positions without changing the source data', () => {
    expect(Object.keys(ports)).toHaveLength(5);
    for (const port of sourcePorts) {
      expect(port).not.toHaveProperty('anchorage');
      expect(port).not.toHaveProperty('exitHeading');
      const built = builtPorts.find((candidate) => candidate.id === port.id);
      expect(built.anchorage).toEqual(ports[port.id].anchorage);
      expect(built.exitHeading).toBe(ports[port.id].exitHeading);
    }
  });
});

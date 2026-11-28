import { Buffer } from 'node:buffer';
import { deflateSync } from 'node:zlib';

import { project } from '../../packages/core/src/util/geo.ts';

const CELL_KM = 1;
const HEADER_BYTES = 26;
const OPEN_SEA_RADIUS = 5;
const PNG_SCALE = 5;

export function cellOf(grid, x, y) {
  return [
    Math.floor((x - grid.originX) / grid.cellKm),
    Math.floor((y - grid.originY) / grid.cellKm),
  ];
}

export function indexOf(grid, x, y) {
  const [col, row] = cellOf(grid, x, y);
  return col < 0 || row < 0 || col >= grid.width || row >= grid.height
    ? -1
    : row * grid.width + col;
}

export function isWater(grid, x, y) {
  const index = indexOf(grid, x, y);
  return index >= 0 && grid.water[index] === 1;
}

function rasterizePolygon(land, grid, rings) {
  const starts = new Map();
  let first = grid.height;
  let last = 0;
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i += 1) {
      const [x0, y0] = ring[i];
      const [x1, y1] = ring[(i + 1) % ring.length];
      if (y0 === y1) continue;
      const start = Math.max(
        0,
        Math.ceil((Math.min(y0, y1) - grid.originY) / CELL_KM - 0.5),
      );
      const end = Math.min(
        grid.height,
        Math.ceil((Math.max(y0, y1) - grid.originY) / CELL_KM - 0.5),
      );
      if (start >= end) continue;
      const slope = (x1 - x0) / (y1 - y0);
      const x = x0 + (grid.originY + (start + 0.5) * CELL_KM - y0) * slope;
      if (!starts.has(start)) starts.set(start, []);
      starts.get(start).push({ x, slope, end });
      first = Math.min(first, start);
      last = Math.max(last, end);
    }
  }
  let active = [];
  for (let row = first; row < last; row += 1) {
    active = active.filter((edge) => edge.end > row);
    active.push(...(starts.get(row) ?? []));
    active.sort((a, b) => a.x - b.x);
    for (let i = 0; i + 1 < active.length; i += 2) {
      const from = Math.max(
        0,
        Math.ceil((active[i].x - grid.originX) / CELL_KM - 0.5),
      );
      const to = Math.min(
        grid.width,
        Math.ceil((active[i + 1].x - grid.originX) / CELL_KM - 0.5),
      );
      if (from < to)
        land.fill(1, row * grid.width + from, row * grid.width + to);
    }
    for (const edge of active) edge.x += edge.slope * CELL_KM;
  }
}

function paintLine(grid, points, radiusKm, value, overlay) {
  for (let i = 1; i < points.length; i += 1) {
    const a = project(points[i - 1][0], points[i - 1][1]);
    const b = project(points[i][0], points[i][1]);
    const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) * 2);
    for (let step = 0; step <= steps; step += 1) {
      const x = a.x + ((b.x - a.x) * step) / steps;
      const y = a.y + ((b.y - a.y) * step) / steps;
      const [col, row] = cellOf(grid, x, y);
      const radius = Math.ceil(radiusKm / grid.cellKm);
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if ((dx * dx + dy * dy) * grid.cellKm ** 2 > radiusKm ** 2) continue;
          const c = col + dx;
          const r = row + dy;
          if (c < 0 || r < 0 || c >= grid.width || r >= grid.height) continue;
          const index = r * grid.width + c;
          grid.water[index] = value;
          overlay[index] = 1;
        }
      }
    }
  }
}

export function floodSea(grid, lon, lat) {
  const seed = project(lon, lat);
  const start = indexOf(grid, seed.x, seed.y);
  if (start < 0 || !grid.water[start])
    throw new Error('Ionian Sea flood seed is not water');
  const reached = new Uint8Array(grid.water.length);
  const queue = new Uint32Array(grid.water.length);
  queue[0] = start;
  reached[start] = 1;
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
      if (neighbor < 0 || !grid.water[neighbor] || reached[neighbor]) continue;
      reached[neighbor] = 1;
      queue[tail++] = neighbor;
    }
  }
  grid.water = reached;
  return tail;
}

export function buildGrid(projected, bbox, straits, barriers) {
  const grid = {
    cellKm: CELL_KM,
    originX: bbox[0],
    originY: bbox[1],
    width: Math.ceil((bbox[2] - bbox[0]) / CELL_KM),
    height: Math.ceil((bbox[3] - bbox[1]) / CELL_KM),
  };
  const land = new Uint8Array(grid.width * grid.height);
  for (const feature of projected.features) {
    const geometry = feature.geometry;
    const polygons =
      geometry.type === 'Polygon'
        ? [geometry.coordinates]
        : geometry.coordinates;
    for (const polygon of polygons) rasterizePolygon(land, grid, polygon);
  }
  grid.water = land.map((value) => (value ? 0 : 1));
  const overlay = new Uint8Array(grid.water.length);
  for (const line of Object.values(straits))
    paintLine(grid, line, 3, 1, overlay);
  for (const line of Object.values(barriers))
    paintLine(grid, line, 3, 0, overlay);
  const connected = floodSea(grid, 18.5, 37.5);
  return { grid, overlay, connected };
}

function openSea(grid, index) {
  const col = index % grid.width;
  const row = Math.floor(index / grid.width);
  for (let dy = -OPEN_SEA_RADIUS; dy <= OPEN_SEA_RADIUS; dy += 1) {
    for (let dx = -OPEN_SEA_RADIUS; dx <= OPEN_SEA_RADIUS; dx += 1) {
      if (dx * dx + dy * dy > OPEN_SEA_RADIUS ** 2) continue;
      const c = col + dx;
      const r = row + dy;
      if (
        c < 0 ||
        r < 0 ||
        c >= grid.width ||
        r >= grid.height ||
        !grid.water[r * grid.width + c]
      )
        return false;
    }
  }
  return true;
}

export function anchorPort(grid, lon, lat) {
  const point = project(lon, lat);
  const [originCol, originRow] = cellOf(grid, point.x, point.y);
  let anchor = -1;
  let bestDistance = Infinity;
  for (
    let radius = 0;
    radius < 100 && radius <= Math.sqrt(bestDistance) + 1;
    radius += 1
  ) {
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        const col = originCol + dx;
        const row = originRow + dy;
        if (col < 0 || row < 0 || col >= grid.width || row >= grid.height)
          continue;
        const index = row * grid.width + col;
        const distance =
          (grid.originX + col + 0.5 - point.x) ** 2 +
          (grid.originY + row + 0.5 - point.y) ** 2;
        if (grid.water[index] && distance < bestDistance) {
          anchor = index;
          bestDistance = distance;
        }
      }
    }
  }
  if (anchor < 0) throw new Error(`No connected anchorage near ${lat}, ${lon}`);
  const visited = new Uint8Array(grid.water.length);
  const queue = new Uint32Array(grid.water.length);
  queue[0] = anchor;
  visited[anchor] = 1;
  let head = 0;
  let tail = 1;
  let exit = -1;
  while (head < tail) {
    const index = queue[head++];
    if (openSea(grid, index)) {
      exit = index;
      break;
    }
    const col = index % grid.width;
    const row = Math.floor(index / grid.width);
    for (const neighbor of [
      col > 0 ? index - 1 : -1,
      col + 1 < grid.width ? index + 1 : -1,
      row > 0 ? index - grid.width : -1,
      row + 1 < grid.height ? index + grid.width : -1,
    ]) {
      if (neighbor < 0 || !grid.water[neighbor] || visited[neighbor]) continue;
      visited[neighbor] = 1;
      queue[tail++] = neighbor;
    }
  }
  if (exit < 0) throw new Error(`No open sea exit near ${lat}, ${lon}`);
  const anchorCol = anchor % grid.width;
  const anchorRow = Math.floor(anchor / grid.width);
  const exitCol = exit % grid.width;
  const exitRow = Math.floor(exit / grid.width);
  return {
    anchorage: {
      x: grid.originX + anchorCol + 0.5,
      y: grid.originY + anchorRow + 0.5,
    },
    exitHeading:
      ((Math.atan2(exitCol - anchorCol, anchorRow - exitRow) * 180) / Math.PI +
        360) %
      360,
  };
}

export function encodeGrid(grid) {
  const bytes = Buffer.alloc(HEADER_BYTES + Math.ceil(grid.water.length / 8));
  bytes.write('PVNG', 0, 'ascii');
  bytes.writeUInt16LE(1, 4);
  bytes.writeFloatLE(grid.cellKm, 6);
  bytes.writeUInt32LE(grid.width, 10);
  bytes.writeUInt32LE(grid.height, 14);
  bytes.writeFloatLE(grid.originX, 18);
  bytes.writeFloatLE(grid.originY, 22);
  for (let i = 0; i < grid.water.length; i += 1) {
    if (grid.water[i]) bytes[HEADER_BYTES + (i >> 3)] |= 1 << (i & 7);
  }
  return bytes;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1)
      crc = (crc >>> 1) ^ (-(crc & 1) & 0xedb88320);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const tag = Buffer.from(type, 'ascii');
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  tag.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(
    crc32(chunk.subarray(4, 8 + data.length)),
    8 + data.length,
  );
  return chunk;
}

export function debugPng(grid, overlay, ports) {
  const width = Math.ceil(grid.width / PNG_SCALE);
  const height = Math.ceil(grid.height / PNG_SCALE);
  const pixels = Buffer.alloc(height * (width * 3 + 1));
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const source =
        Math.min(grid.height - 1, row * PNG_SCALE + 2) * grid.width +
        Math.min(grid.width - 1, col * PNG_SCALE + 2);
      const color = overlay[source]
        ? [200, 55, 55]
        : grid.water[source]
          ? [71, 139, 178]
          : [224, 207, 170];
      const offset = row * (width * 3 + 1) + 1 + col * 3;
      pixels[offset] = color[0];
      pixels[offset + 1] = color[1];
      pixels[offset + 2] = color[2];
    }
  }
  for (const port of ports) {
    const [col, row] = cellOf(grid, port.anchorage.x, port.anchorage.y);
    const x = Math.floor(col / PNG_SCALE);
    const y = Math.floor(row / PNG_SCALE);
    for (let dy = -2; dy <= 2; dy += 1)
      for (let dx = -2; dx <= 2; dx += 1) {
        if (
          dx * dx + dy * dy > 4 ||
          x + dx < 0 ||
          y + dy < 0 ||
          x + dx >= width ||
          y + dy >= height
        )
          continue;
        const offset = (y + dy) * (width * 3 + 1) + 1 + (x + dx) * 3;
        pixels[offset] = 255;
        pixels[offset + 1] = 235;
        pixels[offset + 2] = 40;
      }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(pixels)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

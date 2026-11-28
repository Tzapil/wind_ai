import type { NavGrid } from '../types.js';

const HEADER_BYTES = 26;
const MAGIC = 'PVNG';
const VERSION = 1;
const COARSE_FACTOR = 2;

function bitAt(grid: NavGrid, col: number, row: number): boolean {
  if (
    !Number.isInteger(col) ||
    !Number.isInteger(row) ||
    col < 0 ||
    row < 0 ||
    col >= grid.width ||
    row >= grid.height
  )
    return false;
  const index = row * grid.width + col;
  return ((grid.bits[index >> 3] ?? 0) & (1 << (index & 7))) !== 0;
}

/** Converts map kilometres to the containing grid cell. */
export function toCell(
  grid: NavGrid,
  x: number,
  y: number,
): { col: number; row: number } {
  return {
    col: Math.floor((x - grid.originX) / grid.cellKm),
    row: Math.floor((y - grid.originY) / grid.cellKm),
  };
}

/** Returns the map-kilometre centre of a grid cell. */
export function toWorld(
  grid: NavGrid,
  col: number,
  row: number,
): { x: number; y: number } {
  return {
    x: grid.originX + (col + 0.5) * grid.cellKm,
    y: grid.originY + (row + 0.5) * grid.cellKm,
  };
}

/** Reports whether a map point falls in a water cell. */
export function isWater(grid: NavGrid, x: number, y: number): boolean {
  const { col, row } = toCell(grid, x, y);
  return bitAt(grid, col, row);
}

/** Builds a half-resolution search grid; any water in a source block keeps narrow passages open. */
export function buildCoarseGrid(grid: NavGrid): NavGrid {
  const width = Math.ceil(grid.width / COARSE_FACTOR);
  const height = Math.ceil(grid.height / COARSE_FACTOR);
  const bits = new Uint8Array(Math.ceil((width * height) / 8));
  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      let water = false;
      for (let dy = 0; dy < COARSE_FACTOR && !water; dy += 1)
        for (let dx = 0; dx < COARSE_FACTOR; dx += 1)
          if (bitAt(grid, col * COARSE_FACTOR + dx, row * COARSE_FACTOR + dy)) {
            water = true;
            break;
          }
      if (water) {
        const index = row * width + col;
        bits[index >> 3] = (bits[index >> 3] ?? 0) | (1 << (index & 7));
      }
    }
  }
  return {
    cellKm: grid.cellKm * COARSE_FACTOR,
    width,
    height,
    originX: grid.originX,
    originY: grid.originY,
    bits,
  };
}

/** Parses the versioned binary grid and builds its 2 km path-search grid once. */
export function parseNavGrid(bytes: Uint8Array): NavGrid {
  if (bytes.byteLength < HEADER_BYTES)
    throw new RangeError('NavGrid header is truncated');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = String.fromCharCode(...bytes.subarray(0, 4));
  if (magic !== MAGIC) throw new RangeError('Invalid NavGrid magic');
  if (view.getUint16(4, true) !== VERSION)
    throw new RangeError('Unsupported NavGrid version');
  const cellKm = view.getFloat32(6, true);
  const width = view.getUint32(10, true);
  const height = view.getUint32(14, true);
  const originX = view.getFloat32(18, true);
  const originY = view.getFloat32(22, true);
  if (
    !Number.isFinite(cellKm) ||
    cellKm <= 0 ||
    !Number.isFinite(originX) ||
    !Number.isFinite(originY) ||
    width === 0 ||
    height === 0 ||
    !Number.isSafeInteger(width * height)
  )
    throw new RangeError('Invalid NavGrid dimensions or coordinates');
  const bitBytes = Math.ceil((width * height) / 8);
  if (bytes.byteLength !== HEADER_BYTES + bitBytes)
    throw new RangeError('Invalid NavGrid payload length');
  const grid: NavGrid = {
    cellKm,
    width,
    height,
    originX,
    originY,
    bits: bytes.slice(HEADER_BYTES),
  };
  grid.pathGrid = buildCoarseGrid(grid);
  return grid;
}

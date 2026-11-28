import type { NavGrid } from '../types.js';
import { realDistance, scaleAt, type MapPoint } from '../util/geo.js';
import { isWater, toCell, toWorld } from './navgrid.js';

const SQRT2 = Math.SQRT2;
const LAND_TARGET_RADIUS_KM = 20;
const SEARCH_PADDING_CELLS = 25;
const NEIGHBORS = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
] as const;

function bit(grid: NavGrid, col: number, row: number): boolean {
  if (col < 0 || row < 0 || col >= grid.width || row >= grid.height)
    return false;
  const index = row * grid.width + col;
  return ((grid.bits[index >> 3] ?? 0) & (1 << (index & 7))) !== 0;
}

function clearWithMargin(
  grid: NavGrid,
  col: number,
  row: number,
  margin: number,
): boolean {
  for (let yy = row - margin; yy <= row + margin; yy += 1)
    for (let xx = col - margin; xx <= col + margin; xx += 1)
      if (!bit(grid, xx, yy)) return false;
  return true;
}

/** Checks a segment against every crossed 1 km cell, including corner contacts. */
export function hasLineOfSight(
  grid: NavGrid,
  a: MapPoint,
  b: MapPoint,
  margin = 1,
): boolean {
  let x = Math.floor((a.x - grid.originX) / grid.cellKm);
  let y = Math.floor((a.y - grid.originY) / grid.cellKm);
  const endX = Math.floor((b.x - grid.originX) / grid.cellKm);
  const endY = Math.floor((b.y - grid.originY) / grid.cellKm);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const stepX = Math.sign(dx);
  const stepY = Math.sign(dy);
  const cell = grid.cellKm;
  const nextX = grid.originX + (x + (stepX > 0 ? 1 : 0)) * cell;
  const nextY = grid.originY + (y + (stepY > 0 ? 1 : 0)) * cell;
  let tX = stepX === 0 ? Infinity : (nextX - a.x) / dx;
  let tY = stepY === 0 ? Infinity : (nextY - a.y) / dy;
  const deltaX = stepX === 0 ? Infinity : cell / Math.abs(dx);
  const deltaY = stepY === 0 ? Infinity : cell / Math.abs(dy);
  if (!(margin === 0 ? bit(grid, x, y) : clearWithMargin(grid, x, y, margin)))
    return false;
  while (x !== endX || y !== endY) {
    if (tX < tY) {
      x += stepX;
      tX += deltaX;
    } else if (tY < tX) {
      y += stepY;
      tY += deltaY;
    } else {
      if (
        !(margin === 0
          ? bit(grid, x + stepX, y)
          : clearWithMargin(grid, x + stepX, y, margin)) ||
        !(margin === 0
          ? bit(grid, x, y + stepY)
          : clearWithMargin(grid, x, y + stepY, margin))
      )
        return false;
      x += stepX;
      y += stepY;
      tX += deltaX;
      tY += deltaY;
    }
    if (!(margin === 0 ? bit(grid, x, y) : clearWithMargin(grid, x, y, margin)))
      return false;
    if (x === endX) tX = Infinity;
    if (y === endY) tY = Infinity;
  }
  return true;
}

function nearestWater(grid: NavGrid, target: MapPoint): MapPoint | null {
  if (isWater(grid, target.x, target.y)) return target;
  const centre = toCell(grid, target.x, target.y);
  const radius = Math.ceil(
    LAND_TARGET_RADIUS_KM / (grid.cellKm * scaleAt(target.y)),
  );
  let best: MapPoint | null = null;
  let distance = LAND_TARGET_RADIUS_KM;
  for (let row = centre.row - radius; row <= centre.row + radius; row += 1) {
    for (let col = centre.col - radius; col <= centre.col + radius; col += 1) {
      if (!bit(grid, col, row)) continue;
      const candidate = toWorld(grid, col, row);
      const d = realDistance(target, candidate);
      if (d < distance) {
        distance = d;
        best = candidate;
      }
    }
  }
  return best;
}

interface RouteResult {
  waypoints: MapPoint[];
  distanceKm: number;
}

function searchRoute(
  grid: NavGrid,
  start: MapPoint,
  destination: MapPoint,
  padding: number,
  weight: number,
): RouteResult | null {
  if (
    !Number.isFinite(start.x) ||
    !Number.isFinite(start.y) ||
    !Number.isFinite(destination.x) ||
    !Number.isFinite(destination.y) ||
    !isWater(grid, start.x, start.y)
  )
    return null;
  const goal = nearestWater(grid, destination);
  if (!goal) return null;
  if (hasLineOfSight(grid, start, goal, 0))
    return { waypoints: [goal], distanceKm: realDistance(start, goal) };

  const coarse = grid.pathGrid;
  if (!coarse) throw new RangeError('NavGrid pathGrid is required');
  const connector = (point: MapPoint): { col: number; row: number } | null => {
    const cell = toCell(coarse, point.x, point.y);
    let best: { col: number; row: number } | null = null;
    let bestDistance = Infinity;
    for (let radius = 0; radius <= 8; radius += 1) {
      for (let row = cell.row - radius; row <= cell.row + radius; row += 1) {
        for (let col = cell.col - radius; col <= cell.col + radius; col += 1) {
          if (
            Math.max(Math.abs(col - cell.col), Math.abs(row - cell.row)) !==
              radius ||
            !bit(coarse, col, row)
          )
            continue;
          const candidate = toWorld(coarse, col, row);
          const distance = realDistance(point, candidate);
          if (
            distance < bestDistance &&
            hasLineOfSight(grid, point, candidate, 0)
          ) {
            best = { col, row };
            bestDistance = distance;
          }
        }
      }
      if (best) return best;
    }
    return null;
  };
  const startCell = connector(start);
  const goalCell = connector(goal);
  if (!startCell || !goalCell) return null;
  const minCol = Math.max(0, Math.min(startCell.col, goalCell.col) - padding);
  const maxCol = Math.min(
    coarse.width - 1,
    Math.max(startCell.col, goalCell.col) + padding,
  );
  const minRow = Math.max(0, Math.min(startCell.row, goalCell.row) - padding);
  const maxRow = Math.min(
    coarse.height - 1,
    Math.max(startCell.row, goalCell.row) + padding,
  );
  const width = maxCol - minCol + 1;
  const height = maxRow - minRow + 1;
  const count = width * height;
  const rowScale = new Float64Array(height);
  for (let row = 0; row < height; row += 1)
    rowScale[row] = scaleAt(
      coarse.originY + (minRow + row + 0.5) * coarse.cellKm,
    );
  const startIndex = (startCell.row - minRow) * width + startCell.col - minCol;
  const goalIndex = (goalCell.row - minRow) * width + goalCell.col - minCol;
  const g = new Float32Array(count);
  g.fill(Infinity);
  const f = new Float32Array(count);
  const parent = new Int32Array(count);
  parent.fill(-1);
  const positions = new Int32Array(count);
  const closed = new Uint8Array(count);
  const heap = new Int32Array(count + 1);
  let length = 0;
  const southScale = Math.max(
    scaleAt(coarse.originY),
    scaleAt(coarse.originY + coarse.height * coarse.cellKm),
  );
  const heuristic = (index: number): number => {
    const x = Math.abs((index % width) + minCol - goalCell.col);
    const y = Math.abs(Math.floor(index / width) + minRow - goalCell.row);
    return (
      (Math.max(x, y) + (SQRT2 - 1) * Math.min(x, y)) *
      coarse.cellKm *
      southScale *
      weight
    );
  };
  const score = (index: number): number => f[index]!;
  const swap = (a: number, b: number): void => {
    const ai = heap[a]!;
    const bi = heap[b]!;
    heap[a] = bi;
    heap[b] = ai;
    positions[ai] = b;
    positions[bi] = a;
  };
  const push = (index: number): void => {
    let pos = ++length;
    heap[pos] = index;
    positions[index] = pos;
    while (pos > 1 && score(heap[pos]!) < score(heap[pos >> 1]!)) {
      swap(pos, pos >> 1);
      pos >>= 1;
    }
  };
  const pop = (): number => {
    const top = heap[1]!;
    swap(1, length);
    positions[top] = 0;
    length -= 1;
    let pos = 1;
    while (pos * 2 <= length) {
      let child = pos * 2;
      if (child < length && score(heap[child + 1]!) < score(heap[child]!))
        child += 1;
      if (score(heap[pos]!) <= score(heap[child]!)) break;
      swap(pos, child);
      pos = child;
    }
    return top;
  };
  const lower = (index: number): void => {
    let pos = positions[index]!;
    while (pos > 1 && score(heap[pos]!) < score(heap[pos >> 1]!)) {
      swap(pos, pos >> 1);
      pos >>= 1;
    }
  };
  g[startIndex] = 0;
  f[startIndex] = heuristic(startIndex);
  push(startIndex);
  let reached = false;
  while (length > 0) {
    const current = pop();
    if (current === goalIndex) {
      reached = true;
      break;
    }
    closed[current] = 1;
    const col = (current % width) + minCol;
    const row = Math.floor(current / width) + minRow;
    for (const [dx, dy] of NEIGHBORS) {
      const nx = col + dx;
      const ny = row + dy;
      if (
        nx < minCol ||
        nx > maxCol ||
        ny < minRow ||
        ny > maxRow ||
        !bit(coarse, nx, ny)
      )
        continue;
      const neighbor = (ny - minRow) * width + nx - minCol;
      if (closed[neighbor]) continue;
      const cost =
        (dx === 0 || dy === 0 ? 1 : SQRT2) *
        coarse.cellKm *
        rowScale[ny - minRow]!;
      const next = g[current]! + cost;
      if (next >= g[neighbor]!) continue;
      // Coarse cells are permissive; the fine grid decides whether this edge is safe.
      const to = {
        x: coarse.originX + (nx + 0.5) * coarse.cellKm,
        y: coarse.originY + (ny + 0.5) * coarse.cellKm,
      };
      const from = {
        x: coarse.originX + (col + 0.5) * coarse.cellKm,
        y: coarse.originY + (row + 0.5) * coarse.cellKm,
      };
      if (!hasLineOfSight(grid, from, to, 0)) continue;
      g[neighbor] = next;
      f[neighbor] = next + heuristic(neighbor);
      parent[neighbor] = current;
      if (positions[neighbor]) lower(neighbor);
      else push(neighbor);
    }
  }
  if (!reached) {
    const nextPadding = Math.min(
      padding * 2,
      Math.max(coarse.width, coarse.height),
    );
    return nextPadding > padding
      ? searchRoute(grid, start, destination, nextPadding, weight)
      : null;
  }
  const indices: number[] = [];
  for (let at = goalIndex; at !== -1; at = parent[at]!) indices.push(at);
  indices.reverse();
  const raw = [
    start,
    ...indices.map((at) =>
      toWorld(coarse, (at % width) + minCol, Math.floor(at / width) + minRow),
    ),
    goal,
  ];
  const waypoints: MapPoint[] = [];
  let anchor = 0;
  while (anchor < raw.length - 1) {
    let next = anchor + 1;
    while (
      next + 1 < raw.length &&
      hasLineOfSight(grid, raw[anchor]!, raw[next + 1]!, 1)
    )
      next += 1;
    if (!hasLineOfSight(grid, raw[anchor]!, raw[next]!, 0)) return null;
    waypoints.push(raw[next]!);
    anchor = next;
  }
  let distanceKm = 0;
  let previous = start;
  for (const point of waypoints) {
    distanceKm += realDistance(previous, point);
    previous = point;
  }
  return { waypoints, distanceKm };
}

/** Finds a water-only route with weighted A* on the 2 km grid and 1 km visibility smoothing. */
export function findRoute(
  grid: NavGrid,
  start: MapPoint,
  destination: MapPoint,
): RouteResult | null {
  return searchRoute(grid, start, destination, SEARCH_PADDING_CELLS, 1.2);
}

/** Dijkstra reference used to check the weighted search's route quality. */
export function findReferenceRoute(
  grid: NavGrid,
  start: MapPoint,
  destination: MapPoint,
): RouteResult | null {
  return searchRoute(grid, start, destination, SEARCH_PADDING_CELLS, 0);
}

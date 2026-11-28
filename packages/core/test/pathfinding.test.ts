import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import ports from '../../client/public/data/ports.json';
import { isWater, parseNavGrid, toCell, toWorld } from '../src/nav/navgrid.js';
import {
  findReferenceRoute,
  findRoute,
  hasLineOfSight,
} from '../src/nav/pathfinding.js';
import { step } from '../src/step.js';
import { createWorld } from '../src/world.js';
import type { GameData } from '../src/types.js';
import { project, realDistance } from '../src/util/geo.js';
import goods from '../../client/public/data/goods.json';
import ship from '../../client/public/data/ship.json';
import wind from '../../client/public/data/wind.json';
import balance from '../../client/public/data/balance.json';
import {
  BalanceSchema,
  GoodDefSchema,
  PortDefSchema,
  ShipDefSchema,
  WindDefSchema,
} from '../src/data/schemas.js';

const binary = await readFile(
  new URL('../../client/public/data/navgrid.bin', import.meta.url),
);
const grid = parseNavGrid(binary);
const points = ports.map((port) => ({ id: port.id, ...port.anchorage }));

describe('pathfinding', () => {
  it('finds water-only routes for all ten port pairs', () => {
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const from = points[i]!;
        const to = points[j]!;
        const route = findRoute(
          grid,
          { x: from.x, y: from.y },
          { x: to.x, y: to.y },
        );
        const reference = findReferenceRoute(
          grid,
          { x: from.x, y: from.y },
          { x: to.x, y: to.y },
        );
        expect(route, `${from.id} -> ${to.id}`).not.toBeNull();
        expect(
          reference,
          `${from.id} -> ${to.id} Dijkstra reference`,
        ).not.toBeNull();
        if (!route) continue;
        expect(route.distanceKm).toBeLessThanOrEqual(
          reference!.distanceKm * 1.08,
        );
        expect(route.waypoints.length).toBeGreaterThan(0);
        expect(route.waypoints.at(-1)).toEqual({ x: to.x, y: to.y });
        let previous = from;
        for (const waypoint of route.waypoints) {
          expect(
            hasLineOfSight(grid, previous, waypoint, 0),
            `${from.id} -> ${to.id}`,
          ).toBe(true);
          previous = { ...waypoint, id: '' };
        }
      }
    }
  }, 120_000);

  it('snaps a coastal land target and rejects deep inland', () => {
    const from = points.find((point) => point.id === 'athens')!;
    const startCell = toCell(grid, from.x, from.y);
    let coast: { x: number; y: number } | null = null;
    for (
      let row = startCell.row - 8;
      row <= startCell.row + 8 && !coast;
      row += 1
    ) {
      for (let col = startCell.col - 8; col <= startCell.col + 8; col += 1) {
        const point = toWorld(grid, col, row);
        if (
          !isWater(grid, point.x, point.y) &&
          realDistance(from, point) <= 5
        ) {
          coast = point;
          break;
        }
      }
    }
    expect(coast).not.toBeNull();
    const inland = project(30, 39);
    expect(findRoute(grid, from, coast!)).not.toBeNull();
    expect(findRoute(grid, from, inland)).toBeNull();
  }, 30_000);

  it('emits route events and leaves the old route untouched when unreachable', () => {
    const data: GameData = {
      goods: goods.map((good) => GoodDefSchema.parse(good)),
      ports: ports.map((port) => PortDefSchema.parse(port)),
      ships: [ShipDefSchema.parse(ship)],
      wind: WindDefSchema.parse(wind),
      balance: BalanceSchema.parse(balance),
      nav: grid,
    };
    const world = createWorld(data, { seed: 1, playerName: 'Captain' });
    world.player.location = { kind: 'sea' };
    expect(
      step(world, [{ type: 'SetCourseToPort', portId: 'venice' }], data),
    ).toContainEqual(expect.objectContaining({ type: 'CourseSet' }));
    expect(world.player.ship.routePortId).toBe('venice');
    const route = structuredClone(world.player.ship.route);
    expect(
      step(world, [{ type: 'SetCourseToPoint', ...project(30, 39) }], data),
    ).toContainEqual({ type: 'CourseUnreachable' });
    expect(world.player.ship.route).toEqual(route);
    expect(
      step(world, [{ type: 'SetCourseToPort', portId: 'missing' }], data),
    ).toContainEqual({
      type: 'CommandRejected',
      command: 'SetCourseToPort',
      reason: 'unknown_port',
    });
  }, 30_000);
});

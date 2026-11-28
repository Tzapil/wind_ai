import { describe, expect, it } from 'vitest';
import {
  BalanceSchema,
  GoodDefSchema,
  PortDefSchema,
  ShipDefSchema,
  WindDefSchema,
} from '../src/data/schemas';
import { createWorld } from '../src/world';
import { step } from '../src/step';
import type { GameData } from '../src/types';
import {
  angleDifference,
  clamp,
  lerp,
  lerpAngle,
  normalizeAngle,
} from '../src/util/math';
import { hashState } from '../src/util/hash';
import {
  chance,
  int,
  next,
  normal,
  seedStream,
  uniform,
} from '../src/util/rng';
import goods from '../../../packages/client/public/data/goods.json';
import ports from '../../../packages/client/public/data/ports.json';
import ship from '../../../packages/client/public/data/ship.json';
import wind from '../../../packages/client/public/data/wind.json';
import balance from '../../../packages/client/public/data/balance.json';

const data: GameData = {
  goods: goods.map((good) => GoodDefSchema.parse(good)),
  ports: ports.map((port) => PortDefSchema.parse(port)),
  ships: [ShipDefSchema.parse(ship)],
  wind: WindDefSchema.parse(wind),
  balance: BalanceSchema.parse(balance),
  nav: {
    cellKm: 1,
    width: 1,
    height: 1,
    originX: 0,
    originY: 0,
    bits: new Uint8Array([1]),
  },
};

describe('simulation scaffold', () => {
  it('emits DayStarted only at midnight', () => {
    const world = createWorld(data, { seed: 42, playerName: 'Captain' });
    for (let tick = world.tick + 1; tick < 600; tick += 1) {
      expect(step(world, [], data)).toEqual([]);
    }
    expect(world.tick).toBe(599);
    expect(step(world, [], data)).toContainEqual({
      type: 'DayStarted',
      day: 1,
    });
    for (let tick = world.tick + 1; tick < 1200; tick += 1) {
      expect(
        step(world, [], data).some((event) => event.type === 'DayStarted'),
      ).toBe(false);
    }
    expect(step(world, [], data)).toContainEqual({
      type: 'DayStarted',
      day: 2,
    });
  });

  it('creates a complete initial world from authored start values', () => {
    const world = createWorld(data, { seed: 42, playerName: 'Captain' });
    const athens = data.ports.find(
      (port) => port.id === data.balance.startPortId,
    )!;
    expect(world.schemaVersion).toBe(1);
    expect(world.tick).toBe(200);
    expect(world.player).toMatchObject({
      name: 'Captain',
      silver: 1000,
      location: { kind: 'port', portId: 'athens' },
      ship: {
        typeId: 'tartane',
        x: athens.anchorage.x,
        y: athens.anchorage.y,
        heading: athens.exitHeading,
        crew: 8,
        provisions: 10,
        morale: 100,
      },
    });
    expect(Object.keys(world.ports)).toHaveLength(5);
    expect(Object.keys(world.ports.athens!.market)).toHaveLength(10);
    expect(world.ports.athens!.market.wine!.stock).toBeGreaterThanOrEqual(320);
    expect(world.ports.athens!.market.wine!.stock).toBeLessThanOrEqual(480);
    expect(world.stats).toEqual({
      voyages: [],
      totalProfit: 0,
      tradesCount: 0,
    });
    expect(createWorld(data, { seed: 42, playerName: 'Captain' })).toEqual(
      world,
    );
  });

  it('advances one tick and rejects invalid commands without changing their target', () => {
    const world = createWorld(data, { seed: 42, playerName: 'Captain' });
    const initialSilver = world.player.silver;
    expect(
      step(
        world,
        [
          { type: 'BuyProvisions', qty: 0 },
          { type: 'SetSails', level: 1 },
          { type: 'DevAddSilver', amount: 100 },
        ],
        data,
      ),
    ).toEqual([
      {
        type: 'CommandRejected',
        command: 'BuyProvisions',
        reason: 'invalid_qty',
      },
      {
        type: 'CommandRejected',
        command: 'DevAddSilver',
        reason: 'dev_disabled',
      },
    ]);
    expect(world.tick).toBe(201);
    expect(world.player.silver).toBe(initialSilver);
    expect(world.player.ship.sails).toBe(1);
    expect(step(world, [], data)).toEqual([]);
    expect(world.tick).toBe(202);
  });

  it('rejects valid commands whose systems have not been added', () => {
    const world = createWorld(data, { seed: 7, playerName: 'Captain' });
    expect(
      step(
        world,
        [
          { type: 'SetCourseToPort', portId: 'missing' },
          { type: 'SetCourseToPort', portId: 'venice' },
          { type: 'BuyGoods', goodId: 'unknown', qty: 1 },
        ],
        data,
      ),
    ).toEqual([
      {
        type: 'CommandRejected',
        command: 'SetCourseToPort',
        reason: 'unknown_port',
      },
      {
        type: 'CommandRejected',
        command: 'SetCourseToPort',
        reason: 'not_implemented',
      },
      { type: 'CommandRejected', command: 'BuyGoods', reason: 'unknown_good' },
    ]);
  });
});

describe('PRNG streams', () => {
  it('repeats the same sequence for a seed and separates named streams', () => {
    const first = seedStream(123, 'market');
    const second = seedStream(123, 'market');
    expect(Array.from({ length: 10 }, () => next(first))).toEqual(
      Array.from({ length: 10 }, () => next(second)),
    );
    expect(seedStream(123, 'market')).not.toEqual(seedStream(123, 'wind'));
    const wind = seedStream(123, 'wind');
    const market = seedStream(123, 'market');
    next(wind);
    expect(next(market)).toBe(next(seedStream(123, 'market')));
  });

  it('keeps helper draws in their expected ranges', () => {
    const rng = seedStream(8, 'misc');
    for (let i = 0; i < 100; i += 1) {
      expect(uniform(rng, -2, 3)).toBeGreaterThanOrEqual(-2);
      expect(int(rng, 1, 3)).toBeGreaterThanOrEqual(1);
      expect(int(rng, 1, 3)).toBeLessThanOrEqual(3);
      expect(Number.isFinite(normal(rng, 0, 1))).toBe(true);
    }
    expect(chance(rng, 0)).toBe(false);
    expect(chance(rng, 1)).toBe(true);
  });
});

describe('canonical hash and angles', () => {
  it('ignores object key order at every depth, while retaining array order', () => {
    expect(hashState({ b: { y: 2, x: 1 }, a: [1, 2] })).toBe(
      hashState({ a: [1, 2], b: { x: 1, y: 2 } }),
    );
    expect(hashState({ a: [1, 2] })).not.toBe(hashState({ a: [2, 1] }));
    expect(hashState({ name: 'Афины' })).toMatch(/^[0-9a-f]{16}$/);
  });

  it('handles the 359° to 1° boundary', () => {
    expect(normalizeAngle(-1)).toBe(359);
    expect(normalizeAngle(361)).toBe(1);
    expect(angleDifference(359, 1)).toBe(2);
    expect(angleDifference(1, 359)).toBe(-2);
    expect(lerpAngle(359, 1, 0.5)).toBe(0);
    expect(lerpAngle(1, 359, 0.5)).toBe(0);
    expect(clamp(5, 0, 3)).toBe(3);
    expect(lerp(2, 6, 0.5)).toBe(4);
  });
});

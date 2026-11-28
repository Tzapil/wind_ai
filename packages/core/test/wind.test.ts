import { describe, expect, it } from 'vitest';
import {
  BalanceSchema,
  GoodDefSchema,
  PortDefSchema,
  ShipDefSchema,
  WindDefSchema,
  angleDifference,
  createWorld,
  pointOfSailMultiplier,
  step,
  windAt,
  type GameData,
  type GameEvent,
} from '../src/index';
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

describe('regional wind', () => {
  it('turns from 350° to 10° through north in 50 ticks', () => {
    const world = createWorld(data, { seed: 1, playerName: 'Captain' });
    const aegean = world.wind.regions.aegean!;
    aegean.fromDeg = 350;
    aegean.targetFromDeg = 10;
    aegean.transitionLeft = data.wind.transitionTicks;
    for (let tick = 0; tick < 25; tick += 1) step(world, [], data);
    expect(Math.abs(angleDifference(aegean.fromDeg, 0))).toBeLessThan(1e-10);
    let lastEvents: GameEvent[] = [];
    for (let tick = 0; tick < 25; tick += 1) lastEvents = step(world, [], data);
    expect(aegean.fromDeg).toBe(10);
    expect(aegean.transitionLeft).toBe(0);
    expect(lastEvents).toContainEqual({
      type: 'WindChanged',
      regionId: 'aegean',
      fromDeg: 10,
    });
  });

  it('samples a new target only at a scheduled day boundary', () => {
    const world = createWorld(data, { seed: 7, playerName: 'Captain' });
    const aegean = world.wind.regions.aegean!;
    aegean.nextChangeDay = 1;
    const initialTarget = aegean.targetFromDeg;
    while (world.tick < 599) step(world, [], data);
    expect(aegean.targetFromDeg).toBe(initialTarget);
    step(world, [], data);
    expect(aegean.nextChangeDay).toBeGreaterThanOrEqual(2);
    expect(aegean.nextChangeDay).toBeLessThanOrEqual(4);
    expect(aegean.transitionLeft).toBe(data.wind.transitionTicks - 1);
    expect(aegean.targetFromDeg).not.toBe(initialTarget);
  });

  it('weights regional vectors and stays near the wind at each region center', () => {
    const world = createWorld(data, { seed: 2, playerName: 'Captain' });
    for (const region of data.wind.regions) {
      const local = windAt(world, data, region.x, region.y);
      expect(
        Math.abs(angleDifference(region.prevailingFromDeg, local)),
        region.id,
      ).toBeLessThan(15);
    }
  });

  it.each([
    [0, 0.15],
    [37.5, 0.375],
    [90, 0.85],
    [135, 1],
    [180, 0.9],
  ])('interpolates the wind curve at %d°', (theta, expected) => {
    expect(pointOfSailMultiplier(theta, data.balance)).toBeCloseTo(expected);
  });

  it('keeps every regional direction inside its authored spread for 100 days', () => {
    const world = createWorld(data, { seed: 42, playerName: 'Captain' });
    const endTick = world.tick + 100 * 600;
    while (world.tick < endTick) {
      step(world, [], data);
      for (const region of data.wind.regions) {
        const current = world.wind.regions[region.id]!;
        expect(
          Math.abs(angleDifference(region.prevailingFromDeg, current.fromDeg)),
        ).toBeLessThanOrEqual(region.spreadDeg + 1e-10);
      }
    }
  });
});

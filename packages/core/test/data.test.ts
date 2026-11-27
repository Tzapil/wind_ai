import { describe, expect, it } from 'vitest';
import { SourceGameDataSchema } from '../src/data/schemas';
import goods from '../../../data/goods.json';
import ports from '../../../data/ports.json';
import ship from '../../../data/ship.json';
import wind from '../../../data/wind.json';
import balance from '../../../data/balance.json';

const validData = { goods, ports, ship, wind, balance };

function modified(change: (data: typeof validData) => void): typeof validData {
  const copy = structuredClone(validData);
  change(copy);
  return copy;
}

describe('source game data', () => {
  it('accepts all authored data', () => {
    expect(SourceGameDataSchema.safeParse(validData).success).toBe(true);
  });

  it.each([
    [
      'nonpositive base price',
      (data: typeof validData) => {
        data.goods[0]!.basePrice = 0;
      },
    ],
    [
      'nonpositive market target',
      (data: typeof validData) => {
        data.ports[0]!.market.grain!.target = 0;
      },
    ],
    [
      'missing good in a port',
      (data: typeof validData) => {
        delete (data.ports[0]!.market as Record<string, unknown>).grain;
      },
    ],
    [
      'good sold nowhere',
      (data: typeof validData) => {
        for (const port of data.ports) port.market.wine!.sells = false;
      },
    ],
    [
      'unknown start port',
      (data: typeof validData) => {
        data.balance.startPortId = 'missing';
      },
    ],
  ])('rejects %s', (_label, change) => {
    expect(SourceGameDataSchema.safeParse(modified(change)).success).toBe(
      false,
    );
  });
});

import { z } from 'zod';

const id = z.string().min(1);
const whole = z.number().int().nonnegative();
const positive = z.number().int().positive();
const fraction = z.number().finite().min(0).max(1);
const pair = z.tuple([z.number().finite(), z.number().finite()]);
const latitude = z.number().finite().min(-90).max(90);
const longitude = z.number().finite().min(-180).max(180);

export const GoodDefSchema = z.strictObject({
  id,
  category: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  basePrice: positive,
  weight: z.literal(1),
});

const marketEntry = z.strictObject({
  role: z.enum(['producer', 'neutral', 'consumer']),
  target: positive,
  sells: z.boolean(),
});

export const SourcePortDefSchema = z.strictObject({
  id,
  lat: latitude,
  lon: longitude,
  anchorage: z
    .strictObject({ x: z.number().finite(), y: z.number().finite() })
    .optional(),
  exitHeading: z.number().finite().min(0).lt(360).optional(),
  nation: z.enum([
    'neutral',
    'italian',
    'spanish',
    'french',
    'portuguese',
    'ottoman',
  ]),
  provisionPrice: positive,
  crewHirePrice: positive,
  market: z.record(id, marketEntry),
});

export const PortDefSchema = SourcePortDefSchema.safeExtend({
  anchorage: z.strictObject({ x: z.number().finite(), y: z.number().finite() }),
  exitHeading: z.number().finite().min(0).lt(360),
});

export const ShipDefSchema = z
  .strictObject({
    id,
    vmaxKn: z.number().finite().positive(),
    hold: positive,
    crewMin: positive,
    crewMax: positive,
    turnDegPerTick: z.number().finite().positive(),
    hull: positive,
    sailHp: positive,
    gunsPerSide: whole,
  })
  .refine((ship) => ship.crewMax >= ship.crewMin, {
    message: 'crewMax must be at least crewMin',
    path: ['crewMax'],
  });

const sourceRegion = z.strictObject({
  id,
  lat: latitude,
  lon: longitude,
  prevailingFromDeg: z.number().finite().min(0).lt(360),
  spreadDeg: z.number().finite().min(0).max(180),
});

export const SourceWindDefSchema = z.strictObject({
  regions: z.array(sourceRegion).min(1),
  changeEveryDays: z.tuple([positive, positive]),
  transitionTicks: positive,
});

export const WindDefSchema = SourceWindDefSchema.safeExtend({
  regions: z
    .array(
      sourceRegion.extend({
        x: z.number().finite(),
        y: z.number().finite(),
      }),
    )
    .min(1),
});

export const BalanceSchema = z.strictObject({
  startPortId: id,
  startSilver: whole,
  startCrew: positive,
  startProvisions: whole,
  startMorale: whole,
  goalSilver: positive,
  duty: fraction,
  sellFactor: fraction,
  batchSize: positive,
  roleMul: z.strictObject({
    producer: z.number().finite().positive(),
    neutral: z.number().finite().positive(),
    consumer: z.number().finite().positive(),
  }),
  deficitClamp: pair,
  restockRate: fraction,
  noise: z.strictObject({
    chance: fraction,
    amplitude: fraction,
    shockChance: fraction,
    shockLow: pair,
    shockHigh: pair,
  }),
  initialStockSpread: pair,
  windCurve: z.array(pair).min(2),
  crewCurveExponent: z.number().finite().positive(),
  crewBelowMinFactor: fraction,
  overload: z.strictObject({ freeUntil: fraction, minFactor: fraction }),
  starvingSpeedFactor: fraction,
  inertia: fraction,
  portEnterRadiusKm: z.number().finite().positive(),
  waypointRadiusKm: z.number().finite().positive(),
  tacking: z.strictObject({
    triggerDeg: z.number().finite().positive(),
    tackDeg: z.number().finite().positive(),
    maxOffsetKm: z.number().finite().positive(),
    coastLookaheadKm: z.number().finite().positive(),
  }),
  provisionsPerTickUnit: positive,
  starvingMoralePerDay: positive,
  desertionRatePerDay: fraction,
  provisionSellFactor: fraction,
  voyageProvisionReserve: fraction,
});

export const SourceGameDataSchema = z
  .strictObject({
    goods: z.array(GoodDefSchema).min(1),
    ports: z.array(SourcePortDefSchema).min(1),
    ship: ShipDefSchema,
    wind: SourceWindDefSchema,
    balance: BalanceSchema,
  })
  .superRefine((data, ctx) => {
    const goodIds = new Set<string>();
    for (const [index, good] of data.goods.entries()) {
      if (goodIds.has(good.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['goods', index, 'id'],
          message: 'duplicate good id',
        });
      }
      goodIds.add(good.id);
    }
    const portIds = new Set<string>();
    for (const [index, port] of data.ports.entries()) {
      if (portIds.has(port.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['ports', index, 'id'],
          message: 'duplicate port id',
        });
      }
      portIds.add(port.id);
      for (const goodId of goodIds) {
        if (!(goodId in port.market)) {
          ctx.addIssue({
            code: 'custom',
            path: ['ports', index, 'market', goodId],
            message: 'missing good',
          });
        }
      }
      for (const marketGoodId of Object.keys(port.market)) {
        if (!goodIds.has(marketGoodId)) {
          ctx.addIssue({
            code: 'custom',
            path: ['ports', index, 'market', marketGoodId],
            message: 'unknown good',
          });
        }
      }
    }
    for (const goodId of goodIds) {
      if (!data.ports.some((port) => port.market[goodId]?.sells)) {
        ctx.addIssue({
          code: 'custom',
          path: ['goods', goodId],
          message: 'no port sells this good',
        });
      }
    }
    if (!portIds.has(data.balance.startPortId)) {
      ctx.addIssue({
        code: 'custom',
        path: ['balance', 'startPortId'],
        message: 'unknown start port',
      });
    }
    if (
      data.balance.startCrew > data.ship.crewMax ||
      data.balance.startCrew < data.ship.crewMin
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['balance', 'startCrew'],
        message: 'starting crew outside ship limits',
      });
    }
    if (data.balance.startProvisions > data.ship.hold) {
      ctx.addIssue({
        code: 'custom',
        path: ['balance', 'startProvisions'],
        message: 'starting provisions exceed hold',
      });
    }
  });

export type GoodDef = z.infer<typeof GoodDefSchema>;
export type SourcePortDef = z.infer<typeof SourcePortDefSchema>;
export type PortDef = z.infer<typeof PortDefSchema>;
export type ShipDef = z.infer<typeof ShipDefSchema>;
export type SourceWindDef = z.infer<typeof SourceWindDefSchema>;
export type WindDef = z.infer<typeof WindDefSchema>;
export type Balance = z.infer<typeof BalanceSchema>;

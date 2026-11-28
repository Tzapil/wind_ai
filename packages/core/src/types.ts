import type {
  Balance,
  GoodDef,
  PortDef,
  ShipDef,
  WindDef,
} from './data/schemas.js';

export type GoodId = string;
export type PortId = string;
export type RngState = [number, number, number, number];

export interface NavGrid {
  cellKm: number;
  width: number;
  height: number;
  originX: number;
  originY: number;
  bits: Uint8Array;
  pathGrid?: NavGrid;
}

export interface GameData {
  goods: GoodDef[];
  ports: PortDef[];
  ships: ShipDef[];
  wind: WindDef;
  balance: Balance;
  nav: NavGrid;
}

export interface WorldState {
  schemaVersion: 1;
  seed: number;
  tick: number;
  rng: { wind: RngState; market: RngState; misc: RngState };
  wind: {
    regions: Record<
      string,
      {
        fromDeg: number;
        targetFromDeg: number;
        transitionLeft: number;
        nextChangeDay: number;
      }
    >;
  };
  ports: Record<
    PortId,
    {
      market: Record<
        GoodId,
        { stock: number; target: number; history: number[] }
      >;
    }
  >;
  player: PlayerState;
  goals: { pinnaceSavingsReached: boolean };
  stats: Stats;
}

export interface PlayerState {
  name: string;
  silver: number;
  location: { kind: 'port'; portId: PortId } | { kind: 'sea' };
  ship: ShipState;
  notes: Record<PortId, PriceNote>;
}

export interface ShipState {
  typeId: string;
  x: number;
  y: number;
  heading: number;
  speedKn: number;
  sails: 0 | 1 | 2;
  anchored: boolean;
  steer: -1 | 0 | 1;
  route: { x: number; y: number }[];
  routePortId: PortId | null;
  aground: boolean;
  crew: number;
  morale: number;
  provisions: number;
  provisionAcc: number;
  starvingDays: number;
  cargo: CargoLot[];
  hull: number;
  sailHp: number;
}

export interface CargoLot {
  goodId: GoodId;
  qty: number;
  originPortId: PortId;
  totalCost: number;
}

export interface PriceNote {
  seenAtTick: number;
  goods: Record<GoodId, { buy: number | null; sell: number }>;
}

export interface Stats {
  voyages: {
    fromPortId: PortId;
    toPortId: PortId | null;
    startTick: number;
    endTick: number | null;
    profit: number;
  }[];
  totalProfit: number;
  tradesCount: number;
}

export type Command =
  | { type: 'SetCourseToPoint'; x: number; y: number }
  | { type: 'SetCourseToPort'; portId: PortId }
  | { type: 'ClearCourse' }
  | { type: 'SetSails'; level: 0 | 1 | 2 }
  | { type: 'Steer'; dir: -1 | 0 | 1 }
  | { type: 'ToggleAnchor' }
  | { type: 'LeavePort' }
  | { type: 'BuyGoods'; goodId: GoodId; qty: number }
  | { type: 'SellGoods'; goodId: GoodId; qty: number }
  | { type: 'HireCrew'; count: number }
  | { type: 'DismissCrew'; count: number }
  | { type: 'BuyProvisions'; qty: number }
  | { type: 'SellProvisions'; qty: number }
  | { type: 'DevTeleport'; portId: PortId }
  | { type: 'DevAddSilver'; amount: number }
  | { type: 'DevSetWind'; regionId: string; fromDeg: number };

export type RejectReason =
  | 'not_in_port'
  | 'in_port'
  | 'not_enough_silver'
  | 'not_enough_stock'
  | 'not_enough_cargo'
  | 'hold_full'
  | 'good_not_sold_here'
  | 'crew_limit'
  | 'crew_below_one'
  | 'invalid_qty'
  | 'unreachable'
  | 'unknown_port'
  | 'unknown_good'
  | 'dev_disabled'
  | 'invalid_command'
  | 'not_implemented';

export type Tag =
  | 'trade'
  | 'navigation'
  | 'exploration'
  | 'gunnery'
  | 'melee'
  | 'defense'
  | 'piracy';

export type GameEvent =
  | { type: 'DayStarted'; day: number }
  | { type: 'WindChanged'; regionId: string; fromDeg: number }
  | { type: 'PortEntered'; portId: PortId }
  | { type: 'PortLeft'; portId: PortId }
  | { type: 'CourseSet'; waypoints: number; distanceKm: number }
  | { type: 'CourseUnreachable' }
  | { type: 'Arrived' }
  | { type: 'RanAground' }
  | {
      type: 'TradeExecuted';
      portId: PortId;
      goodId: GoodId;
      side: 'buy' | 'sell';
      qty: number;
      total: number;
    }
  | {
      type: 'TradeProfit';
      portId: PortId;
      goodId: GoodId;
      qty: number;
      profit: number;
      originPortId: PortId;
      tags: Tag[];
    }
  | { type: 'CrewHired'; count: number; cost: number }
  | { type: 'CrewDismissed'; count: number }
  | { type: 'CrewDeserted'; count: number }
  | { type: 'ProvisionsBought'; qty: number; cost: number }
  | { type: 'ProvisionsSold'; qty: number; revenue: number }
  | { type: 'ProvisionsExhausted' }
  | { type: 'GoalReached'; goalId: 'pinnace_savings' }
  | { type: 'CommandRejected'; command: Command['type']; reason: RejectReason };

export interface QuoteRequest {
  portId: PortId;
  goodId: GoodId;
  side: 'buy' | 'sell';
  qty: number;
}
export interface TradeQuote {
  ok: boolean;
  reason?: RejectReason;
  batches: { qty: number; unitPrice: number }[];
  total: number;
  avgUnitPrice: number;
  stockAfter: number;
  holdAfter: number;
  profit?: number;
}
export interface VoyageEstimate {
  reachable: boolean;
  distanceKm: number;
  days: number;
  provisionsNeeded: number;
}
export interface SaveFile {
  format: 'poputnogo-vetra-save';
  schemaVersion: number;
  gameVersion: string;
  savedAt: string;
  seed: number;
  state: unknown;
}

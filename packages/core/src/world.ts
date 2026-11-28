import type { GameData, WorldState } from './types.js';
import { int, seedStream, uniform } from './util/rng.js';

/** Creates the initial, serializable world from static data and a seed. */
export function createWorld(
  data: GameData,
  opts: { seed: number; playerName: string },
): WorldState {
  if (!Number.isSafeInteger(opts.seed))
    throw new RangeError('Seed must be a safe integer');
  if (!opts.playerName.trim())
    throw new RangeError('Player name must not be empty');
  const startPort = data.ports.find(
    (port) => port.id === data.balance.startPortId,
  );
  const ship = data.ships[0];
  if (!startPort || !ship)
    throw new RangeError('Starting port and ship must exist');

  const rng = {
    wind: seedStream(opts.seed, 'wind'),
    market: seedStream(opts.seed, 'market'),
    misc: seedStream(opts.seed, 'misc'),
  };
  const regions: WorldState['wind']['regions'] = {};
  for (const region of data.wind.regions) {
    regions[region.id] = {
      fromDeg: region.prevailingFromDeg,
      targetFromDeg: region.prevailingFromDeg,
      transitionLeft: 0,
      nextChangeDay: int(rng.wind, ...data.wind.changeEveryDays),
    };
  }

  const ports: WorldState['ports'] = {};
  for (const port of data.ports) {
    const market: WorldState['ports'][string]['market'] = {};
    for (const good of data.goods) {
      const target = port.market[good.id]?.target;
      if (target === undefined)
        throw new RangeError(`Missing market data for ${port.id}/${good.id}`);
      market[good.id] = {
        stock: Math.round(
          target * uniform(rng.market, ...data.balance.initialStockSpread),
        ),
        target,
        history: [],
      };
    }
    ports[port.id] = { market };
  }

  return {
    schemaVersion: 1,
    seed: opts.seed,
    tick: 0,
    rng,
    wind: { regions },
    ports,
    player: {
      name: opts.playerName,
      silver: data.balance.startSilver,
      location: { kind: 'port', portId: startPort.id },
      ship: {
        typeId: ship.id,
        x: startPort.anchorage.x,
        y: startPort.anchorage.y,
        heading: startPort.exitHeading,
        speedKn: 0,
        sails: 0,
        anchored: true,
        steer: 0,
        route: [],
        routePortId: null,
        aground: false,
        crew: data.balance.startCrew,
        morale: data.balance.startMorale,
        provisions: data.balance.startProvisions,
        provisionAcc: 0,
        starvingDays: 0,
        cargo: [],
        hull: ship.hull,
        sailHp: ship.sailHp,
      },
      notes: {},
    },
    goals: { pinnaceSavingsReached: false },
    stats: { voyages: [], totalProfit: 0, tradesCount: 0 },
  };
}

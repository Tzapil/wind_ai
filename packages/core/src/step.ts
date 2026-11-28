import { z } from 'zod';
import type {
  Command,
  GameData,
  GameEvent,
  RejectReason,
  WorldState,
} from './types.js';
import { TICKS_PER_DAY, gameTimeOf } from './time.js';

const id = z.string().min(1);
const qty = z.number().int().positive();
const commandSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('SetCourseToPoint'),
    x: z.number().finite(),
    y: z.number().finite(),
  }),
  z.strictObject({ type: z.literal('SetCourseToPort'), portId: id }),
  z.strictObject({ type: z.literal('ClearCourse') }),
  z.strictObject({
    type: z.literal('SetSails'),
    level: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  }),
  z.strictObject({
    type: z.literal('Steer'),
    dir: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
  }),
  z.strictObject({ type: z.literal('ToggleAnchor') }),
  z.strictObject({ type: z.literal('LeavePort') }),
  z.strictObject({ type: z.literal('BuyGoods'), goodId: id, qty }),
  z.strictObject({ type: z.literal('SellGoods'), goodId: id, qty }),
  z.strictObject({ type: z.literal('HireCrew'), count: qty }),
  z.strictObject({ type: z.literal('DismissCrew'), count: qty }),
  z.strictObject({ type: z.literal('BuyProvisions'), qty }),
  z.strictObject({ type: z.literal('SellProvisions'), qty }),
  z.strictObject({ type: z.literal('DevTeleport'), portId: id }),
  z.strictObject({
    type: z.literal('DevAddSilver'),
    amount: z.number().int().positive(),
  }),
  z.strictObject({
    type: z.literal('DevSetWind'),
    regionId: id,
    fromDeg: z.number().finite().min(0).lt(360),
  }),
]);

function rejection(command: Command, reason: RejectReason): GameEvent {
  return { type: 'CommandRejected', command: command.type, reason };
}

function applyCommand(
  state: WorldState,
  command: Command,
  data: GameData,
): GameEvent | undefined {
  if (!commandSchema.safeParse(command).success) {
    if (
      ('qty' in command && !qty.safeParse(command.qty).success) ||
      ('count' in command && !qty.safeParse(command.count).success)
    ) {
      return rejection(command, 'invalid_qty');
    }
    return rejection(command, 'invalid_command');
  }
  const ship = state.player.ship;
  switch (command.type) {
    case 'ClearCourse':
      ship.route = [];
      ship.routePortId = null;
      return;
    case 'SetSails':
      ship.sails = command.level;
      return;
    case 'Steer':
      ship.steer = command.dir;
      return;
    case 'ToggleAnchor':
      ship.anchored = !ship.anchored;
      return;
    case 'SetCourseToPort':
    case 'DevTeleport':
      if (!data.ports.some((port) => port.id === command.portId))
        return rejection(command, 'unknown_port');
      break;
    case 'BuyGoods':
    case 'SellGoods':
      if (!data.goods.some((good) => good.id === command.goodId))
        return rejection(command, 'unknown_good');
      break;
    case 'DevSetWind':
    case 'DevAddSilver':
      break;
    default:
      break;
  }
  if (command.type.startsWith('Dev')) return rejection(command, 'dev_disabled');
  return rejection(command, 'not_implemented');
}

/** Applies one simulation tick and returns events in command order. */
export function step(
  state: WorldState,
  commands: readonly Command[],
  data: GameData,
): GameEvent[] {
  const events: GameEvent[] = [];
  // 1. Commands, including validation and rejection.
  for (const command of commands) {
    const event = applyCommand(state, command, data);
    if (event) events.push(event);
  }
  // 2. Time and daily systems (wind, provisions, and market follow later).
  state.tick += 1;
  if (state.tick % TICKS_PER_DAY === 0) {
    events.push({ type: 'DayStarted', day: gameTimeOf(state.tick).day });
  }
  // 3. Wind transitions (T-22).
  // 4. Navigation (T-23 through T-25).
  // 5. Provision consumption (T-26).
  // 6. Statistics and log (T-30).
  return events;
}

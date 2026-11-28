/** Simulation time uses 25 ticks per hour and starts on 1 May 1550. */
export const TICKS_PER_HOUR = 25;
export const TICKS_PER_DAY = 24 * TICKS_PER_HOUR;
export const START_TICK = 8 * TICKS_PER_HOUR;

const START_YEAR = 1550;
const DAYS_BEFORE_MAY = 120;
const DAYS_PER_GREGORIAN_CYCLE = 146097;
const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export interface GameTime {
  /** Whole days elapsed since 1 May 1550; the starting day is zero. */
  day: number;
  year: number;
  month: number;
  dayOfMonth: number;
  hour: number;
  minute: number;
  isNight: boolean;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/** Converts a nonnegative simulation tick into Gregorian game time. */
export function gameTimeOf(tick: number): GameTime {
  if (!Number.isSafeInteger(tick) || tick < 0) {
    throw new RangeError('Tick must be a nonnegative safe integer');
  }

  const day = Math.floor(tick / TICKS_PER_DAY);
  let dayOfYear = day + DAYS_BEFORE_MAY;
  const cycles = Math.floor(dayOfYear / DAYS_PER_GREGORIAN_CYCLE);
  let year = START_YEAR + cycles * 400;
  dayOfYear -= cycles * DAYS_PER_GREGORIAN_CYCLE;

  while (dayOfYear >= (isLeapYear(year) ? 366 : 365)) {
    dayOfYear -= isLeapYear(year) ? 366 : 365;
    year += 1;
  }

  let month = 1;
  while (month <= 12) {
    const daysInMonth =
      MONTH_LENGTHS[month - 1]! + (month === 2 && isLeapYear(year) ? 1 : 0);
    if (dayOfYear < daysInMonth) break;
    dayOfYear -= daysInMonth;
    month += 1;
  }

  const tickOfDay = tick % TICKS_PER_DAY;
  const hour = Math.floor(tickOfDay / TICKS_PER_HOUR);
  const minute = Math.floor(
    ((tickOfDay % TICKS_PER_HOUR) * 60) / TICKS_PER_HOUR,
  );
  return {
    day,
    year,
    month,
    dayOfMonth: dayOfYear + 1,
    hour,
    minute,
    isNight: hour >= 21 || hour < 5,
  };
}

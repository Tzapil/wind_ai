import { t, type UnitKey } from './t';

export interface GameDateTime {
  year: number;
  month: number;
  dayOfMonth: number;
  hour: number;
  minute: number;
}

const numberFormatter = new Intl.NumberFormat('ru-RU');
const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
});

function spacedNumber(value: number): string {
  return numberFormatter.format(value).replace(/[\u00a0\u202f]/g, ' ');
}

export function formatSilver(amount: number): string {
  return `${spacedNumber(amount)} ${t('ui.silver', { count: amount })}`;
}

export function formatGameDate(time: GameDateTime): string {
  const date = new Date(
    Date.UTC(
      time.year,
      time.month - 1,
      time.dayOfMonth,
      time.hour,
      time.minute,
    ),
  );
  const parts = dateFormatter.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((item) => item.type === type)?.value ?? '';
  return `${part('day')} ${part('month')} ${part('year')}, ${part('hour')}:${part('minute')}`;
}

export function formatQuantity(count: number, unitKey: UnitKey): string {
  return t(unitKey, { count });
}

import { describe, expect, it } from 'vitest';
import {
  formatGameDate,
  formatQuantity,
  formatSilver,
} from '../src/i18n/format';
import { gameTimeOf } from '../../core/src/time';

describe('Russian formatting', () => {
  it.each([
    [1, '1 бочка'],
    [2, '2 бочки'],
    [5, '5 бочек'],
    [11, '11 бочек'],
    [21, '21 бочка'],
    [22, '22 бочки'],
    [25, '25 бочек'],
  ])('formats %i barrels', (count, expected) => {
    expect(formatQuantity(count, 'goods.wine.unit')).toBe(expected);
  });

  it('formats gameTimeOf output', () => {
    expect(formatGameDate(gameTimeOf(2 * 600 + 14 * 25))).toBe(
      '3 мая 1550, 14:00',
    );
  });

  it('formats silver with Russian grouping', () => {
    expect(formatSilver(1250)).toBe('1 250 серебра');
    expect(formatSilver(1)).toBe('1 серебро');
  });
});

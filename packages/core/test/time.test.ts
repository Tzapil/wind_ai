import { describe, expect, it } from 'vitest';
import { gameTimeOf } from '../src/index';

describe('Gregorian game time', () => {
  it('starts at 08:00 on 1 May 1550 and reaches June after 31 days', () => {
    expect(gameTimeOf(200)).toEqual({
      day: 0,
      year: 1550,
      month: 5,
      dayOfMonth: 1,
      hour: 8,
      minute: 0,
      isNight: false,
    });
    expect(gameTimeOf(600 * 31 + 200)).toMatchObject({
      day: 31,
      year: 1550,
      month: 6,
      dayOfMonth: 1,
      hour: 8,
      minute: 0,
    });
  });

  it('marks 21:00 through 04:59 as night', () => {
    expect(gameTimeOf(525).isNight).toBe(true);
    expect(gameTimeOf(550)).toMatchObject({
      hour: 22,
      minute: 0,
      isNight: true,
    });
    expect(gameTimeOf(100)).toMatchObject({
      hour: 4,
      minute: 0,
      isNight: true,
    });
    expect(gameTimeOf(125)).toMatchObject({
      hour: 5,
      minute: 0,
      isNight: false,
    });
    expect(gameTimeOf(524).isNight).toBe(false);
    expect(gameTimeOf(201).minute).toBe(2);
  });

  it('uses Gregorian leap years and year boundaries', () => {
    expect(gameTimeOf(600 * 669)).toMatchObject({
      year: 1552,
      month: 2,
      dayOfMonth: 29,
    });
    expect(gameTimeOf(600 * 670)).toMatchObject({
      year: 1552,
      month: 3,
      dayOfMonth: 1,
    });
    expect(gameTimeOf(600 * 245)).toMatchObject({
      year: 1551,
      month: 1,
      dayOfMonth: 1,
    });
    expect(gameTimeOf(600 * 54725)).toMatchObject({
      year: 1700,
      month: 2,
      dayOfMonth: 28,
    });
    expect(gameTimeOf(600 * 54726)).toMatchObject({
      year: 1700,
      month: 3,
      dayOfMonth: 1,
    });
  });

  it('rejects invalid ticks', () => {
    expect(() => gameTimeOf(-1)).toThrow(RangeError);
    expect(() => gameTimeOf(1.5)).toThrow(RangeError);
  });
});

import { describe, it, expect } from 'vitest';
import { isValidDay, shiftDay, isInPeriod, toUtcIso } from '../src/model.js';

describe('isValidDay', () => {
  it('accepts valid dates in YYYY-MM-DD format', () => {
    expect(isValidDay('2026-02-28')).toBe(true);
  });
  it('rejects wrong formats and nonexistent dates', () => {
    expect(isValidDay('01/02/2026')).toBe(false);
    expect(isValidDay('2026-02-30')).toBe(false);
  });
});

describe('shiftDay', () => {
  it('moves forward and backward across month boundaries', () => {
    expect(shiftDay('2026-02-28', 1)).toBe('2026-03-01');
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('isInPeriod', () => {
  const period = { from: '2026-01-01', to: '2026-06-30' };
  it('includes both ends of the range for the whole day', () => {
    expect(isInPeriod('2026-01-01T00:00:00Z', period)).toBe(true);
    expect(isInPeriod('2026-06-30T23:59:59Z', period)).toBe(true);
  });
  it('excludes the day after the end', () => {
    expect(isInPeriod('2026-07-01T00:00:00Z', period)).toBe(false);
  });
});

describe('toUtcIso', () => {
  it('converts a timestamp with an offset to UTC', () => {
    expect(toUtcIso('2026-03-10T23:30:00.000-0300')).toBe('2026-03-11T02:30:00.000Z');
  });
});

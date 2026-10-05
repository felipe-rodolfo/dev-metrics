import { describe, it, expect } from 'vitest';
import { isValidDay, shiftDay, isInPeriod, toUtcIso } from '../src/model.js';

describe('isValidDay', () => {
  it('aceita datas válidas no formato AAAA-MM-DD', () => {
    expect(isValidDay('2026-02-28')).toBe(true);
  });
  it('rejeita formato errado e datas inexistentes', () => {
    expect(isValidDay('01/02/2026')).toBe(false);
    expect(isValidDay('2026-02-30')).toBe(false);
  });
});

describe('shiftDay', () => {
  it('avança e recua dias, atravessando meses', () => {
    expect(shiftDay('2026-02-28', 1)).toBe('2026-03-01');
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('isInPeriod', () => {
  const period = { from: '2026-01-01', to: '2026-06-30' };
  it('inclui os dois extremos do intervalo, com o dia inteiro', () => {
    expect(isInPeriod('2026-01-01T00:00:00Z', period)).toBe(true);
    expect(isInPeriod('2026-06-30T23:59:59Z', period)).toBe(true);
  });
  it('exclui o dia seguinte ao fim', () => {
    expect(isInPeriod('2026-07-01T00:00:00Z', period)).toBe(false);
  });
});

describe('toUtcIso', () => {
  it('converte um horário com offset para UTC', () => {
    expect(toUtcIso('2026-03-10T23:30:00.000-0300')).toBe('2026-03-11T02:30:00.000Z');
  });
});

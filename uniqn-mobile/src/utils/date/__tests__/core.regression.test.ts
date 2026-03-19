import { toDate, toDateString, toDateValue } from '../core';

describe('date/core regression', () => {
  it('parses serialized timestamp objects', () => {
    const value = { seconds: 1738022400, nanoseconds: 0 };

    expect(toDate(value)).toBeInstanceOf(Date);
    expect(toDateString(value)).toBe('2025-01-28');
    expect(toDateValue(value)).toBe(new Date('2025-01-28T00:00:00.000Z').getTime());
  });

  it('parses duck-typed timestamp objects', () => {
    const value = { toDate: () => new Date('2025-01-28T09:00:00.000Z') };

    expect(toDate(value)?.toISOString()).toBe('2025-01-28T09:00:00.000Z');
    expect(toDateString(value)).toBe('2025-01-28');
  });

  it('parses epoch millisecond numbers', () => {
    const value = 1738054800000;

    expect(toDate(value)?.toISOString()).toBe('2025-01-28T09:00:00.000Z');
    expect(toDateString(value)).toBe('2025-01-28');
  });

  it('returns null for invalid duck-typed dates instead of throwing', () => {
    const value = { toDate: () => new Date('invalid-date') };

    expect(toDate(value)).toBeNull();
    expect(toDateString(value)).toBe('');
    expect(toDateValue(value)).toBeNull();
  });

  it('does not coerce invalid date-only strings', () => {
    expect(toDate('2025-02-30')).toBeNull();
    expect(toDateString('2025-02-30')).toBe('');
    expect(toDateValue('2025-02-30')).toBeNull();
  });
});

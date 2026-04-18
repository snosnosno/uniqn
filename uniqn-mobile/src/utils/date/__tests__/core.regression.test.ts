import { toDate, toDateString, toDateValue, normalizeToIsoString } from '../core';

describe('date/core regression', () => {
  // Task 2/4 이후: toDate/toDateString/toDateValue는 Firebase shape를 직접 받지 않음.
  // Firebase legacy 입력은 normalizeToIsoString을 거쳐 ISO string으로 변환된 뒤 view layer에 전달됨.

  it('normalizeToIsoString → toDate: serialized timestamp 객체를 처리한다', () => {
    const value = { seconds: 1738022400, nanoseconds: 0 };
    const iso = normalizeToIsoString(value);

    expect(toDate(iso)).toBeInstanceOf(Date);
    expect(toDateString(iso)).toBe('2025-01-28');
    expect(toDateValue(iso)).toBe(new Date('2025-01-28T00:00:00.000Z').getTime());
  });

  it('normalizeToIsoString → toDate: duck-typed timestamp 객체를 처리한다', () => {
    const value = { toDate: () => new Date('2025-01-28T09:00:00.000Z') };
    const iso = normalizeToIsoString(value);

    expect(toDate(iso)?.toISOString()).toBe('2025-01-28T09:00:00.000Z');
    expect(toDateString(iso)).toBe('2025-01-28');
  });

  it('epoch millisecond 숫자를 직접 처리한다', () => {
    const value = 1738054800000;

    expect(toDate(value)?.toISOString()).toBe('2025-01-28T09:00:00.000Z');
    expect(toDateString(value)).toBe('2025-01-28');
  });

  it('duck-typed 객체가 invalid Date를 반환하면 normalizeToIsoString은 throw한다', () => {
    const value = { toDate: () => new Date('invalid-date') };
    expect(() => normalizeToIsoString(value)).toThrow();
  });

  it('유효하지 않은 date-only 문자열은 강제 변환하지 않는다', () => {
    expect(toDate('2025-02-30')).toBeNull();
    expect(toDateString('2025-02-30')).toBe('');
    expect(toDateValue('2025-02-30')).toBeNull();
  });
});

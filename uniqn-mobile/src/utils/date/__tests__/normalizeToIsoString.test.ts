import { normalizeToIsoString, toDate } from '../core';

describe('normalizeToIsoString (정규화 single source)', () => {
  describe('입력 → ISO string 정규화', () => {
    it('Date를 ISO string으로 변환', () => {
      const d = new Date('2026-04-19T15:30:00.000Z');
      expect(normalizeToIsoString(d)).toBe('2026-04-19T15:30:00.000Z');
    });

    it('strict ISO string은 정규화 후 통과', () => {
      expect(normalizeToIsoString('2026-04-19T15:30:00.000Z')).toBe('2026-04-19T15:30:00.000Z');
    });

    it('Supabase timestamptz 형태("+00:00")도 통과', () => {
      const result = normalizeToIsoString('2026-04-19T15:30:00+00:00');
      expect(result).toBe('2026-04-19T15:30:00.000Z');
    });

    it('epoch ms(number)를 ISO string으로 변환', () => {
      expect(normalizeToIsoString(1776525546985)).toBe('2026-04-18T15:19:06.985Z');
    });

    it('Firestore TimestampLike({toDate})를 ISO string으로 변환', () => {
      const inner = new Date('2026-04-19T15:30:00.000Z');
      expect(normalizeToIsoString({ toDate: () => inner })).toBe('2026-04-19T15:30:00.000Z');
    });

    it('{seconds, nanoseconds} 객체를 ISO string으로 변환', () => {
      const result = normalizeToIsoString({ seconds: 1776525546, nanoseconds: 985000000 });
      expect(result).toBe('2026-04-18T15:19:06.985Z');
    });

    it('serverTimestamp 센티널을 현재 시각 ISO string으로 변환', () => {
      const before = Date.now();
      const result = normalizeToIsoString({ _methodName: 'serverTimestamp' });
      const after = Date.now();
      const ms = new Date(result).getTime();
      expect(ms).toBeGreaterThanOrEqual(before);
      expect(ms).toBeLessThanOrEqual(after);
    });
  });

  describe('strict 거부 (loose Date.parse fallback 차단)', () => {
    it('numeric string("12345")을 거부 (Date.parse는 통과시키지만 ISO 8601 아님)', () => {
      expect(() => normalizeToIsoString('12345')).toThrow();
    });

    it('YYYY-MM-DD only는 거부 (timezone 모호)', () => {
      expect(() => normalizeToIsoString('2026-04-19')).toThrow();
    });

    it('자유 형식 문자열("April 19 2026") 거부', () => {
      expect(() => normalizeToIsoString('April 19 2026')).toThrow();
    });

    it('빈 문자열, null, undefined, 임의 객체는 throw', () => {
      expect(() => normalizeToIsoString('')).toThrow();
      expect(() => normalizeToIsoString(null)).toThrow();
      expect(() => normalizeToIsoString(undefined)).toThrow();
      expect(() => normalizeToIsoString({})).toThrow();
      expect(() => normalizeToIsoString({ foo: 'bar' })).toThrow();
    });

    it('Invalid Date 인스턴스 거부', () => {
      expect(() => normalizeToIsoString(new Date('invalid'))).toThrow();
    });

    it('NaN/Infinity number 거부', () => {
      expect(() => normalizeToIsoString(NaN)).toThrow();
      expect(() => normalizeToIsoString(Infinity)).toThrow();
    });
  });

  describe('strict 거부 — 달력 검증', () => {
    it('월 13 거부', () => {
      expect(() => normalizeToIsoString('2026-13-01T00:00:00Z')).toThrow();
    });

    it('일 32 거부', () => {
      expect(() => normalizeToIsoString('2026-04-32T00:00:00Z')).toThrow();
    });

    it('시 24 거부 (silent day shift 차단)', () => {
      expect(() => normalizeToIsoString('2026-04-19T24:00:00Z')).toThrow();
    });

    it('분 60 거부', () => {
      expect(() => normalizeToIsoString('2026-04-19T12:60:00Z')).toThrow();
    });
  });
});

describe('toDate (lenient string→Date for view layer)', () => {
  it('null/undefined/빈문자열에 null 반환', () => {
    expect(toDate(null)).toBeNull();
    expect(toDate(undefined)).toBeNull();
    expect(toDate('')).toBeNull();
  });

  it('정규화 실패 시 null 반환 (throw 안 함)', () => {
    expect(toDate('invalid' as string)).toBeNull();
    expect(toDate({} as unknown as Date)).toBeNull();
  });

  it('성공 시 Date 인스턴스 반환', () => {
    const d = toDate('2026-04-19T15:30:00.000Z');
    expect(d).toBeInstanceOf(Date);
    expect(d?.toISOString()).toBe('2026-04-19T15:30:00.000Z');
  });
});

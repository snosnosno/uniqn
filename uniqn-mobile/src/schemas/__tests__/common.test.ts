import { timestampSchema, optionalTimestampSchema, nullableTimestampSchema } from '../common';

describe('timestampSchema (ISO string 반환)', () => {
  it('Supabase ISO string("+00:00")을 정규화', () => {
    expect(timestampSchema.parse('2026-04-19T15:30:00+00:00')).toBe('2026-04-19T15:30:00.000Z');
  });

  it('strict ISO Z 문자열은 그대로', () => {
    expect(timestampSchema.parse('2026-04-19T15:30:00.000Z')).toBe('2026-04-19T15:30:00.000Z');
  });

  it('Date 객체를 ISO string으로 변환', () => {
    const d = new Date('2026-04-19T15:30:00.000Z');
    expect(timestampSchema.parse(d)).toBe('2026-04-19T15:30:00.000Z');
  });

  it('Firebase TimestampLike({toDate})를 ISO string으로 변환', () => {
    const ts = {
      toDate: () => new Date('2026-04-19T15:30:00.000Z'),
      seconds: 1776525546,
      nanoseconds: 0,
    };
    expect(timestampSchema.parse(ts)).toBe('2026-04-19T15:30:00.000Z');
  });

  it('{seconds, nanoseconds} 객체를 ISO string으로 변환 (회귀 가드: 22007 차단)', () => {
    expect(timestampSchema.parse({ seconds: 1776525546, nanoseconds: 985000000 })).toBe(
      '2026-04-18T15:19:06.985Z'
    );
  });

  it('serverTimestamp 센티널을 현재 시각 ISO string으로 변환', () => {
    const before = Date.now();
    const result = timestampSchema.parse({ _methodName: 'serverTimestamp' });
    const after = Date.now();
    expect(typeof result).toBe('string');
    const ms = new Date(result as string).getTime();
    expect(ms).toBeGreaterThanOrEqual(before);
    expect(ms).toBeLessThanOrEqual(after);
  });

  describe('JSON 직렬화 (Supabase write 호환성)', () => {
    it('parse 결과를 JSON.stringify하면 그대로 ISO string (PostgreSQL timestamptz 호환)', () => {
      const result = timestampSchema.parse('2026-04-19T15:30:00.000Z');
      const json = JSON.stringify({ created_at: result });
      expect(json).toBe('{"created_at":"2026-04-19T15:30:00.000Z"}');
    });

    it('{seconds, nanoseconds} 입력도 결국 ISO string으로 직렬화 (회귀 가드)', () => {
      const result = timestampSchema.parse({ seconds: 1776525546, nanoseconds: 985000000 });
      const json = JSON.stringify({ created_at: result });
      expect(json).not.toContain('seconds');
      expect(json).not.toContain('nanoseconds');
      expect(json).toMatch(/"created_at":"\d{4}-\d{2}-\d{2}T/);
    });

    it('Firebase TimestampLike 입력도 ISO string으로 직렬화', () => {
      const ts = {
        toDate: () => new Date('2026-04-19T15:30:00.000Z'),
        seconds: 0,
        nanoseconds: 0,
      };
      const result = timestampSchema.parse(ts);
      expect(JSON.stringify({ created_at: result })).toBe(
        '{"created_at":"2026-04-19T15:30:00.000Z"}'
      );
    });
  });

  describe('잘못된 입력 거부', () => {
    it('numeric string("12345") 거부', () => {
      expect(() => timestampSchema.parse('12345')).toThrow();
    });

    it('YYYY-MM-DD only 거부', () => {
      expect(() => timestampSchema.parse('2026-04-19')).toThrow();
    });

    it('빈 문자열 거부', () => {
      expect(() => timestampSchema.parse('')).toThrow();
    });

    it('null은 timestampSchema에서 거부', () => {
      expect(() => timestampSchema.parse(null)).toThrow();
    });
  });

  describe('optionalTimestampSchema', () => {
    it('null/undefined 허용 (round-trip 검증)', () => {
      expect(optionalTimestampSchema.parse(null)).toBeNull();
      expect(optionalTimestampSchema.parse(undefined)).toBeUndefined();
    });

    it('유효한 입력은 ISO string으로 변환', () => {
      expect(optionalTimestampSchema.parse('2026-04-19T15:30:00.000Z')).toBe(
        '2026-04-19T15:30:00.000Z'
      );
    });
  });

  describe('nullableTimestampSchema', () => {
    it('null만 허용 (undefined 거부)', () => {
      expect(nullableTimestampSchema.parse(null)).toBeNull();
      expect(() => nullableTimestampSchema.parse(undefined)).toThrow();
    });
  });
});

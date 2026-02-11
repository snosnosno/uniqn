/**
 * timeEditorUtils 테스트
 */

import {
  parseTimestamp,
  parseTimeInput,
  formatTimeForInput,
  formatEndTimeForInput,
  calculateDuration,
} from '../timeEditorUtils';

jest.mock('@/shared/time', () => ({
  TimeNormalizer: {
    parseTime: jest.fn((value: unknown) => {
      if (value instanceof Date) return value;
      if (value === null || value === undefined) return null;
      if (typeof value === 'object' && value !== null && 'toDate' in value) {
        return (value as { toDate: () => Date }).toDate();
      }
      return null;
    }),
  },
}));

describe('timeEditorUtils', () => {
  describe('parseTimestamp', () => {
    it('Date를 그대로 반환한다', () => {
      const date = new Date(2025, 0, 15, 9, 30);
      expect(parseTimestamp(date)).toEqual(date);
    });

    it('null일 경우 현재 시간을 반환한다', () => {
      const before = Date.now();
      const result = parseTimestamp(null);
      const after = Date.now();
      expect(result.getTime()).toBeGreaterThanOrEqual(before);
      expect(result.getTime()).toBeLessThanOrEqual(after);
    });

    it('Timestamp 객체를 Date로 변환한다', () => {
      const date = new Date(2025, 0, 15);
      const ts = { toDate: () => date, seconds: 0, nanoseconds: 0 };
      expect(parseTimestamp(ts as any)).toEqual(date);
    });
  });

  describe('parseTimeInput', () => {
    const baseDate = new Date(2025, 0, 15, 0, 0, 0, 0);

    it('유효한 HH:MM을 파싱한다', () => {
      const result = parseTimeInput('09:30', baseDate);
      expect(result).not.toBeNull();
      expect(result!.getHours()).toBe(9);
      expect(result!.getMinutes()).toBe(30);
    });

    it('자정을 파싱한다', () => {
      const result = parseTimeInput('00:00', baseDate);
      expect(result).not.toBeNull();
      expect(result!.getHours()).toBe(0);
      expect(result!.getMinutes()).toBe(0);
    });

    it('23:59를 파싱한다', () => {
      const result = parseTimeInput('23:59', baseDate);
      expect(result).not.toBeNull();
      expect(result!.getHours()).toBe(23);
      expect(result!.getMinutes()).toBe(59);
    });

    it('24시 이상은 다음날로 설정한다', () => {
      const result = parseTimeInput('25:30', baseDate);
      expect(result).not.toBeNull();
      expect(result!.getDate()).toBe(16);
      expect(result!.getHours()).toBe(1);
      expect(result!.getMinutes()).toBe(30);
    });

    it('47:00까지 허용한다', () => {
      const result = parseTimeInput('47:00', baseDate);
      expect(result).not.toBeNull();
      expect(result!.getDate()).toBe(16);
      expect(result!.getHours()).toBe(23);
    });

    it('48시 이상은 null을 반환한다', () => {
      expect(parseTimeInput('48:00', baseDate)).toBeNull();
    });

    it('잘못된 분은 null을 반환한다', () => {
      expect(parseTimeInput('09:60', baseDate)).toBeNull();
    });

    it('형식이 틀리면 null을 반환한다', () => {
      expect(parseTimeInput('abc', baseDate)).toBeNull();
      expect(parseTimeInput('9:3', baseDate)).toBeNull();
      expect(parseTimeInput('', baseDate)).toBeNull();
    });

    it('한 자리 시간을 허용한다', () => {
      const result = parseTimeInput('9:30', baseDate);
      expect(result).not.toBeNull();
      expect(result!.getHours()).toBe(9);
    });
  });

  describe('formatTimeForInput', () => {
    it('오전 시간을 HH:MM으로 변환한다', () => {
      expect(formatTimeForInput(new Date(2025, 0, 15, 9, 5))).toBe('09:05');
    });

    it('오후 시간을 HH:MM으로 변환한다', () => {
      expect(formatTimeForInput(new Date(2025, 0, 15, 14, 30))).toBe('14:30');
    });

    it('자정을 00:00으로 변환한다', () => {
      expect(formatTimeForInput(new Date(2025, 0, 15, 0, 0))).toBe('00:00');
    });
  });

  describe('formatEndTimeForInput', () => {
    const baseDate = new Date(2025, 0, 15, 9, 0);

    it('같은 날이면 일반 포맷', () => {
      const endDate = new Date(2025, 0, 15, 18, 30);
      expect(formatEndTimeForInput(endDate, baseDate)).toBe('18:30');
    });

    it('다음날이면 24+ 형식', () => {
      const endDate = new Date(2025, 0, 16, 2, 0);
      expect(formatEndTimeForInput(endDate, baseDate)).toBe('26:00');
    });

    it('다음날 자정은 24:00', () => {
      const endDate = new Date(2025, 0, 16, 0, 0);
      expect(formatEndTimeForInput(endDate, baseDate)).toBe('24:00');
    });

    it('2일 이상 차이면 일반 포맷', () => {
      const endDate = new Date(2025, 0, 17, 2, 0);
      expect(formatEndTimeForInput(endDate, baseDate)).toBe('02:00');
    });
  });

  describe('calculateDuration', () => {
    it('시간과 분을 올바르게 계산한다', () => {
      const start = new Date(2025, 0, 15, 9, 0);
      const end = new Date(2025, 0, 15, 17, 30);
      expect(calculateDuration(start, end)).toBe('8시간 30분');
    });

    it('정확한 시간이면 분은 표시하지 않는다', () => {
      const start = new Date(2025, 0, 15, 9, 0);
      const end = new Date(2025, 0, 15, 18, 0);
      expect(calculateDuration(start, end)).toBe('9시간');
    });

    it('1시간 미만이면 분만 표시한다', () => {
      const start = new Date(2025, 0, 15, 9, 0);
      const end = new Date(2025, 0, 15, 9, 45);
      expect(calculateDuration(start, end)).toBe('45분');
    });

    it('퇴근이 출근보다 빠르면 오류 메시지', () => {
      const start = new Date(2025, 0, 15, 18, 0);
      const end = new Date(2025, 0, 15, 9, 0);
      expect(calculateDuration(start, end)).toBe('시간 오류');
    });

    it('같은 시간이면 오류 메시지', () => {
      const same = new Date(2025, 0, 15, 9, 0);
      expect(calculateDuration(same, same)).toBe('시간 오류');
    });
  });
});

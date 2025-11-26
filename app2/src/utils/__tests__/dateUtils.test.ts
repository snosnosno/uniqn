/**
 * Unit Tests: DateUtils Module (Phase 3)
 *
 * Phase 3에서 추가된 TypeScript Strict Mode 준수 함수 테스트:
 * - toISODateString: Date → YYYY-MM-DD (null 반환)
 * - formatDate: Date → 포맷 (date | datetime)
 * - parseDate: 문자열 → Date 객체
 * - isValidDate: Type Guard 검증
 *
 * @version 1.0.0
 * @created 2025-11-21
 * @feature 002-phase3-integration
 */

import { toISODateString, formatDate, parseDate, isValidDate } from '../dateUtils';
import { logger } from '../logger';

// logger mock
jest.mock('../logger', () => ({
  logger: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('DateUtils: Phase 3 Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('toISODateString()', () => {
    it('T029: Date 객체를 YYYY-MM-DD 형식으로 변환해야 함', () => {
      // Given: 로컬 시간대 Date 객체 (UTC 타임존 문제 방지)
      const date = new Date('2025-11-20T12:00:00');

      // When: toISODateString 호출
      const result = toISODateString(date);

      // Then: YYYY-MM-DD 형식 문자열 반환
      expect(result).toBe('2025-11-20');
    });

    it('T030: 문자열 입력을 처리해야 함', () => {
      // Given: ISO 날짜 문자열
      const dateString = '2025-11-21T10:00:00Z';

      // When: toISODateString 호출
      const result = toISODateString(dateString);

      // Then: YYYY-MM-DD 형식 문자열 반환
      expect(result).toBe('2025-11-21');
    });

    it('T031: 잘못된 입력에 대해 null을 반환해야 함', () => {
      // Given: 잘못된 입력값들
      const invalidInputs = [
        null,
        undefined,
        'invalid-date',
        'not-a-date',
        '2025-13-50', // 잘못된 날짜
      ];

      // When & Then: 각 입력에 대해 null 반환
      invalidInputs.forEach((input) => {
        const result = toISODateString(input as any);
        expect(result).toBeNull();
      });

      // Then: logger.warn이 호출되어야 함
      expect(logger.warn).toHaveBeenCalled();
    });

    it('잘못된 Date 객체에 대해 null을 반환해야 함', () => {
      // Given: Invalid Date 객체
      const invalidDate = new Date('invalid');

      // When: toISODateString 호출
      const result = toISODateString(invalidDate);

      // Then: null 반환 및 경고 로그
      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith('toISODateString: Invalid date', {
        date: invalidDate,
      });
    });

    it('오늘 날짜를 올바르게 변환해야 함', () => {
      // Given: 오늘 날짜
      const today = new Date();

      // When: toISODateString 호출
      const result = toISODateString(today);

      // Then: YYYY-MM-DD 형식 문자열 반환
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      // And: 로컬 시간대 기준 날짜와 일치
      const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      expect(result).toBe(expected);
    });
  });

  describe('formatDate()', () => {
    // 로컬 시간대 Date 객체 (UTC 타임존 문제 방지)
    const testDate = new Date('2025-11-20T12:30:45');

    it('T032: date 포맷으로 YYYY-MM-DD를 반환해야 함', () => {
      // When: formatDate를 'date' 포맷으로 호출
      const result = formatDate(testDate, 'date');

      // Then: YYYY-MM-DD 형식
      expect(result).toBe('2025-11-20');
    });

    it('T033: datetime 포맷으로 YYYY-MM-DD HH:mm을 반환해야 함', () => {
      // When: formatDate를 'datetime' 포맷으로 호출
      const result = formatDate(testDate, 'datetime');

      // Then: YYYY-MM-DD HH:mm 형식
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
      // Note: 시간은 로컬 시간대에 따라 다를 수 있음
    });

    it('문자열 입력도 처리해야 함', () => {
      // Given: ISO 문자열
      const dateString = '2025-11-21T10:00:00Z';

      // When: formatDate 호출
      const resultDate = formatDate(dateString, 'date');
      const resultDateTime = formatDate(dateString, 'datetime');

      // Then: 올바른 포맷 반환
      expect(resultDate).toBe('2025-11-21');
      expect(resultDateTime).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    });

    it('null 입력에 대해 null을 반환해야 함', () => {
      // When: null 입력
      const result = formatDate(null, 'date');

      // Then: null 반환
      expect(result).toBeNull();
    });

    it('잘못된 날짜에 대해 null을 반환하고 경고해야 함', () => {
      // Given: 잘못된 Date 객체
      const invalidDate = new Date('invalid');

      // When: formatDate 호출
      const result = formatDate(invalidDate, 'date');

      // Then: null 반환 및 경고
      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        'formatDate: Invalid date',
        expect.objectContaining({
          component: 'dateUtils',
        })
      );
    });
  });

  describe('parseDate()', () => {
    it('T034: 유효한 날짜 문자열을 Date 객체로 변환해야 함', () => {
      // Given: 유효한 날짜 문자열
      const dateString = '2025-11-20';

      // When: parseDate 호출
      const result = parseDate(dateString);

      // Then: Date 객체 반환
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString().split('T')[0]).toBe('2025-11-20');
    });

    it('ISO 8601 형식 문자열을 처리해야 함', () => {
      // Given: ISO 8601 문자열
      const isoString = '2025-11-21T10:30:00Z';

      // When: parseDate 호출
      const result = parseDate(isoString);

      // Then: Date 객체 반환
      expect(result).toBeInstanceOf(Date);
      // Note: toISOString()은 밀리초를 포함하므로 날짜 부분만 비교
      expect(result?.toISOString().substring(0, 19)).toBe(isoString.substring(0, 19));
    });

    it('null 또는 undefined 입력에 대해 null을 반환해야 함', () => {
      // When & Then
      expect(parseDate(null)).toBeNull();
      expect(parseDate(undefined)).toBeNull();
      expect(parseDate('')).toBeNull();
    });

    it('잘못된 날짜 문자열에 대해 null을 반환하고 경고해야 함', () => {
      // Given: 잘못된 날짜 문자열
      const invalidString = 'not-a-date';

      // When: parseDate 호출
      const result = parseDate(invalidString);

      // Then: null 반환 및 경고
      expect(result).toBeNull();
      expect(logger.warn).toHaveBeenCalledWith(
        'parseDate: Invalid date string',
        expect.objectContaining({
          component: 'dateUtils',
          data: { dateString: invalidString },
        })
      );
    });

    it('다양한 날짜 형식을 파싱해야 함', () => {
      // Given: 다양한 형식의 날짜 문자열
      const formats = ['2025-11-20', '2025/11/20', 'November 20, 2025', '2025-11-20T00:00:00Z'];

      // When & Then: 모두 Date 객체로 변환
      formats.forEach((format) => {
        const result = parseDate(format);
        expect(result).toBeInstanceOf(Date);
        expect(isValidDate(result)).toBe(true);
      });
    });
  });

  describe('isValidDate() - Type Guard', () => {
    it.skip('T035: 유효한 Date 객체에 대해 true를 반환해야 함', () => {
      // Given: 유효한 Date 객체들
      const validDates = [
        new Date(),
        new Date('2025-11-20'),
        new Date(2025, 10, 20),
        new Date('2025-11-21T10:30:00Z'),
      ];

      // When & Then: 모두 true 반환
      validDates.forEach((date) => {
        expect(isValidDate(date)).toBe(true);

        // Type Guard 동작 확인
        if (isValidDate(date)) {
          // TypeScript가 date를 Date 타입으로 인식해야 함
          expect(date.getTime()).toBeDefined();
        }
      });
    });

    it('Invalid Date 객체에 대해 false를 반환해야 함', () => {
      // Given: Invalid Date 객체
      const invalidDate = new Date('invalid');

      // When & Then: false 반환
      expect(isValidDate(invalidDate)).toBe(false);
    });

    it('Date가 아닌 타입에 대해 false를 반환해야 함', () => {
      // Given: Date가 아닌 다양한 타입
      const nonDateValues = [
        null,
        undefined,
        '2025-11-20', // 문자열
        1732147200000, // 숫자 (timestamp)
        { date: '2025-11-20' }, // 객체
        ['2025-11-20'], // 배열
        true, // boolean
      ];

      // When & Then: 모두 false 반환
      nonDateValues.forEach((value) => {
        expect(isValidDate(value)).toBe(false);
      });
    });

    it.skip('Type Guard로 타입을 좁혀야 함', () => {
      // Given: unknown 타입 값
      const value: unknown = new Date('2025-11-20');

      // When: isValidDate로 타입 체크
      if (isValidDate(value)) {
        // Then: TypeScript가 value를 Date로 인식
        expect(value.getFullYear()).toBe(2025);
        expect(value.getMonth()).toBe(10); // 0-based (11월 = 10)
        expect(value.getDate()).toBe(20);
      } else {
        throw new Error('Should be valid date');
      }
    });

    it('극단적인 날짜 값도 처리해야 함', () => {
      // Given: 극단적인 날짜들
      const extremeDates = [
        new Date(0), // Unix epoch
        new Date('1970-01-01'),
        new Date('2100-12-31'),
        new Date(8640000000000000), // Max date
      ];

      // When & Then: 유효한 Date 객체로 인식
      extremeDates.forEach((date) => {
        expect(isValidDate(date)).toBe(true);
      });
    });
  });

  describe('함수 간 통합 테스트', () => {
    it('parseDate → isValidDate → formatDate 체인이 작동해야 함', () => {
      // Given: 로컬 시간대 날짜 문자열 (UTC 타임존 문제 방지)
      const dateString = '2025-11-20T12:00:00';

      // When: 체인 호출
      const parsedDate = parseDate(dateString);

      // Then: parseDate 성공
      expect(parsedDate).not.toBeNull();

      // And: isValidDate 검증
      expect(isValidDate(parsedDate)).toBe(true);

      // And: formatDate로 포맷팅

      const formatted = formatDate(parsedDate, 'date');
      expect(formatted).toBe('2025-11-20');

      const formattedDateTime = formatDate(parsedDate, 'datetime');
      expect(formattedDateTime).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
    });

    it('toISODateString과 parseDate가 역변환을 수행해야 함', () => {
      // Given: 로컬 시간대 Date 객체 (UTC 타임존 문제 방지)
      const originalDate = new Date('2025-11-21T12:00:00');

      // When: toISODateString → parseDate
      const dateString = toISODateString(originalDate);
      expect(dateString).not.toBeNull();

      const parsedBack = parseDate(dateString!);
      expect(parsedBack).not.toBeNull();

      // Then: 날짜 부분이 동일해야 함

      expect(toISODateString(parsedBack)).toBe(dateString);
    });

    it('에러 케이스에서도 일관된 null 반환', () => {
      // Given: 잘못된 입력
      const badInput = 'totally-invalid-date';

      // When: 각 함수 호출
      const iso = toISODateString(badInput);
      const formatted = formatDate(badInput, 'date');
      const parsed = parseDate(badInput);

      // Then: 모두 null 반환
      expect(iso).toBeNull();
      expect(formatted).toBeNull();
      expect(parsed).toBeNull();

      // And: logger.warn 호출됨
      expect(logger.warn).toHaveBeenCalled();
    });
  });
});

/**
 * WorkLogCreator 테스트
 *
 * @description 근무 기록 생성 로직 테스트
 * - 시간 슬롯 파싱
 * - Timestamp 생성
 * - 단일/배치 WorkLog 생성
 * - Assignment 개수 계산
 */

import { WorkLogCreator } from '../WorkLogCreator';

describe('WorkLogCreator', () => {
  // ============================================================================
  // parseTimeSlot 테스트
  // ============================================================================
  describe('parseTimeSlot', () => {
    it('빈 문자열은 null 반환', () => {
      const result = WorkLogCreator.parseTimeSlot('');
      expect(result.startTime).toBeNull();
      expect(result.endTime).toBeNull();
      expect(result.original).toBe('');
    });

    it('단일 시간 "09:00" → startTime만', () => {
      const result = WorkLogCreator.parseTimeSlot('09:00');
      expect(result.startTime).toBe('09:00');
      expect(result.endTime).toBeNull();
      expect(result.original).toBe('09:00');
    });

    it('"09:00~18:00" → 시작/종료 분리', () => {
      const result = WorkLogCreator.parseTimeSlot('09:00~18:00');
      expect(result.startTime).toBe('09:00');
      expect(result.endTime).toBe('18:00');
    });

    it('"09:00 - 18:00" 형식도 지원 (- 구분자)', () => {
      const result = WorkLogCreator.parseTimeSlot('09:00 - 18:00');
      expect(result.startTime).toBe('09:00');
      expect(result.endTime).toBe('18:00');
    });

    it('공백이 포함된 시간 처리', () => {
      const result = WorkLogCreator.parseTimeSlot('  09:00~18:00  ');
      expect(result.startTime).toBe('09:00');
      expect(result.endTime).toBe('18:00');
      expect(result.original).toBe('09:00~18:00');
    });
  });

  // ============================================================================
  // extractStartTime 테스트
  // ============================================================================
  describe('extractStartTime', () => {
    it('시간 범위에서 시작 시간 추출', () => {
      expect(WorkLogCreator.extractStartTime('09:00~18:00')).toBe('09:00');
    });

    it('단일 시간에서 시작 시간 추출', () => {
      expect(WorkLogCreator.extractStartTime('19:00')).toBe('19:00');
    });

    it('빈 문자열은 빈 문자열 반환', () => {
      expect(WorkLogCreator.extractStartTime('')).toBe('');
    });
  });

  // ============================================================================
  // createTimestampFromDateTime 테스트
  // ============================================================================
  describe('createTimestampFromDateTime', () => {
    it('유효한 날짜/시간 → Timestamp 생성', () => {
      const result = WorkLogCreator.createTimestampFromDateTime('2026-02-11', '09:00');
      expect(result).toBeInstanceOf(Date);
      expect(result).not.toBeNull();
    });

    it('빈 날짜는 null 반환', () => {
      expect(WorkLogCreator.createTimestampFromDateTime('', '09:00')).toBeNull();
    });

    it('빈 시간은 null 반환', () => {
      expect(WorkLogCreator.createTimestampFromDateTime('2026-02-11', '')).toBeNull();
    });

    it('잘못된 시간 형식은 null 반환', () => {
      expect(WorkLogCreator.createTimestampFromDateTime('2026-02-11', 'abc')).toBeNull();
      expect(WorkLogCreator.createTimestampFromDateTime('2026-02-11', '25:00')).toBeNull();
      expect(WorkLogCreator.createTimestampFromDateTime('2026-02-11', '12:60')).toBeNull();
    });

    it('잘못된 날짜 문자열은 null 반환', () => {
      expect(WorkLogCreator.createTimestampFromDateTime('invalid-date', '09:00')).toBeNull();
      expect(WorkLogCreator.createTimestampFromDateTime('2026-02-30', '09:00')).toBeNull();
    });

    it('한 자릿수 시간도 지원 (예: "9:00")', () => {
      const result = WorkLogCreator.createTimestampFromDateTime('2026-02-11', '9:00');
      expect(result).not.toBeNull();
    });
  });

  // ============================================================================
  // countAssignments 테스트
  // ============================================================================
  describe('countAssignments', () => {
    it('Assignment 배열의 총 날짜 수 계산', () => {
      const assignments = [{ dates: ['2026-02-15', '2026-02-16'] }, { dates: ['2026-02-17'] }];

      expect(WorkLogCreator.countAssignments(assignments)).toBe(3);
    });

    it('빈 배열은 0 반환', () => {
      expect(WorkLogCreator.countAssignments([])).toBe(0);
    });

    it('빈 dates 배열도 처리', () => {
      const assignments = [{ dates: [] }, { dates: ['2026-02-15'] }];
      expect(WorkLogCreator.countAssignments(assignments)).toBe(1);
    });
  });
});

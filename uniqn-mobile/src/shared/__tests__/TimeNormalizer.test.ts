/**
 * TimeNormalizer 테스트
 *
 * @description Phase 3 - 시간 필드 정규화
 * checkInTime/checkOutTime 필드 정규화 로직 테스트
 */

import { Timestamp } from 'firebase/firestore';
import { TimeNormalizer } from '../time/TimeNormalizer';
import type { NormalizedWorkTime } from '../time/types';

describe('TimeNormalizer', () => {
  // ==========================================================================
  // normalize: 다양한 시간 필드를 NormalizedWorkTime으로 정규화
  // ==========================================================================
  describe('normalize', () => {
    it('checkInTime → actualStart 매핑', () => {
      const workLog = {
        checkInTime: new Date('2025-01-20T09:00:00'),
        checkOutTime: new Date('2025-01-20T18:00:00'),
      };

      const normalized = TimeNormalizer.normalize(workLog);

      expect(normalized.actualStart).toEqual(workLog.checkInTime);
      expect(normalized.actualEnd).toEqual(workLog.checkOutTime);
    });

    it('checkInTime → actualStart 매핑 확인 (다른 값)', () => {
      const workLog = {
        checkInTime: new Date('2025-01-20T09:05:00'),
      };

      const normalized = TimeNormalizer.normalize(workLog);

      expect(normalized.actualStart).toEqual(workLog.checkInTime);
    });

    it('checkOutTime → actualEnd 매핑 확인 (다른 값)', () => {
      const workLog = {
        checkOutTime: new Date('2025-01-20T18:05:00'),
      };

      const normalized = TimeNormalizer.normalize(workLog);

      expect(normalized.actualEnd).toEqual(workLog.checkOutTime);
    });

    it('출근만 하고 퇴근 안 한 경우', () => {
      const workLog = {
        checkInTime: new Date('2025-01-20T09:00:00'),
        checkOutTime: null,
      };

      const normalized = TimeNormalizer.normalize(workLog);

      expect(normalized.actualStart).not.toBeNull();
      expect(normalized.actualEnd).toBeNull();
    });

    it('스케줄 시간 정규화', () => {
      const workLog = {
        scheduledStartTime: new Date('2025-01-20T09:00:00'),
        scheduledEndTime: new Date('2025-01-20T18:00:00'),
      };

      const normalized = TimeNormalizer.normalize(workLog);

      expect(normalized.scheduledStart).toEqual(workLog.scheduledStartTime);
      expect(normalized.scheduledEnd).toEqual(workLog.scheduledEndTime);
    });

    it('Firebase Timestamp 변환', () => {
      const date = new Date('2025-01-20T09:00:00');
      const workLog = {
        checkInTime: Timestamp.fromDate(date),
      };

      const normalized = TimeNormalizer.normalize(workLog);

      expect(normalized.actualStart).toEqual(date);
    });

    it('문자열 날짜 변환', () => {
      const dateString = '2025-01-20T09:00:00';
      const workLog = {
        checkInTime: dateString,
      };

      const normalized = TimeNormalizer.normalize(workLog);

      expect(normalized.actualStart).toEqual(new Date(dateString));
    });

    it('isEstimate: actual 시간이 없으면 true', () => {
      const workLog = {
        scheduledStartTime: new Date('2025-01-20T09:00:00'),
        scheduledEndTime: new Date('2025-01-20T18:00:00'),
      };

      const normalized = TimeNormalizer.normalize(workLog);

      expect(normalized.isEstimate).toBe(true);
    });

    it('isEstimate: actual 시간이 있으면 false', () => {
      const workLog = {
        checkInTime: new Date('2025-01-20T09:00:00'),
        checkOutTime: new Date('2025-01-20T18:00:00'),
      };

      const normalized = TimeNormalizer.normalize(workLog);

      expect(normalized.isEstimate).toBe(false);
    });

    it('빈 객체 처리', () => {
      const normalized = TimeNormalizer.normalize({});

      expect(normalized.scheduledStart).toBeNull();
      expect(normalized.scheduledEnd).toBeNull();
      expect(normalized.actualStart).toBeNull();
      expect(normalized.actualEnd).toBeNull();
      expect(normalized.isEstimate).toBe(true);
    });
  });

  // ==========================================================================
  // calculateHours: 정규화된 시간에서 근무 시간 계산
  // ==========================================================================
  describe('calculateHours', () => {
    it('9시간 근무 계산', () => {
      const normalized: NormalizedWorkTime = {
        scheduledStart: null,
        scheduledEnd: null,
        actualStart: new Date('2025-01-20T09:00:00'),
        actualEnd: new Date('2025-01-20T18:00:00'),
        isEstimate: false,
      };

      expect(TimeNormalizer.calculateHours(normalized)).toBe(9);
    });

    it('퇴근 시간 없으면 0 반환', () => {
      const normalized: NormalizedWorkTime = {
        scheduledStart: null,
        scheduledEnd: null,
        actualStart: new Date('2025-01-20T09:00:00'),
        actualEnd: null,
        isEstimate: false,
      };

      expect(TimeNormalizer.calculateHours(normalized)).toBe(0);
    });

    it('출근 시간 없으면 0 반환', () => {
      const normalized: NormalizedWorkTime = {
        scheduledStart: null,
        scheduledEnd: null,
        actualStart: null,
        actualEnd: new Date('2025-01-20T18:00:00'),
        isEstimate: false,
      };

      expect(TimeNormalizer.calculateHours(normalized)).toBe(0);
    });

    it('8시간 45분 근무 계산 (소수점 정확도)', () => {
      const normalized: NormalizedWorkTime = {
        scheduledStart: null,
        scheduledEnd: null,
        actualStart: new Date('2025-01-20T09:00:00'),
        actualEnd: new Date('2025-01-20T17:45:00'), // 8시간 45분
        isEstimate: false,
      };

      expect(TimeNormalizer.calculateHours(normalized)).toBeCloseTo(8.75, 2);
    });

    it('야간 근무 (자정 넘김) 계산', () => {
      const normalized: NormalizedWorkTime = {
        scheduledStart: null,
        scheduledEnd: null,
        actualStart: new Date('2025-01-20T22:00:00'),
        actualEnd: new Date('2025-01-21T06:00:00'), // 다음날 오전 6시
        isEstimate: false,
      };

      expect(TimeNormalizer.calculateHours(normalized)).toBe(8);
    });

    it('30분 미만 근무', () => {
      const normalized: NormalizedWorkTime = {
        scheduledStart: null,
        scheduledEnd: null,
        actualStart: new Date('2025-01-20T09:00:00'),
        actualEnd: new Date('2025-01-20T09:15:00'), // 15분
        isEstimate: false,
      };

      expect(TimeNormalizer.calculateHours(normalized)).toBeCloseTo(0.25, 2);
    });
  });

  // ==========================================================================
  // calculateHoursFromScheduled: 예정 시간으로 근무 시간 계산
  // ==========================================================================
  describe('calculateHoursFromScheduled', () => {
    it('예정 시간으로 계산', () => {
      const normalized: NormalizedWorkTime = {
        scheduledStart: new Date('2025-01-20T09:00:00'),
        scheduledEnd: new Date('2025-01-20T18:00:00'),
        actualStart: null,
        actualEnd: null,
        isEstimate: true,
      };

      expect(TimeNormalizer.calculateHoursFromScheduled(normalized)).toBe(9);
    });

    it('예정 시간 없으면 0 반환', () => {
      const normalized: NormalizedWorkTime = {
        scheduledStart: null,
        scheduledEnd: null,
        actualStart: null,
        actualEnd: null,
        isEstimate: true,
      };

      expect(TimeNormalizer.calculateHoursFromScheduled(normalized)).toBe(0);
    });
  });

  // ==========================================================================
  // getEffectiveHours: 실제 또는 예정 시간 중 유효한 것으로 계산
  // ==========================================================================
  describe('getEffectiveHours', () => {
    it('actual 시간이 있으면 actual 사용', () => {
      const normalized: NormalizedWorkTime = {
        scheduledStart: new Date('2025-01-20T09:00:00'),
        scheduledEnd: new Date('2025-01-20T18:00:00'), // 9시간
        actualStart: new Date('2025-01-20T09:00:00'),
        actualEnd: new Date('2025-01-20T17:00:00'), // 8시간
        isEstimate: false,
      };

      expect(TimeNormalizer.getEffectiveHours(normalized)).toBe(8);
    });

    it('actual 시간 없으면 scheduled 사용', () => {
      const normalized: NormalizedWorkTime = {
        scheduledStart: new Date('2025-01-20T09:00:00'),
        scheduledEnd: new Date('2025-01-20T18:00:00'), // 9시간
        actualStart: null,
        actualEnd: null,
        isEstimate: true,
      };

      expect(TimeNormalizer.getEffectiveHours(normalized)).toBe(9);
    });
  });

  // ==========================================================================
  // hasActualTime: 실제 출퇴근 시간 존재 여부
  // ==========================================================================
  describe('hasActualTime', () => {
    it('출퇴근 모두 있으면 true', () => {
      const normalized: NormalizedWorkTime = {
        scheduledStart: null,
        scheduledEnd: null,
        actualStart: new Date('2025-01-20T09:00:00'),
        actualEnd: new Date('2025-01-20T18:00:00'),
        isEstimate: false,
      };

      expect(TimeNormalizer.hasActualTime(normalized)).toBe(true);
    });

    it('출근만 있으면 false', () => {
      const normalized: NormalizedWorkTime = {
        scheduledStart: null,
        scheduledEnd: null,
        actualStart: new Date('2025-01-20T09:00:00'),
        actualEnd: null,
        isEstimate: false,
      };

      expect(TimeNormalizer.hasActualTime(normalized)).toBe(false);
    });

    it('퇴근만 있으면 false', () => {
      const normalized: NormalizedWorkTime = {
        scheduledStart: null,
        scheduledEnd: null,
        actualStart: null,
        actualEnd: new Date('2025-01-20T18:00:00'),
        isEstimate: false,
      };

      expect(TimeNormalizer.hasActualTime(normalized)).toBe(false);
    });

    it('둘 다 없으면 false', () => {
      const normalized: NormalizedWorkTime = {
        scheduledStart: null,
        scheduledEnd: null,
        actualStart: null,
        actualEnd: null,
        isEstimate: true,
      };

      expect(TimeNormalizer.hasActualTime(normalized)).toBe(false);
    });
  });

  // ==========================================================================
  // isCheckedIn: 출근 여부 확인
  // ==========================================================================
  describe('isCheckedIn', () => {
    it('출근 시간 있으면 true', () => {
      const normalized: NormalizedWorkTime = {
        scheduledStart: null,
        scheduledEnd: null,
        actualStart: new Date('2025-01-20T09:00:00'),
        actualEnd: null,
        isEstimate: false,
      };

      expect(TimeNormalizer.isCheckedIn(normalized)).toBe(true);
    });

    it('출근 시간 없으면 false', () => {
      const normalized: NormalizedWorkTime = {
        scheduledStart: null,
        scheduledEnd: null,
        actualStart: null,
        actualEnd: null,
        isEstimate: true,
      };

      expect(TimeNormalizer.isCheckedIn(normalized)).toBe(false);
    });
  });

  // ==========================================================================
  // isCheckedOut: 퇴근 여부 확인
  // ==========================================================================
  describe('isCheckedOut', () => {
    it('퇴근 시간 있으면 true', () => {
      const normalized: NormalizedWorkTime = {
        scheduledStart: null,
        scheduledEnd: null,
        actualStart: new Date('2025-01-20T09:00:00'),
        actualEnd: new Date('2025-01-20T18:00:00'),
        isEstimate: false,
      };

      expect(TimeNormalizer.isCheckedOut(normalized)).toBe(true);
    });

    it('퇴근 시간 없으면 false', () => {
      const normalized: NormalizedWorkTime = {
        scheduledStart: null,
        scheduledEnd: null,
        actualStart: new Date('2025-01-20T09:00:00'),
        actualEnd: null,
        isEstimate: false,
      };

      expect(TimeNormalizer.isCheckedOut(normalized)).toBe(false);
    });
  });
});

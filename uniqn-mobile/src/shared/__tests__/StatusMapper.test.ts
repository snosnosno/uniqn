/**
 * StatusMapper 테스트
 *
 * @description Phase 1 - 상태 매핑 통합
 * 7개 상태 타입 간 변환 로직 테스트
 */

import { StatusMapper } from '../status/StatusMapper';
import type { WorkLogStatus, ApplicationStatus } from '../status/types';

describe('StatusMapper', () => {
  // ==========================================================================
  // toAttendance: WorkLogStatus → AttendanceStatus
  // ==========================================================================
  describe('toAttendance', () => {
    it.each([
      ['scheduled', 'not_started'],
      ['checked_in', 'checked_in'],
      ['checked_out', 'checked_out'],
      ['completed', 'checked_out'],
      ['cancelled', 'not_started'],
    ] as const)(
      'WorkLogStatus %s → AttendanceStatus %s',
      (input, expected) => {
        expect(StatusMapper.toAttendance(input as WorkLogStatus)).toBe(expected);
      }
    );
  });

  // ==========================================================================
  // workLogToSchedule: WorkLogStatus → ScheduleType
  // ==========================================================================
  describe('workLogToSchedule', () => {
    it.each([
      ['scheduled', 'confirmed'],
      ['checked_in', 'confirmed'], // WorkLog가 있다는 것 = 확정됨
      ['checked_out', 'completed'],
      ['completed', 'completed'],
      ['cancelled', 'cancelled'],
    ] as const)(
      'WorkLogStatus %s → ScheduleType %s',
      (input, expected) => {
        expect(StatusMapper.workLogToSchedule(input as WorkLogStatus)).toBe(
          expected
        );
      }
    );
  });

  // ==========================================================================
  // applicationToSchedule: ApplicationStatus → ScheduleType | null
  // ==========================================================================
  describe('applicationToSchedule', () => {
    it.each([
      ['applied', 'applied'],
      ['pending', 'applied'],
      ['confirmed', 'confirmed'],
      ['rejected', null], // 거절된 지원은 스케줄에 표시하지 않음
      ['cancelled', 'cancelled'],
      ['completed', 'completed'],
      ['cancellation_pending', 'confirmed'], // 취소 요청 중이지만 아직 확정 상태
    ] as const)(
      'ApplicationStatus %s → ScheduleType %s',
      (input, expected) => {
        expect(
          StatusMapper.applicationToSchedule(input as ApplicationStatus)
        ).toBe(expected);
      }
    );
  });

  // ==========================================================================
  // toConfirmedStaff: WorkLogStatus → ConfirmedStaffStatus
  // ==========================================================================
  describe('toConfirmedStaff', () => {
    it.each([
      ['scheduled', 'scheduled'],
      ['checked_in', 'checked_in'],
      ['checked_out', 'checked_out'],
      ['completed', 'completed'],
      ['cancelled', 'cancelled'],
    ] as const)(
      'WorkLogStatus %s → ConfirmedStaffStatus %s',
      (input, expected) => {
        expect(StatusMapper.toConfirmedStaff(input as WorkLogStatus)).toBe(
          expected
        );
      }
    );
  });

  // ==========================================================================
  // canTransition: 상태 전이 유효성 검증
  // ==========================================================================
  describe('canTransition', () => {
    // 유효한 전이
    it.each([
      ['scheduled', 'checked_in'],
      ['checked_in', 'checked_out'],
      ['checked_out', 'completed'],
      ['scheduled', 'cancelled'],
    ] as const)('✅ %s → %s 허용', (from, to) => {
      expect(
        StatusMapper.canTransition(from as WorkLogStatus, to as WorkLogStatus)
      ).toBe(true);
    });

    // 무효한 전이
    it.each([
      ['checked_in', 'scheduled'], // 역방향
      ['completed', 'checked_in'], // 완료 후 변경
      ['cancelled', 'scheduled'], // 취소 후 복구
      ['checked_out', 'checked_in'], // 퇴근 후 출근
      ['completed', 'cancelled'], // 완료 후 취소 불가
    ] as const)('❌ %s → %s 거부', (from, to) => {
      expect(
        StatusMapper.canTransition(from as WorkLogStatus, to as WorkLogStatus)
      ).toBe(false);
    });
  });

  // ==========================================================================
  // getNextValidStatuses: 현재 상태에서 가능한 다음 상태들
  // ==========================================================================
  describe('getNextValidStatuses', () => {
    it('scheduled → [checked_in, cancelled]', () => {
      const nextStatuses = StatusMapper.getNextValidStatuses('scheduled');
      expect(nextStatuses).toContain('checked_in');
      expect(nextStatuses).toContain('cancelled');
      expect(nextStatuses).not.toContain('completed');
    });

    it('checked_in → [checked_out]', () => {
      const nextStatuses = StatusMapper.getNextValidStatuses('checked_in');
      expect(nextStatuses).toContain('checked_out');
      expect(nextStatuses).not.toContain('cancelled');
    });

    it('checked_out → [completed]', () => {
      const nextStatuses = StatusMapper.getNextValidStatuses('checked_out');
      expect(nextStatuses).toContain('completed');
    });

    it('completed → [] (종료 상태)', () => {
      const nextStatuses = StatusMapper.getNextValidStatuses('completed');
      expect(nextStatuses).toHaveLength(0);
    });

    it('cancelled → [] (종료 상태)', () => {
      const nextStatuses = StatusMapper.getNextValidStatuses('cancelled');
      expect(nextStatuses).toHaveLength(0);
    });
  });

  // ==========================================================================
  // isCancellationPending: 취소 요청 상태 확인
  // ==========================================================================
  describe('isCancellationPending', () => {
    it('status가 cancellation_pending이면 true', () => {
      expect(
        StatusMapper.isCancellationPending({
          status: 'cancellation_pending',
        })
      ).toBe(true);
    });

    it('cancellationRequest.status가 pending이면 true', () => {
      expect(
        StatusMapper.isCancellationPending({
          status: 'confirmed',
          cancellationRequest: { status: 'pending' },
        })
      ).toBe(true);
    });

    it('둘 다 아니면 false', () => {
      expect(
        StatusMapper.isCancellationPending({
          status: 'confirmed',
        })
      ).toBe(false);

      expect(
        StatusMapper.isCancellationPending({
          status: 'confirmed',
          cancellationRequest: { status: 'rejected' },
        })
      ).toBe(false);
    });
  });

  // ==========================================================================
  // isTerminalStatus: 종료 상태 확인
  // ==========================================================================
  describe('isTerminalStatus', () => {
    it.each(['completed', 'cancelled'] as const)(
      '%s는 종료 상태',
      (status) => {
        expect(StatusMapper.isTerminalStatus(status)).toBe(true);
      }
    );

    it.each(['scheduled', 'checked_in', 'checked_out'] as const)(
      '%s는 종료 상태 아님',
      (status) => {
        expect(StatusMapper.isTerminalStatus(status)).toBe(false);
      }
    );
  });
});

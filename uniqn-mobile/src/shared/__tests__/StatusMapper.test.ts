import { StatusMapper } from '../status/StatusMapper';
import type { ApplicationStatus, WorkLogStatus } from '../status/types';

describe('StatusMapper', () => {
  describe('toAttendance', () => {
    it.each([
      ['scheduled', 'not_started'],
      ['checked_in', 'checked_in'],
      ['checked_out', 'checked_out'],
      ['completed', 'checked_out'],
      ['cancelled', 'not_started'],
      ['no_show', 'not_started'],
    ] as const)('maps WorkLogStatus %s to AttendanceStatus %s', (input, expected) => {
      expect(StatusMapper.toAttendance(input as WorkLogStatus)).toBe(expected);
    });
  });

  describe('workLogToSchedule', () => {
    it.each([
      ['scheduled', 'confirmed'],
      ['checked_in', 'confirmed'],
      ['checked_out', 'completed'],
      ['completed', 'completed'],
      ['cancelled', 'cancelled'],
      // 예전엔 'cancelled' 를 기대했다 — 그 기대가 결함을 고정하고 있었다. 노쇼는 스태프의
      // 평판·정산에 불리한 기록이라 취소로 접히면 본인만 사실을 모르고 이의 제기 기회를 놓친다.
      ['no_show', 'no_show'],
    ] as const)('maps WorkLogStatus %s to ScheduleType %s', (input, expected) => {
      expect(StatusMapper.workLogToSchedule(input as WorkLogStatus)).toBe(expected);
    });

    it('노쇼와 취소를 서로 다른 ScheduleType 으로 가른다', () => {
      expect(StatusMapper.workLogToSchedule('no_show')).not.toBe(
        StatusMapper.workLogToSchedule('cancelled')
      );
    });
  });

  describe('applicationToSchedule', () => {
    it.each([
      ['applied', 'applied'],
      ['confirmed', 'confirmed'],
      ['rejected', null],
      ['cancelled', 'cancelled'],
      ['completed', 'completed'],
      ['cancellation_pending', 'confirmed'],
    ] as const)('maps ApplicationStatus %s to ScheduleType %s', (input, expected) => {
      expect(StatusMapper.applicationToSchedule(input as ApplicationStatus)).toBe(expected);
    });
  });

  describe('toConfirmedStaff', () => {
    it.each([
      ['scheduled', 'scheduled'],
      ['checked_in', 'checked_in'],
      ['checked_out', 'checked_out'],
      ['completed', 'completed'],
      ['cancelled', 'cancelled'],
      ['no_show', 'no_show'],
    ] as const)('maps WorkLogStatus %s to ConfirmedStaffStatus %s', (input, expected) => {
      expect(StatusMapper.toConfirmedStaff(input as WorkLogStatus)).toBe(expected);
    });
  });

  describe('canTransition', () => {
    it.each([
      ['scheduled', 'checked_in'],
      ['scheduled', 'cancelled'],
      ['scheduled', 'no_show'],
      ['checked_in', 'checked_out'],
      ['checked_in', 'no_show'],
      ['checked_out', 'completed'],
    ] as const)('allows %s -> %s', (from, to) => {
      expect(StatusMapper.canTransition(from as WorkLogStatus, to as WorkLogStatus)).toBe(true);
    });

    it.each([
      ['checked_in', 'scheduled'],
      ['completed', 'checked_in'],
      ['cancelled', 'scheduled'],
      ['checked_out', 'checked_in'],
      ['completed', 'cancelled'],
      ['no_show', 'scheduled'],
    ] as const)('rejects %s -> %s', (from, to) => {
      expect(StatusMapper.canTransition(from as WorkLogStatus, to as WorkLogStatus)).toBe(false);
    });
  });

  describe('getNextValidStatuses', () => {
    it('returns checked_in, cancelled, and no_show from scheduled', () => {
      const nextStatuses = StatusMapper.getNextValidStatuses('scheduled');
      expect(nextStatuses).toEqual(expect.arrayContaining(['checked_in', 'cancelled', 'no_show']));
      expect(nextStatuses).not.toContain('completed');
    });

    it('returns checked_out and no_show from checked_in', () => {
      const nextStatuses = StatusMapper.getNextValidStatuses('checked_in');
      expect(nextStatuses).toEqual(expect.arrayContaining(['checked_out', 'no_show']));
      expect(nextStatuses).not.toContain('cancelled');
    });

    it('returns completed from checked_out', () => {
      const nextStatuses = StatusMapper.getNextValidStatuses('checked_out');
      expect(nextStatuses).toContain('completed');
    });

    it('returns no next statuses from completed', () => {
      expect(StatusMapper.getNextValidStatuses('completed')).toHaveLength(0);
    });

    it('returns no next statuses from cancelled', () => {
      expect(StatusMapper.getNextValidStatuses('cancelled')).toHaveLength(0);
    });

    it('returns no next statuses from no_show', () => {
      expect(StatusMapper.getNextValidStatuses('no_show')).toHaveLength(0);
    });
  });

  describe('isCancellationPending', () => {
    it('returns true for cancellation_pending status', () => {
      expect(StatusMapper.isCancellationPending({ status: 'cancellation_pending' })).toBe(true);
    });

    it('returns true for pending cancellationRequest', () => {
      expect(
        StatusMapper.isCancellationPending({
          status: 'confirmed',
          cancellationRequest: { status: 'pending' },
        })
      ).toBe(true);
    });

    it('returns false otherwise', () => {
      expect(StatusMapper.isCancellationPending({ status: 'confirmed' })).toBe(false);
      expect(
        StatusMapper.isCancellationPending({
          status: 'confirmed',
          cancellationRequest: { status: 'rejected' },
        })
      ).toBe(false);
    });
  });

  describe('isTerminalStatus', () => {
    it.each(['completed', 'cancelled', 'no_show'] as const)('treats %s as terminal', (status) => {
      expect(StatusMapper.isTerminalStatus(status)).toBe(true);
    });

    it.each(['scheduled', 'checked_in', 'checked_out'] as const)(
      'treats %s as non-terminal',
      (status) => {
        expect(StatusMapper.isTerminalStatus(status)).toBe(false);
      }
    );
  });
});

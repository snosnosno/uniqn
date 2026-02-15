/**
 * ApplicationStatusMachine 테스트
 *
 * @description 지원서 상태 전이 규칙 테스트
 * - 상태 전이 테이블 검증
 * - 역할별 가능 액션 확인
 * - 메타데이터 조회
 * - 최종 상태 / 취소 가능 상태 확인
 */

import { ApplicationStatusMachine } from '../ApplicationStatusMachine';
import type { StatusAction } from '../ApplicationStatusMachine';

describe('ApplicationStatusMachine', () => {
  const machine = new ApplicationStatusMachine();

  // ============================================================================
  // canTransition 테스트 - 유효한 전이
  // ============================================================================
  describe('canTransition - 유효한 전이', () => {
    it.each([
      ['applied', 'CONFIRM', 'confirmed'],
      ['applied', 'REJECT', 'rejected'],
      ['applied', 'CANCEL', 'cancelled'],
      ['pending', 'CONFIRM', 'confirmed'],
      ['pending', 'REJECT', 'rejected'],
      ['pending', 'CANCEL', 'cancelled'],
      ['confirmed', 'REQUEST_CANCEL', 'cancellation_pending'],
      ['confirmed', 'COMPLETE', 'completed'],
      ['cancellation_pending', 'APPROVE_CANCEL', 'cancelled'],
      ['cancellation_pending', 'REJECT_CANCEL', 'confirmed'],
    ] as const)('%s + %s → %s', (current, action, expected) => {
      const result = machine.canTransition(current, action as StatusAction);
      expect(result.allowed).toBe(true);
      expect(result.nextStatus).toBe(expected);
    });
  });

  // ============================================================================
  // canTransition 테스트 - 무효한 전이
  // ============================================================================
  describe('canTransition - 무효한 전이', () => {
    it.each([
      ['rejected', 'CONFIRM'],
      ['rejected', 'CANCEL'],
      ['cancelled', 'CONFIRM'],
      ['cancelled', 'REQUEST_CANCEL'],
      ['completed', 'CANCEL'],
      ['completed', 'CONFIRM'],
      ['applied', 'REQUEST_CANCEL'],
      ['applied', 'COMPLETE'],
      ['confirmed', 'CANCEL'], // 확정 후 직접 취소 불가
      ['confirmed', 'CONFIRM'],
      ['cancellation_pending', 'CANCEL'],
    ] as const)('%s + %s → 거부', (current, action) => {
      const result = machine.canTransition(current, action as StatusAction);
      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
    });
  });

  // ============================================================================
  // transition 테스트
  // ============================================================================
  describe('transition', () => {
    it('유효한 전이 시 다음 상태 반환', () => {
      const nextStatus = machine.transition('applied', 'CONFIRM');
      expect(nextStatus).toBe('confirmed');
    });

    it('무효한 전이 시 에러 throw', () => {
      expect(() => machine.transition('rejected', 'CONFIRM')).toThrow();
    });

    it('최종 상태에서 전이 시 에러 메시지에 상태명 포함', () => {
      expect(() => machine.transition('completed', 'CANCEL')).toThrow('완료');
    });
  });

  // ============================================================================
  // getAvailableActions 테스트
  // ============================================================================
  describe('getAvailableActions', () => {
    it('applied 상태에서 가능한 액션: CONFIRM, REJECT, CANCEL', () => {
      const actions = machine.getAvailableActions('applied');
      expect(actions).toContain('CONFIRM');
      expect(actions).toContain('REJECT');
      expect(actions).toContain('CANCEL');
    });

    it('confirmed 상태에서 가능한 액션: REQUEST_CANCEL, COMPLETE', () => {
      const actions = machine.getAvailableActions('confirmed');
      expect(actions).toContain('REQUEST_CANCEL');
      expect(actions).toContain('COMPLETE');
      expect(actions).not.toContain('CANCEL');
    });

    it('최종 상태(rejected)에서는 빈 배열', () => {
      const actions = machine.getAvailableActions('rejected');
      expect(actions).toHaveLength(0);
    });

    it('최종 상태(cancelled)에서는 빈 배열', () => {
      const actions = machine.getAvailableActions('cancelled');
      expect(actions).toHaveLength(0);
    });

    it('최종 상태(completed)에서는 빈 배열', () => {
      const actions = machine.getAvailableActions('completed');
      expect(actions).toHaveLength(0);
    });

    it('cancellation_pending에서 가능한 액션: APPROVE_CANCEL, REJECT_CANCEL', () => {
      const actions = machine.getAvailableActions('cancellation_pending');
      expect(actions).toContain('APPROVE_CANCEL');
      expect(actions).toContain('REJECT_CANCEL');
    });
  });

  // ============================================================================
  // getAvailableStaffActions 테스트
  // ============================================================================
  describe('getAvailableStaffActions', () => {
    it('applied 상태에서 스태프 액션: CANCEL', () => {
      const actions = machine.getAvailableStaffActions('applied');
      expect(actions).toContain('CANCEL');
      expect(actions).not.toContain('CONFIRM');
    });

    it('pending 상태에서 스태프 액션: CANCEL', () => {
      const actions = machine.getAvailableStaffActions('pending');
      expect(actions).toContain('CANCEL');
    });

    it('confirmed 상태에서 스태프 액션: REQUEST_CANCEL', () => {
      const actions = machine.getAvailableStaffActions('confirmed');
      expect(actions).toContain('REQUEST_CANCEL');
      expect(actions).not.toContain('CANCEL');
    });

    it('최종 상태에서 스태프 액션: 없음', () => {
      expect(machine.getAvailableStaffActions('rejected')).toHaveLength(0);
      expect(machine.getAvailableStaffActions('cancelled')).toHaveLength(0);
      expect(machine.getAvailableStaffActions('completed')).toHaveLength(0);
    });
  });

  // ============================================================================
  // getAvailableEmployerActions 테스트
  // ============================================================================
  describe('getAvailableEmployerActions', () => {
    it('applied 상태에서 구인자 액션: CONFIRM, REJECT', () => {
      const actions = machine.getAvailableEmployerActions('applied');
      expect(actions).toContain('CONFIRM');
      expect(actions).toContain('REJECT');
      expect(actions).not.toContain('CANCEL');
    });

    it('cancellation_pending 상태에서 구인자 액션: APPROVE_CANCEL, REJECT_CANCEL', () => {
      const actions = machine.getAvailableEmployerActions('cancellation_pending');
      expect(actions).toContain('APPROVE_CANCEL');
      expect(actions).toContain('REJECT_CANCEL');
    });

    it('confirmed 상태에서 구인자 액션: 없음 (COMPLETE은 시스템)', () => {
      const actions = machine.getAvailableEmployerActions('confirmed');
      expect(actions).not.toContain('COMPLETE');
    });
  });

  // ============================================================================
  // getStatusMetadata 테스트
  // ============================================================================
  describe('getStatusMetadata', () => {
    it('각 상태의 메타데이터에 필수 필드가 있다', () => {
      const statuses = [
        'applied',
        'pending',
        'confirmed',
        'rejected',
        'cancelled',
        'completed',
        'cancellation_pending',
      ] as const;

      for (const status of statuses) {
        const metadata = machine.getStatusMetadata(status);
        expect(metadata.label).toBeDefined();
        expect(metadata.labelEn).toBeDefined();
        expect(metadata.color).toBeDefined();
        expect(metadata.bgColor).toBeDefined();
        expect(metadata.description).toBeDefined();
        expect(typeof metadata.isFinal).toBe('boolean');
        expect(typeof metadata.canStaffCancel).toBe('boolean');
        expect(typeof metadata.canStaffRequestCancel).toBe('boolean');
      }
    });
  });

  // ============================================================================
  // isFinalStatus 테스트
  // ============================================================================
  describe('isFinalStatus', () => {
    it.each([
      ['rejected', true],
      ['cancelled', true],
      ['completed', true],
      ['applied', false],
      ['pending', false],
      ['confirmed', false],
      ['cancellation_pending', false],
    ] as const)('%s → isFinal: %s', (status, expected) => {
      expect(machine.isFinalStatus(status)).toBe(expected);
    });
  });

  // ============================================================================
  // canStaffDirectCancel / canStaffRequestCancel 테스트
  // ============================================================================
  describe('canStaffDirectCancel', () => {
    it('applied/pending은 직접 취소 가능', () => {
      expect(machine.canStaffDirectCancel('applied')).toBe(true);
      expect(machine.canStaffDirectCancel('pending')).toBe(true);
    });

    it('confirmed은 직접 취소 불가', () => {
      expect(machine.canStaffDirectCancel('confirmed')).toBe(false);
    });

    it('최종 상태는 직접 취소 불가', () => {
      expect(machine.canStaffDirectCancel('rejected')).toBe(false);
      expect(machine.canStaffDirectCancel('cancelled')).toBe(false);
      expect(machine.canStaffDirectCancel('completed')).toBe(false);
    });
  });

  describe('canStaffRequestCancel', () => {
    it('confirmed만 취소 요청 가능', () => {
      expect(machine.canStaffRequestCancel('confirmed')).toBe(true);
    });

    it('applied/pending은 취소 요청 불필요 (직접 취소 가능)', () => {
      expect(machine.canStaffRequestCancel('applied')).toBe(false);
      expect(machine.canStaffRequestCancel('pending')).toBe(false);
    });

    it('cancellation_pending은 이미 요청 중이므로 불가', () => {
      expect(machine.canStaffRequestCancel('cancellation_pending')).toBe(false);
    });
  });
});

/**
 * UNIQN Mobile - Application Status Machine
 *
 * @description 지원서 상태 전이 규칙 관리
 * @version 1.0.0
 *
 * ## 상태 전이 다이어그램
 *
 * ```
 * applied ──────┬──────► confirmed ──────► completed
 *    │          │            │
 *    │          │            ├──► cancellation_pending ──┬──► cancelled
 *    │          │            │                           │
 *    │          │            │                           └──► confirmed
 *    │          │            │
 *    ▼          ▼            ▼
 * cancelled  rejected     cancelled (직접 취소 불가, 요청 필요)
 * ```
 */

import type { ApplicationStatus } from '@/types';

// ============================================================================
// Types
// ============================================================================

/**
 * 상태 전이 액션
 */
export type StatusAction =
  | 'APPLY'           // 지원하기
  | 'CONFIRM'         // 확정하기 (구인자)
  | 'REJECT'          // 거절하기 (구인자)
  | 'CANCEL'          // 취소하기 (스태프, applied/pending만)
  | 'REQUEST_CANCEL'  // 취소 요청 (스태프, confirmed만)
  | 'APPROVE_CANCEL'  // 취소 요청 승인 (구인자)
  | 'REJECT_CANCEL'   // 취소 요청 거절 (구인자)
  | 'COMPLETE';       // 완료 처리 (시스템)

/**
 * 상태 전이 결과
 */
export interface TransitionResult {
  allowed: boolean;
  nextStatus?: ApplicationStatus;
  reason?: string;
}

/**
 * 상태별 메타데이터
 */
export interface StatusMetadata {
  label: string;
  labelEn: string;
  color: string;
  bgColor: string;
  description: string;
  isFinal: boolean;
  canStaffCancel: boolean;
  canStaffRequestCancel: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * 상태 전이 테이블
 *
 * 키: 현재 상태
 * 값: 액션 → 다음 상태 매핑
 */
const TRANSITION_TABLE: Record<ApplicationStatus, Partial<Record<StatusAction, ApplicationStatus>>> = {
  applied: {
    CONFIRM: 'confirmed',
    REJECT: 'rejected',
    CANCEL: 'cancelled',
  },
  pending: {
    CONFIRM: 'confirmed',
    REJECT: 'rejected',
    CANCEL: 'cancelled',
  },
  confirmed: {
    REQUEST_CANCEL: 'cancellation_pending',
    COMPLETE: 'completed',
  },
  rejected: {
    // 최종 상태 - 전이 없음
  },
  cancelled: {
    // 최종 상태 - 전이 없음
  },
  completed: {
    // 최종 상태 - 전이 없음
  },
  cancellation_pending: {
    APPROVE_CANCEL: 'cancelled',
    REJECT_CANCEL: 'confirmed',
  },
};

/**
 * 상태별 메타데이터
 */
const STATUS_METADATA: Record<ApplicationStatus, StatusMetadata> = {
  applied: {
    label: '지원 완료',
    labelEn: 'Applied',
    color: '#A855F7', // primary-500
    bgColor: '#DBEAFE', // primary-100
    description: '지원이 완료되었습니다. 구인자의 검토를 기다리고 있습니다.',
    isFinal: false,
    canStaffCancel: true,
    canStaffRequestCancel: false,
  },
  pending: {
    label: '검토 중',
    labelEn: 'Pending',
    color: '#F59E0B', // amber-500
    bgColor: '#FEF3C7', // amber-100
    description: '구인자가 지원서를 검토하고 있습니다.',
    isFinal: false,
    canStaffCancel: true,
    canStaffRequestCancel: false,
  },
  confirmed: {
    label: '확정',
    labelEn: 'Confirmed',
    color: '#10B981', // emerald-500
    bgColor: '#D1FAE5', // emerald-100
    description: '지원이 확정되었습니다. 일정에 따라 근무해주세요.',
    isFinal: false,
    canStaffCancel: false,
    canStaffRequestCancel: true,
  },
  rejected: {
    label: '거절됨',
    labelEn: 'Rejected',
    color: '#EF4444', // red-500
    bgColor: '#FEE2E2', // red-100
    description: '아쉽게도 이번 지원은 거절되었습니다.',
    isFinal: true,
    canStaffCancel: false,
    canStaffRequestCancel: false,
  },
  cancelled: {
    label: '취소됨',
    labelEn: 'Cancelled',
    color: '#6B7280', // gray-500
    bgColor: '#F3F4F6', // gray-100
    description: '지원이 취소되었습니다.',
    isFinal: true,
    canStaffCancel: false,
    canStaffRequestCancel: false,
  },
  completed: {
    label: '완료',
    labelEn: 'Completed',
    color: '#8B5CF6', // violet-500
    bgColor: '#EDE9FE', // violet-100
    description: '근무가 완료되었습니다. 수고하셨습니다!',
    isFinal: true,
    canStaffCancel: false,
    canStaffRequestCancel: false,
  },
  cancellation_pending: {
    label: '취소 요청 중',
    labelEn: 'Cancellation Pending',
    color: '#F97316', // orange-500
    bgColor: '#FFEDD5', // orange-100
    description: '취소 요청이 제출되었습니다. 구인자의 검토를 기다리고 있습니다.',
    isFinal: false,
    canStaffCancel: false,
    canStaffRequestCancel: false,
  },
};

// ============================================================================
// Application Status Machine
// ============================================================================

/**
 * 지원서 상태 머신
 *
 * @description 상태 전이 규칙을 중앙에서 관리하여 일관성 보장
 *
 * @example
 * ```typescript
 * const machine = new ApplicationStatusMachine();
 *
 * // 전이 가능 여부 확인
 * const result = machine.canTransition('applied', 'CONFIRM');
 * if (result.allowed) {
 *   console.log('다음 상태:', result.nextStatus);
 * }
 *
 * // 스태프 액션 확인
 * const actions = machine.getAvailableStaffActions('confirmed');
 * // ['REQUEST_CANCEL']
 * ```
 */
export class ApplicationStatusMachine {
  /**
   * 상태 전이 가능 여부 확인
   *
   * @param currentStatus - 현재 상태
   * @param action - 수행할 액션
   * @returns 전이 결과
   */
  canTransition(currentStatus: ApplicationStatus, action: StatusAction): TransitionResult {
    const transitions = TRANSITION_TABLE[currentStatus];
    const nextStatus = transitions?.[action];

    if (!nextStatus) {
      return {
        allowed: false,
        reason: this.getDisallowedReason(currentStatus, action),
      };
    }

    return {
      allowed: true,
      nextStatus,
    };
  }

  /**
   * 상태 전이 실행 (다음 상태 반환)
   *
   * @param currentStatus - 현재 상태
   * @param action - 수행할 액션
   * @returns 다음 상태
   * @throws Error 전이 불가능한 경우
   */
  transition(currentStatus: ApplicationStatus, action: StatusAction): ApplicationStatus {
    const result = this.canTransition(currentStatus, action);

    if (!result.allowed || !result.nextStatus) {
      throw new Error(result.reason ?? `Invalid transition: ${currentStatus} -> ${action}`);
    }

    return result.nextStatus;
  }

  /**
   * 현재 상태에서 가능한 모든 액션 조회
   *
   * @param currentStatus - 현재 상태
   * @returns 가능한 액션 목록
   */
  getAvailableActions(currentStatus: ApplicationStatus): StatusAction[] {
    const transitions = TRANSITION_TABLE[currentStatus];
    return Object.keys(transitions ?? {}) as StatusAction[];
  }

  /**
   * 스태프가 수행 가능한 액션 조회
   *
   * @param currentStatus - 현재 상태
   * @returns 스태프 가능 액션 목록
   */
  getAvailableStaffActions(currentStatus: ApplicationStatus): StatusAction[] {
    const metadata = STATUS_METADATA[currentStatus];
    const actions: StatusAction[] = [];

    if (metadata.canStaffCancel) {
      actions.push('CANCEL');
    }
    if (metadata.canStaffRequestCancel) {
      actions.push('REQUEST_CANCEL');
    }

    return actions;
  }

  /**
   * 구인자가 수행 가능한 액션 조회
   *
   * @param currentStatus - 현재 상태
   * @returns 구인자 가능 액션 목록
   */
  getAvailableEmployerActions(currentStatus: ApplicationStatus): StatusAction[] {
    const employerActions: StatusAction[] = [
      'CONFIRM',
      'REJECT',
      'APPROVE_CANCEL',
      'REJECT_CANCEL',
    ];

    return this.getAvailableActions(currentStatus).filter((action) =>
      employerActions.includes(action)
    );
  }

  /**
   * 상태 메타데이터 조회
   *
   * @param status - 상태
   * @returns 메타데이터
   */
  getStatusMetadata(status: ApplicationStatus): StatusMetadata {
    return STATUS_METADATA[status];
  }

  /**
   * 상태가 최종 상태인지 확인
   *
   * @param status - 상태
   * @returns 최종 상태 여부
   */
  isFinalStatus(status: ApplicationStatus): boolean {
    return STATUS_METADATA[status].isFinal;
  }

  /**
   * 스태프가 직접 취소 가능한 상태인지 확인
   *
   * @param status - 상태
   * @returns 직접 취소 가능 여부
   */
  canStaffDirectCancel(status: ApplicationStatus): boolean {
    return STATUS_METADATA[status].canStaffCancel;
  }

  /**
   * 스태프가 취소 요청 가능한 상태인지 확인
   *
   * @param status - 상태
   * @returns 취소 요청 가능 여부
   */
  canStaffRequestCancel(status: ApplicationStatus): boolean {
    return STATUS_METADATA[status].canStaffRequestCancel;
  }

  /**
   * 전이 불가 사유 생성
   */
  private getDisallowedReason(status: ApplicationStatus, action: StatusAction): string {
    const metadata = STATUS_METADATA[status];

    if (metadata.isFinal) {
      return `이미 ${metadata.label} 상태이므로 변경할 수 없습니다`;
    }

    switch (action) {
      case 'CANCEL':
        if (status === 'confirmed') {
          return '확정된 지원은 직접 취소할 수 없습니다. 취소 요청을 이용해주세요.';
        }
        return `${metadata.label} 상태에서는 취소할 수 없습니다`;

      case 'REQUEST_CANCEL':
        return `${metadata.label} 상태에서는 취소 요청을 할 수 없습니다`;

      case 'CONFIRM':
      case 'REJECT':
        return `${metadata.label} 상태에서는 확정/거절할 수 없습니다`;

      case 'APPROVE_CANCEL':
      case 'REJECT_CANCEL':
        return '취소 요청 대기 중인 지원서가 아닙니다';

      default:
        return `${metadata.label} 상태에서 해당 작업을 수행할 수 없습니다`;
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

/**
 * ApplicationStatusMachine 싱글톤 인스턴스
 */
export const applicationStatusMachine = new ApplicationStatusMachine();

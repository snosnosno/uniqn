/**
 * StatusMapper - 상태 변환 통합 클래스
 *
 * @description Phase 1 - 상태 매핑 통합
 * 7개 상태 타입 간 변환 로직을 단일 클래스로 통합
 */

import type {
  WorkLogStatus,
  ApplicationStatus,
  ScheduleType,
  AttendanceStatus,
  ConfirmedStaffStatus,
} from './types';
import { WORK_LOG_STATUS_FLOW, WORK_LOG_TERMINAL_STATUSES } from './statusFlow';

/**
 * 취소 요청 상태 확인을 위한 인터페이스
 */
interface CancellationCheckable {
  status: ApplicationStatus | string;
  cancellationRequest?: {
    status: 'pending' | 'approved' | 'rejected';
  };
}

/**
 * StatusMapper 클래스
 *
 * @description 모든 상태 변환 로직을 중앙 집중화
 * - WorkLogStatus → AttendanceStatus
 * - WorkLogStatus → ScheduleType
 * - ApplicationStatus → ScheduleType
 * - WorkLogStatus → ConfirmedStaffStatus
 * - 상태 전이 유효성 검증
 */
export class StatusMapper {
  // ===========================================================================
  // WorkLogStatus → AttendanceStatus
  // ===========================================================================

  /**
   * WorkLogStatus를 AttendanceStatus로 변환
   *
   * @description UI에서 출퇴근 상태 표시용
   * - scheduled, cancelled → not_started
   * - checked_in → checked_in
   * - checked_out, completed → checked_out
   */
  static toAttendance(status: WorkLogStatus): AttendanceStatus {
    switch (status) {
      case 'scheduled':
      case 'cancelled':
        return 'not_started';
      case 'checked_in':
        return 'checked_in';
      case 'checked_out':
      case 'completed':
        return 'checked_out';
      default:
        return 'not_started';
    }
  }

  // ===========================================================================
  // WorkLogStatus → ScheduleType
  // ===========================================================================

  /**
   * WorkLogStatus를 ScheduleType으로 변환
   *
   * @description 스케줄 목록에서 표시용
   * - scheduled, checked_in → confirmed (WorkLog가 있다는 것 = 확정됨)
   * - checked_out, completed → completed
   * - cancelled → cancelled
   */
  static workLogToSchedule(status: WorkLogStatus): ScheduleType {
    switch (status) {
      case 'scheduled':
      case 'checked_in':
        return 'confirmed';
      case 'checked_out':
      case 'completed':
        return 'completed';
      case 'cancelled':
        return 'cancelled';
      default:
        return 'confirmed';
    }
  }

  // ===========================================================================
  // ApplicationStatus → ScheduleType
  // ===========================================================================

  /**
   * ApplicationStatus를 ScheduleType으로 변환
   *
   * @description 스케줄 목록에서 지원 상태 표시용
   * - applied, pending → applied
   * - confirmed, cancellation_pending → confirmed
   * - rejected → null (스케줄에 표시하지 않음)
   * - cancelled → cancelled
   * - completed → completed
   */
  static applicationToSchedule(status: ApplicationStatus): ScheduleType | null {
    switch (status) {
      case 'applied':
      case 'pending':
        return 'applied';
      case 'confirmed':
      case 'cancellation_pending':
        return 'confirmed';
      case 'rejected':
        return null; // 거절된 지원은 스케줄에 표시하지 않음
      case 'cancelled':
        return 'cancelled';
      case 'completed':
        return 'completed';
      default:
        return null;
    }
  }

  // ===========================================================================
  // WorkLogStatus → ConfirmedStaffStatus
  // ===========================================================================

  /**
   * WorkLogStatus를 ConfirmedStaffStatus로 변환
   *
   * @description 확정 스태프 목록에서 상태 표시용
   * - 대부분 1:1 매핑
   * - no_show는 WorkLogStatus에 없으므로 별도 처리 필요
   */
  static toConfirmedStaff(status: WorkLogStatus): ConfirmedStaffStatus {
    // WorkLogStatus와 ConfirmedStaffStatus는 대부분 동일
    // no_show는 WorkLogStatus에 없으므로 이 함수에서는 변환하지 않음
    return status as ConfirmedStaffStatus;
  }

  // ===========================================================================
  // 상태 전이 유효성 검증
  // ===========================================================================

  /**
   * 상태 전이가 유효한지 검증
   *
   * @param from 현재 상태
   * @param to 목표 상태
   * @returns 전이 가능 여부
   */
  static canTransition(from: WorkLogStatus, to: WorkLogStatus): boolean {
    const allowedTransitions = WORK_LOG_STATUS_FLOW[from];
    return allowedTransitions.includes(to);
  }

  /**
   * 현재 상태에서 전이 가능한 다음 상태 목록 반환
   *
   * @param status 현재 상태
   * @returns 전이 가능한 상태 배열
   */
  static getNextValidStatuses(status: WorkLogStatus): WorkLogStatus[] {
    return WORK_LOG_STATUS_FLOW[status] || [];
  }

  // ===========================================================================
  // 특수 상태 확인
  // ===========================================================================

  /**
   * 취소 요청 중인 상태인지 확인
   *
   * @description 두 가지 방법으로 취소 요청 상태 확인:
   * 1. status가 'cancellation_pending'인 경우
   * 2. cancellationRequest.status가 'pending'인 경우
   */
  static isCancellationPending(item: CancellationCheckable): boolean {
    if (item.status === 'cancellation_pending') {
      return true;
    }

    if (item.cancellationRequest?.status === 'pending') {
      return true;
    }

    return false;
  }

  /**
   * 종료 상태인지 확인
   *
   * @description completed, cancelled는 종료 상태로 더 이상 전이 불가
   */
  static isTerminalStatus(status: WorkLogStatus): boolean {
    return WORK_LOG_TERMINAL_STATUSES.includes(status);
  }
}

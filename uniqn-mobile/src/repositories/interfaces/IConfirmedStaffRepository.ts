/**
 * UNIQN Mobile - Confirmed Staff Repository Interface
 *
 * @description 확정 스태프 데이터 접근 추상화
 * @version 1.0.0
 *
 * 책임:
 * 1. WorkLog 조회 (jobPostingId 기반)
 * 2. 역할 변경 트랜잭션
 * 3. 근무 시간 수정 트랜잭션
 * 4. 스태프 삭제 멀티 컬렉션 트랜잭션
 * 5. 실시간 구독
 */

import type { Unsubscribe } from 'firebase/firestore';
import type { WorkLog } from '@/types';
import type { ConfirmedStaffStatus } from '@/types/confirmedStaff';

// ============================================================================
// Input Types (Service → Repository)
// ============================================================================

/**
 * 역할 변경 입력 (Repository용)
 */
export interface UpdateRoleContext {
  workLogId: string;
  newRole: string;
  /** 표준 역할 여부 (true면 role에 저장, false면 customRole에 저장) */
  isStandardRole: boolean;
  reason: string;
  changedBy: string;
}

/**
 * 근무 시간 수정 입력 (Repository용)
 */
export interface UpdateConfirmedStaffWorkTimeContext {
  workLogId: string;
  /** 출근 시간 - Date | null (미정) */
  checkInTime: Date | null;
  /** 퇴근 시간 - Date | null (미정) */
  checkOutTime: Date | null;
  reason: string;
  modifiedBy: string;
}

/**
 * 스태프 삭제 입력 (Repository용)
 */
export interface DeleteConfirmedStaffContext {
  workLogId: string;
  jobPostingId: string;
  staffId: string;
  reason?: string;
}

/**
 * 노쇼 처리 입력 (Repository용)
 */
export interface MarkNoShowContext {
  workLogId: string;
  reason?: string;
}

// ============================================================================
// Subscription Types
// ============================================================================

/**
 * 실시간 구독 콜백
 */
export interface ConfirmedStaffSubscriptionCallbacks {
  onUpdate: (workLogs: WorkLog[]) => void;
  onError?: (error: Error) => void;
}

// ============================================================================
// Repository Interface
// ============================================================================

/**
 * Confirmed Staff Repository Interface
 *
 * @description 확정 스태프 관련 데이터 접근 추상화
 *
 * 주요 특징:
 * - WorkLog 컬렉션 기반 (확정 스태프 = jobPostingId가 있는 WorkLog)
 * - 멀티 컬렉션 트랜잭션 (WorkLog + Application + JobPosting)
 */
export interface IConfirmedStaffRepository {
  // ==========================================================================
  // Read Operations
  // ==========================================================================

  /**
   * 공고별 확정 스태프 목록 조회
   *
   * @description workLogs 컬렉션에서 jobPostingId로 필터링
   * @returns WorkLog 배열 (날짜순 정렬)
   */
  getByJobPostingId(jobPostingId: string): Promise<WorkLog[]>;

  /**
   * 날짜별 확정 스태프 조회
   *
   * @description 특정 공고의 특정 날짜 스태프만 조회
   */
  getByJobPostingAndDate(jobPostingId: string, date: string): Promise<WorkLog[]>;

  // ==========================================================================
  // Write Operations (Transactions)
  // ==========================================================================

  /**
   * 역할 변경 (트랜잭션)
   *
   * @description 스태프 역할 변경 및 이력 저장
   * - WorkLog 존재 확인
   * - 역할 변경 이력 추가 (roleChangeHistory)
   * - 표준 역할이면 role 필드에, 아니면 customRole 필드에 저장
   *
   * @throws BusinessError 근무 기록을 찾을 수 없는 경우
   */
  updateRoleWithTransaction(context: UpdateRoleContext): Promise<void>;

  /**
   * 근무 시간 수정 (트랜잭션)
   *
   * @description 출퇴근 시간 수정 및 이력 저장
   * - WorkLog 존재 확인
   * - 시간 수정 이력 추가 (modificationHistory)
   * - 시간에 따른 상태 자동 변경
   *
   * @throws BusinessError 근무 기록을 찾을 수 없는 경우
   */
  updateWorkTimeWithTransaction(context: UpdateConfirmedStaffWorkTimeContext): Promise<void>;

  /**
   * 확정 스태프 삭제 (멀티 컬렉션 트랜잭션)
   *
   * @description 스태프 확정 취소 및 관련 데이터 정리
   * - WorkLog: cancelled 상태로 변경
   * - Application: applied 상태로 복원
   * - JobPosting: filledPositions 감소
   *
   * @throws BusinessError 근무 기록/공고를 찾을 수 없는 경우
   * @throws BusinessError 이미 출퇴근한 스태프인 경우
   */
  deleteWithTransaction(context: DeleteConfirmedStaffContext): Promise<void>;

  /**
   * 노쇼 처리
   *
   * @description 스태프 노쇼 상태로 변경
   */
  markAsNoShow(context: MarkNoShowContext): Promise<void>;

  /**
   * 상태 변경
   *
   * @description 일반적인 상태 변경
   */
  updateStatus(workLogId: string, status: ConfirmedStaffStatus): Promise<void>;

  // ==========================================================================
  // Real-time Subscription
  // ==========================================================================

  /**
   * 확정 스태프 목록 실시간 구독
   *
   * @description 공고별 스태프 목록 변경 실시간 감지
   * @returns 구독 해제 함수
   */
  subscribeByJobPostingId(
    jobPostingId: string,
    callbacks: ConfirmedStaffSubscriptionCallbacks
  ): Unsubscribe;
}

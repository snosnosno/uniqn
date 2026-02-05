/**
 * UNIQN Mobile - Settlement Repository Interface
 *
 * @description 정산 데이터 접근 추상화
 * @version 1.0.0
 *
 * 책임:
 * 1. 근무 시간 수정 트랜잭션
 * 2. 개별/일괄 정산 처리 트랜잭션
 * 3. 정산 상태 변경 트랜잭션
 * 4. 소유권 검증 (공고 소유자만 정산 가능)
 */

import type { PayrollStatus } from '@/types';

// ============================================================================
// Input Types (Service → Repository)
// ============================================================================

/**
 * 근무 시간 수정 입력 (Repository용)
 */
export interface UpdateWorkTimeContext {
  workLogId: string;
  /** 출근 시간 - Date | null (미정) | undefined (변경 안함) */
  checkInTime?: Date | null;
  /** 퇴근 시간 - Date | null (미정) | undefined (변경 안함) */
  checkOutTime?: Date | null;
  notes?: string;
  reason?: string;
}

/**
 * 개별 정산 입력 (Repository용)
 */
export interface SettleWorkLogContext {
  workLogId: string;
  amount: number;
  notes?: string;
}

/**
 * 일괄 정산 대상 (Repository용)
 */
export interface BulkSettlementContext {
  workLogIds: string[];
  notes?: string;
}

// ============================================================================
// Result Types (Repository → Service)
// ============================================================================

/**
 * 개별 정산 결과
 */
export interface SettlementResultDTO {
  success: boolean;
  workLogId: string;
  amount: number;
  message: string;
}

/**
 * 일괄 정산 결과
 */
export interface BulkSettlementResultDTO {
  totalCount: number;
  successCount: number;
  failedCount: number;
  totalAmount: number;
  results: SettlementResultDTO[];
}

// ============================================================================
// Repository Interface
// ============================================================================

/**
 * Settlement Repository Interface
 *
 * @description 정산 관련 데이터 접근 추상화
 *
 * 트랜잭션 보장:
 * - 모든 메서드는 Firestore 트랜잭션 내에서 실행
 * - 소유권 검증 + 상태 확인 + 업데이트가 원자적으로 처리됨
 */
export interface ISettlementRepository {
  // ==========================================================================
  // Work Time Update
  // ==========================================================================

  /**
   * 근무 시간 수정
   *
   * @description 출퇴근 시간 수정 (트랜잭션)
   * - 소유권 검증 (공고 소유자만 가능)
   * - 이미 정산 완료된 경우 거부
   * - 수정 이력 기록
   *
   * @throws BusinessError 근무 기록/공고를 찾을 수 없는 경우
   * @throws PermissionError 소유권이 없는 경우
   * @throws AlreadySettledError 이미 정산 완료된 경우
   */
  updateWorkTimeWithTransaction(context: UpdateWorkTimeContext, ownerId: string): Promise<void>;

  // ==========================================================================
  // Settlement
  // ==========================================================================

  /**
   * 개별 정산 처리
   *
   * @description 단일 근무 기록 정산 완료 처리 (트랜잭션)
   * - 소유권 검증
   * - 출퇴근 완료 여부 확인
   * - 중복 정산 방지
   *
   * @returns 정산 결과 (성공/실패 + 메시지)
   */
  settleWorkLogWithTransaction(
    context: SettleWorkLogContext,
    ownerId: string
  ): Promise<SettlementResultDTO>;

  /**
   * 일괄 정산 처리
   *
   * @description 여러 근무 기록 한번에 정산 처리 (배치 트랜잭션)
   * - Firestore 배치 제한 (500개) 자동 분할
   * - 각 항목별 성공/실패 결과 반환
   * - 정산 금액 자동 계산 (SettlementCalculator 사용)
   *
   * @returns 일괄 정산 결과 (총 개수, 성공/실패 수, 상세 결과)
   */
  bulkSettlementWithTransaction(
    context: BulkSettlementContext,
    ownerId: string
  ): Promise<BulkSettlementResultDTO>;

  // ==========================================================================
  // Status Update
  // ==========================================================================

  /**
   * 정산 상태 변경
   *
   * @description 정산 상태만 변경 (금액 변경 없음)
   * - 소유권 검증
   * - completed로 변경 시 payrollDate 자동 설정
   *
   * @throws BusinessError 근무 기록/공고를 찾을 수 없는 경우
   * @throws PermissionError 소유권이 없는 경우
   */
  updatePayrollStatusWithTransaction(
    workLogId: string,
    status: PayrollStatus,
    ownerId: string
  ): Promise<void>;
}

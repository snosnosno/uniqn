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
 * 4. 인가 검증 (공고 소유자·워크스페이스 멤버·협업자)
 *
 * 주의: 모든 메서드의 `actorId`는 인가 주체(세션에서 파생한 현재 사용자 uid)다.
 * 공고 소유자 id(posting.ownerId)를 재주입하면 안 된다 — 인가는 actorId 기준으로 판정된다.
 */

import type { PayrollStatus } from '@/types';
import type { TaxSettings } from '@/utils/settlement';

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
  /** UI 확인용 금액. 저장 직전 canonical 규칙으로 다시 계산된다. */
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
 * - 모든 메서드는 DB 트랜잭션 내에서 실행
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
  updateWorkTimeWithTransaction(context: UpdateWorkTimeContext, actorId: string): Promise<void>;

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
    actorId: string
  ): Promise<SettlementResultDTO>;

  /**
   * 일괄 정산 처리
   *
   * @description 여러 근무 기록 한번에 정산 처리 (배치 트랜잭션)
   * - DB 배치 처리
   * - 각 항목별 성공/실패 결과 반환
   * - 정산 금액 자동 계산 (SettlementCalculator 사용)
   *
   * @returns 일괄 정산 결과 (총 개수, 성공/실패 수, 상세 결과)
   */
  bulkSettlementWithTransaction(
    context: BulkSettlementContext,
    actorId: string
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
   * - **completed → 그 외(지급 완료 되돌리기)** 는 금전 역행이라 추가 강제:
   *   사유 필수 · payrollDate 클리어 · settlementModificationHistory 감사 항목 append
   *
   * @param options.reason 지급 완료 되돌리기 사유. 되돌리기가 아니면 무시된다.
   *
   * @throws BusinessError 근무 기록/공고를 찾을 수 없는 경우
   * @throws PermissionError 소유권이 없는 경우
   * @throws ValidationError 되돌리기인데 사유가 비어 있는 경우
   */
  updatePayrollStatusWithTransaction(
    workLogId: string,
    status: PayrollStatus,
    actorId: string,
    options?: { reason?: string }
  ): Promise<void>;

  // ==========================================================================
  // Custom Settlement Settings
  // ==========================================================================

  /**
   * WorkLog 개인 정산 설정 수정
   *
   * @description 개별 근무 기록의 커스텀 급여/수당/세금 설정 저장 (트랜잭션)
   * - 소유권 검증
   * - 수정 이력 기록 (arrayUnion)
   *
   * @throws BusinessError 근무 기록/공고를 찾을 수 없는 경우
   * @throws PermissionError 소유권이 없는 경우
   */
  updateWorkLogCustomSettlement(
    workLogId: string,
    data: {
      customSalaryInfo: { type: string; amount: number };
      customAllowances?: Record<string, unknown>;
      customTaxSettings: TaxSettings;
      modificationEntry: Record<string, unknown>;
    },
    actorId: string
  ): Promise<void>;
}

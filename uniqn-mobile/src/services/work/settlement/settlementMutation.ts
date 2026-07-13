/**
 * UNIQN Mobile - 정산 뮤테이션 서비스
 *
 * @description 근무 시간 수정, 정산 처리, 상태 변경
 * @version 2.0.0 - Repository 패턴 적용
 *
 * 변경사항:
 * - Firebase 직접 호출 제거 → settlementRepository 사용
 * - validateWorkLogOwnership 중복 제거 (Repository 내부로 이동)
 * - 트랜잭션 로직 캡슐화
 */

import { logger } from '@/utils/logger';
import { settlementRepository } from '@/repositories';
import { requireCurrentUser } from '@/services/auth/authCoreService';
import { TimeNormalizer } from '@/shared/time';
import type { TaxSettings } from '@/utils/settlement';
import type { PayrollStatus } from '@/types';
import type {
  UpdateWorkTimeInput,
  SettleWorkLogInput,
  BulkSettlementInput,
  SettlementResult,
  BulkSettlementResult,
} from './types';

// ============================================================================
// Work Time Update
// ============================================================================

/**
 * 근무 시간 수정 (구인자용)
 *
 * @description 출퇴근 시간 수정 (사유 기록 필수)
 */
export async function updateWorkTimeForSettlement(
  input: UpdateWorkTimeInput,
  actorId: string
): Promise<void> {
  logger.info('근무 시간 수정 시작', { input, actorId });

  // TimeInput을 Date로 변환
  const checkInDate =
    input.checkInTime !== undefined ? TimeNormalizer.parseTime(input.checkInTime) : undefined;
  const checkOutDate =
    input.checkOutTime !== undefined ? TimeNormalizer.parseTime(input.checkOutTime) : undefined;

  await settlementRepository.updateWorkTimeWithTransaction(
    {
      workLogId: input.workLogId,
      checkInTime: checkInDate,
      checkOutTime: checkOutDate,
      notes: input.notes,
      reason: input.reason,
    },
    actorId
  );

  logger.info('근무 시간 수정 완료', { workLogId: input.workLogId });
}

// ============================================================================
// Individual Settlement
// ============================================================================

/**
 * 개별 정산 처리
 *
 * @description 단일 근무 기록 정산 완료 처리
 */
export async function settleWorkLog(
  input: SettleWorkLogInput,
  actorId: string
): Promise<SettlementResult> {
  logger.info('개별 정산 처리 시작', { input, actorId });

  const result = await settlementRepository.settleWorkLogWithTransaction(
    {
      workLogId: input.workLogId,
      amount: input.amount,
      notes: input.notes,
    },
    actorId
  );

  return {
    success: result.success,
    workLogId: result.workLogId,
    amount: result.amount,
    message: result.message,
  };
}

// ============================================================================
// Bulk Settlement
// ============================================================================

/**
 * 일괄 정산 처리
 *
 * @description 여러 근무 기록 한번에 정산 완료 처리
 */
export async function bulkSettlement(
  input: BulkSettlementInput,
  actorId: string
): Promise<BulkSettlementResult> {
  logger.info('일괄 정산 처리 시작', { count: input.workLogIds.length, actorId });

  const result = await settlementRepository.bulkSettlementWithTransaction(
    {
      workLogIds: input.workLogIds,
      notes: input.notes,
    },
    actorId
  );

  return {
    totalCount: result.totalCount,
    successCount: result.successCount,
    failedCount: result.failedCount,
    totalAmount: result.totalAmount,
    results: result.results.map((r) => ({
      success: r.success,
      workLogId: r.workLogId,
      amount: r.amount,
      message: r.message,
    })),
  };
}

// ============================================================================
// Custom Settlement Settings (WorkLog)
// ============================================================================

/**
 * WorkLog 개인 정산 설정 수정
 *
 * @description 개별 근무 기록의 커스텀 급여/수당/세금 설정 저장
 */
export async function updateWorkLogCustomSettlement(
  workLogId: string,
  data: {
    customSalaryInfo: { type: string; amount: number };
    customAllowances?: Record<string, unknown>;
    customTaxSettings: TaxSettings;
    modificationEntry: Record<string, unknown>;
  }
): Promise<void> {
  // 인가 주체·수정 이력 기록자는 세션에서 파생한다 — 클라이언트가 넘긴 값은 신뢰하지 않는다
  const actorId = (await requireCurrentUser()).id;

  logger.info('개인 정산 설정 저장 시작', { workLogId, actorId });

  await settlementRepository.updateWorkLogCustomSettlement(
    workLogId,
    {
      ...data,
      modificationEntry: { ...data.modificationEntry, modifiedBy: actorId },
    },
    actorId
  );

  logger.info('개인 정산 설정 저장 완료', { workLogId });
}

// ============================================================================
// Status Update
// ============================================================================

/**
 * 정산 상태 변경
 *
 * @description 정산 상태만 변경 (금액 변경 없음)
 */
export async function updateSettlementStatus(
  workLogId: string,
  status: PayrollStatus,
  actorId: string
): Promise<void> {
  logger.info('정산 상태 변경', { workLogId, status, actorId });

  await settlementRepository.updatePayrollStatusWithTransaction(workLogId, status, actorId);

  logger.info('정산 상태 변경 완료', { workLogId, status });
}

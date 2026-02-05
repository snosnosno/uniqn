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
import { TimeNormalizer } from '@/shared/time';
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
  ownerId: string
): Promise<void> {
  logger.info('근무 시간 수정 시작', { input, ownerId });

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
    ownerId
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
  ownerId: string
): Promise<SettlementResult> {
  logger.info('개별 정산 처리 시작', { input, ownerId });

  const result = await settlementRepository.settleWorkLogWithTransaction(
    {
      workLogId: input.workLogId,
      amount: input.amount,
      notes: input.notes,
    },
    ownerId
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
  ownerId: string
): Promise<BulkSettlementResult> {
  logger.info('일괄 정산 처리 시작', { count: input.workLogIds.length, ownerId });

  const result = await settlementRepository.bulkSettlementWithTransaction(
    {
      workLogIds: input.workLogIds,
      notes: input.notes,
    },
    ownerId
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
  ownerId: string
): Promise<void> {
  logger.info('정산 상태 변경', { workLogId, status, ownerId });

  await settlementRepository.updatePayrollStatusWithTransaction(workLogId, status, ownerId);

  logger.info('정산 상태 변경 완료', { workLogId, status });
}

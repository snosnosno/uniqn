/**
 * UNIQN Mobile - 정산 뮤테이션 서비스
 *
 * @description 근무 시간 수정, 정산 처리, 상태 변경
 * @version 1.0.0
 */

import {
  doc,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import {
  BusinessError,
  PermissionError,
  ERROR_CODES,
  AlreadySettledError,
} from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { FIREBASE_LIMITS } from '@/constants';
import { SettlementCalculator } from '@/domains/settlement';
import {
  getEffectiveSalaryInfoFromRoles,
  getEffectiveAllowances,
  getEffectiveTaxSettings,
} from '@/utils/settlement';
import { parseWorkLogDocument, parseJobPostingDocument } from '@/schemas';
import { IdNormalizer } from '@/shared/id';
import type { WorkLog, PayrollStatus, JobPosting } from '@/types';
import {
  WORK_LOGS_COLLECTION,
  JOB_POSTINGS_COLLECTION,
  type WorkLogWithOverrides,
  type UpdateWorkTimeInput,
  type SettleWorkLogInput,
  type BulkSettlementInput,
  type SettlementResult,
  type BulkSettlementResult,
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
  try {
    logger.info('근무 시간 수정 시작', { input, ownerId });

    await runTransaction(getFirebaseDb(), async (transaction) => {
      // 1. 근무 기록 조회
      const workLogRef = doc(getFirebaseDb(), WORK_LOGS_COLLECTION, input.workLogId);
      const workLogDoc = await transaction.get(workLogRef);

      if (!workLogDoc.exists()) {
        throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
          userMessage: '근무 기록을 찾을 수 없습니다',
        });
      }

      const workLog = parseWorkLogDocument({ id: workLogDoc.id, ...workLogDoc.data() });
      if (!workLog) {
        throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
          userMessage: '근무 기록 데이터를 파싱할 수 없습니다',
        });
      }

      // 2. 공고 조회 및 소유권 확인 (IdNormalizer로 ID 정규화)
      const normalizedJobId = IdNormalizer.normalizeJobId(workLog);
      const jobRef = doc(getFirebaseDb(), JOB_POSTINGS_COLLECTION, normalizedJobId);
      const jobDoc = await transaction.get(jobRef);

      if (!jobDoc.exists()) {
        throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
          userMessage: '공고를 찾을 수 없습니다',
        });
      }

      const jobPosting = parseJobPostingDocument({ id: jobDoc.id, ...jobDoc.data() });
      if (!jobPosting) {
        throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
          userMessage: '공고 데이터를 파싱할 수 없습니다',
        });
      }

      if (jobPosting.ownerId !== ownerId) {
        throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
          userMessage: '본인의 공고에 대한 근무 기록만 수정할 수 있습니다',
        });
      }

      // 3. 이미 정산 완료된 경우 수정 불가
      if (workLog.payrollStatus === 'completed') {
        throw new AlreadySettledError();
      }

      // 4. 수정 데이터 준비 (checkInTime/checkOutTime 사용, null = 미정)
      const updateData: Record<string, unknown> = {
        updatedAt: serverTimestamp(),
        // 시간 수정 시 기존 정산 계산 무효화 (재계산 필요)
        settlementBreakdown: null,
      };

      // checkInTime 설정 (undefined면 건드리지 않음, null이면 미정으로 저장)
      if (input.checkInTime !== undefined) {
        updateData.checkInTime = input.checkInTime ? Timestamp.fromDate(input.checkInTime) : null;
      }

      // checkOutTime 설정
      if (input.checkOutTime !== undefined) {
        updateData.checkOutTime = input.checkOutTime ? Timestamp.fromDate(input.checkOutTime) : null;
      }

      if (input.notes !== undefined) {
        updateData.notes = input.notes;
      }

      // 수정 이력 기록
      const prevCheckIn = workLog.checkInTime ?? null;
      const prevCheckOut = workLog.checkOutTime ?? null;

      const modificationLog = {
        modifiedAt: new Date().toISOString(),
        modifiedBy: ownerId,
        reason: input.reason || '시간 수정',
        previousStartTime: prevCheckIn ?? null,
        previousEndTime: prevCheckOut ?? null,
        newStartTime:
          input.checkInTime !== undefined
            ? input.checkInTime
              ? Timestamp.fromDate(input.checkInTime)
              : null
            : undefined,
        newEndTime:
          input.checkOutTime !== undefined
            ? input.checkOutTime
              ? Timestamp.fromDate(input.checkOutTime)
              : null
            : undefined,
      };

      updateData.modificationHistory = [...(workLog.modificationHistory || []), modificationLog];

      transaction.update(workLogRef, updateData);
    });

    logger.info('근무 시간 수정 완료', { workLogId: input.workLogId });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '근무 시간 수정',
      component: 'settlementService',
      context: { workLogId: input.workLogId, ownerId },
    });
  }
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
  try {
    logger.info('개별 정산 처리 시작', { input, ownerId });

    await runTransaction(getFirebaseDb(), async (transaction) => {
      // 1. 근무 기록 조회
      const workLogRef = doc(getFirebaseDb(), WORK_LOGS_COLLECTION, input.workLogId);
      const workLogDoc = await transaction.get(workLogRef);

      if (!workLogDoc.exists()) {
        throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
          userMessage: '근무 기록을 찾을 수 없습니다',
        });
      }

      const workLog = parseWorkLogDocument({ id: workLogDoc.id, ...workLogDoc.data() });
      if (!workLog) {
        throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
          userMessage: '근무 기록 데이터를 파싱할 수 없습니다',
        });
      }

      // 2. 공고 조회 및 소유권 확인 (IdNormalizer로 ID 정규화)
      const normalizedJobId = IdNormalizer.normalizeJobId(workLog);
      const jobRef = doc(getFirebaseDb(), JOB_POSTINGS_COLLECTION, normalizedJobId);
      const jobDoc = await transaction.get(jobRef);

      if (!jobDoc.exists()) {
        throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
          userMessage: '공고를 찾을 수 없습니다',
        });
      }

      const jobPosting = parseJobPostingDocument({ id: jobDoc.id, ...jobDoc.data() });
      if (!jobPosting) {
        throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
          userMessage: '공고 데이터를 파싱할 수 없습니다',
        });
      }

      if (jobPosting.ownerId !== ownerId) {
        throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
          userMessage: '본인의 공고에 대한 정산만 처리할 수 있습니다',
        });
      }

      // 3. 출퇴근 완료 여부 확인
      if (workLog.status !== 'checked_out' && workLog.status !== 'completed') {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '출퇴근이 완료된 근무 기록만 정산할 수 있습니다',
        });
      }

      // 4. 중복 정산 방지
      if (workLog.payrollStatus === 'completed') {
        throw new AlreadySettledError();
      }

      // 5. 정산 처리
      const updateData: Record<string, unknown> = {
        payrollStatus: 'completed',
        payrollAmount: input.amount,
        payrollDate: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // notes가 있을 때만 포함 (undefined는 Firebase에서 허용되지 않음)
      if (input.notes !== undefined) {
        updateData.payrollNotes = input.notes;
      }

      transaction.update(workLogRef, updateData);
    });

    logger.info('개별 정산 처리 완료', { workLogId: input.workLogId, amount: input.amount });

    return {
      success: true,
      workLogId: input.workLogId,
      amount: input.amount,
      message: '정산이 완료되었습니다',
    };
  } catch (error) {
    // 개별 정산은 성공/실패 결과를 반환하므로 throw 대신 로깅 후 반환
    logger.error('개별 정산 처리 실패', error instanceof Error ? error : undefined, { input });

    const message =
      error instanceof BusinessError || error instanceof PermissionError
        ? error.userMessage
        : error instanceof Error
          ? error.message
          : '정산 처리에 실패했습니다';

    return {
      success: false,
      workLogId: input.workLogId,
      amount: 0,
      message,
    };
  }
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
  try {
    logger.info('일괄 정산 처리 시작', { count: input.workLogIds.length, ownerId });

    const results: SettlementResult[] = [];
    let successCount = 0;
    let failedCount = 0;
    let totalAmount = 0;

    // Firestore 배치 제한
    const batches: string[][] = [];

    for (let i = 0; i < input.workLogIds.length; i += FIREBASE_LIMITS.BATCH_MAX_OPERATIONS) {
      batches.push(input.workLogIds.slice(i, i + FIREBASE_LIMITS.BATCH_MAX_OPERATIONS));
    }

    for (const batchIds of batches) {
      await runTransaction(getFirebaseDb(), async (transaction) => {
        // 1. 모든 근무 기록 조회
        const workLogDocs = await Promise.all(
          batchIds.map(async (id) => {
            const ref = doc(getFirebaseDb(), WORK_LOGS_COLLECTION, id);
            const docSnap = await transaction.get(ref);
            return { id, ref, doc: docSnap };
          })
        );

        // 2. 공고별로 그룹화하여 소유권 확인 (IdNormalizer로 ID 정규화)
        const jobPostingIds = new Set<string>();
        const parsedWorkLogMap = new Map<string, WorkLog>();
        workLogDocs.forEach((wl) => {
          if (wl.doc.exists()) {
            const parsed = parseWorkLogDocument({ id: wl.doc.id, ...wl.doc.data() });
            if (parsed) {
              parsedWorkLogMap.set(wl.id, parsed);
              jobPostingIds.add(IdNormalizer.normalizeJobId(parsed));
            }
          }
        });

        const jobPostings = new Map<string, JobPosting>();
        for (const jobId of jobPostingIds) {
          const jobRef = doc(getFirebaseDb(), JOB_POSTINGS_COLLECTION, jobId);
          const jobDoc = await transaction.get(jobRef);
          if (jobDoc.exists()) {
            const parsedJob = parseJobPostingDocument({ id: jobDoc.id, ...jobDoc.data() });
            if (parsedJob) {
              jobPostings.set(jobId, parsedJob);
            }
          }
        }

        // 3. 각 근무 기록 처리
        for (const { id, ref, doc: workLogDoc } of workLogDocs) {
          if (!workLogDoc.exists() || !parsedWorkLogMap.has(id)) {
            results.push({
              success: false,
              workLogId: id,
              amount: 0,
              message: '근무 기록을 찾을 수 없습니다',
            });
            failedCount++;
            continue;
          }

          const parsedWorkLog = parsedWorkLogMap.get(id)!;
          const workLog = parsedWorkLog as WorkLog & { customRole?: string };
          const normalizedJobId = IdNormalizer.normalizeJobId(workLog);
          const jobPosting = jobPostings.get(normalizedJobId);

          // 소유권 확인
          if (!jobPosting || jobPosting.ownerId !== ownerId) {
            results.push({
              success: false,
              workLogId: id,
              amount: 0,
              message: '본인의 공고가 아닙니다',
            });
            failedCount++;
            continue;
          }

          // 상태 확인
          if (workLog.status !== 'checked_out' && workLog.status !== 'completed') {
            results.push({
              success: false,
              workLogId: id,
              amount: 0,
              message: '출퇴근이 완료되지 않았습니다',
            });
            failedCount++;
            continue;
          }

          // 이미 정산 완료
          if (workLog.payrollStatus === 'completed') {
            results.push({
              success: false,
              workLogId: id,
              amount: 0,
              message: '이미 정산 완료되었습니다',
            });
            failedCount++;
            continue;
          }

          // 정산 금액 계산 (Phase 6 - SettlementCalculator 사용)
          const workLogWithOverrides = workLog as WorkLogWithOverrides;
          const salaryInfo = getEffectiveSalaryInfoFromRoles(
            workLogWithOverrides,
            jobPosting.roles,
            jobPosting.defaultSalary
          );
          const allowances = getEffectiveAllowances(workLogWithOverrides, jobPosting.allowances);
          const taxSettings = getEffectiveTaxSettings(workLogWithOverrides, jobPosting.taxSettings);

          const settlementResult = SettlementCalculator.calculate({
            startTime: workLog.checkInTime,
            endTime: workLog.checkOutTime,
            salaryInfo,
            allowances,
            taxSettings,
          });
          const amount = settlementResult.afterTaxPay;

          // 정산 처리
          const updateData: Record<string, unknown> = {
            payrollStatus: 'completed',
            payrollAmount: amount,
            payrollDate: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };

          if (input.notes !== undefined) {
            updateData.payrollNotes = input.notes;
          }

          transaction.update(ref, updateData);

          results.push({
            success: true,
            workLogId: id,
            amount,
            message: '정산 완료',
          });
          successCount++;
          totalAmount += amount;
        }
      });
    }

    const result: BulkSettlementResult = {
      totalCount: input.workLogIds.length,
      successCount,
      failedCount,
      totalAmount,
      results,
    };

    logger.info('일괄 정산 처리 완료', {
      totalCount: result.totalCount,
      successCount: result.successCount,
      failedCount: result.failedCount,
      totalAmount: result.totalAmount,
    });

    return result;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '일괄 정산 처리',
      component: 'settlementService',
      context: { workLogCount: input.workLogIds.length, ownerId },
    });
  }
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
  try {
    logger.info('정산 상태 변경', { workLogId, status, ownerId });

    await runTransaction(getFirebaseDb(), async (transaction) => {
      // 1. 근무 기록 조회
      const workLogRef = doc(getFirebaseDb(), WORK_LOGS_COLLECTION, workLogId);
      const workLogDoc = await transaction.get(workLogRef);

      if (!workLogDoc.exists()) {
        throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
          userMessage: '근무 기록을 찾을 수 없습니다',
        });
      }

      const workLog = parseWorkLogDocument({ id: workLogDoc.id, ...workLogDoc.data() });
      if (!workLog) {
        throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
          userMessage: '근무 기록 데이터를 파싱할 수 없습니다',
        });
      }

      // 2. 공고 조회 및 소유권 확인 (IdNormalizer로 ID 정규화)
      const normalizedJobId = IdNormalizer.normalizeJobId(workLog);
      const jobRef = doc(getFirebaseDb(), JOB_POSTINGS_COLLECTION, normalizedJobId);
      const jobDoc = await transaction.get(jobRef);

      if (!jobDoc.exists()) {
        throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
          userMessage: '공고를 찾을 수 없습니다',
        });
      }

      const jobPosting = parseJobPostingDocument({ id: jobDoc.id, ...jobDoc.data() });
      if (!jobPosting) {
        throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
          userMessage: '공고 데이터를 파싱할 수 없습니다',
        });
      }

      if (jobPosting.ownerId !== ownerId) {
        throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
          userMessage: '본인의 공고에 대한 정산만 처리할 수 있습니다',
        });
      }

      // 3. 상태 업데이트
      const updateData: Record<string, unknown> = {
        payrollStatus: status,
        updatedAt: serverTimestamp(),
      };

      if (status === 'completed') {
        updateData.payrollDate = serverTimestamp();
      }

      transaction.update(workLogRef, updateData);
    });

    logger.info('정산 상태 변경 완료', { workLogId, status });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '정산 상태 변경',
      component: 'settlementService',
      context: { workLogId, status, ownerId },
    });
  }
}

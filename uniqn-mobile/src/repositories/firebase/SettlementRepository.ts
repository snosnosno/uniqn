/**
 * UNIQN Mobile - Firebase Settlement Repository
 *
 * @description Firebase Firestore 기반 Settlement Repository 구현
 * @version 1.0.0
 *
 * 책임:
 * 1. Firebase 트랜잭션 실행
 * 2. 소유권 검증 로직 통합 (중복 제거)
 * 3. 정산 계산 및 상태 업데이트
 *
 * 개선사항:
 * - validateWorkLogOwnership 중복 코드 제거 (단일 헬퍼로 통합)
 * - 트랜잭션 로직 캡슐화
 */

import {
  doc,
  runTransaction,
  serverTimestamp,
  Timestamp,
  type Transaction,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { BusinessError, PermissionError, ERROR_CODES, AlreadySettledError, isAppError } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { COLLECTIONS, FIREBASE_LIMITS, STATUS } from '@/constants';
import { SettlementCalculator } from '@/domains/settlement';
import {
  getEffectiveSalaryInfoFromRoles,
  getEffectiveAllowances,
  getEffectiveTaxSettings,
} from '@/utils/settlement';
import { parseWorkLogDocument, parseJobPostingDocument } from '@/schemas';
import { IdNormalizer } from '@/shared/id';
import type { WorkLog, JobPosting, PayrollStatus } from '@/types';
import type {
  ISettlementRepository,
  UpdateWorkTimeContext,
  SettleWorkLogContext,
  BulkSettlementContext,
  SettlementResultDTO,
  BulkSettlementResultDTO,
} from '../interfaces';

// ============================================================================
// Internal Types
// ============================================================================

/**
 * 소유권 검증 결과
 */
interface WorkLogOwnershipResult {
  workLog: WorkLog;
  jobPosting: JobPosting;
  workLogRef: ReturnType<typeof doc>;
}

/**
 * 오버라이드 필드를 포함한 WorkLog 타입 (내부용)
 */
type WorkLogWithOverrides = WorkLog & {
  customRole?: string;
  customSalaryInfo?: unknown;
  customAllowances?: unknown;
  customTaxSettings?: unknown;
};

// ============================================================================
// Repository Implementation
// ============================================================================

/**
 * Firebase Settlement Repository
 */
export class FirebaseSettlementRepository implements ISettlementRepository {
  // ==========================================================================
  // Work Time Update
  // ==========================================================================

  async updateWorkTimeWithTransaction(
    context: UpdateWorkTimeContext,
    ownerId: string
  ): Promise<void> {
    try {
      logger.info('근무 시간 수정 시작', { workLogId: context.workLogId, ownerId });

      await runTransaction(getFirebaseDb(), async (transaction) => {
        // 1-2. 근무 기록 및 공고 조회 + 소유권 확인
        const { workLog, workLogRef } = await this.validateWorkLogOwnership(
          transaction,
          context.workLogId,
          ownerId,
          '수정'
        );

        // 3. 이미 정산 완료된 경우 수정 불가
        if (workLog.payrollStatus === STATUS.PAYROLL.COMPLETED) {
          throw new AlreadySettledError();
        }

        // 4. 수정 데이터 준비
        const updateData: Record<string, unknown> = {
          updatedAt: serverTimestamp(),
          // 시간 수정 시 기존 정산 계산 무효화 (재계산 필요)
          settlementBreakdown: null,
        };

        // checkInTime 설정 (undefined면 건드리지 않음, null이면 미정으로 저장)
        if (context.checkInTime !== undefined) {
          updateData.checkInTime = context.checkInTime
            ? Timestamp.fromDate(context.checkInTime)
            : null;
        }

        // checkOutTime 설정
        if (context.checkOutTime !== undefined) {
          updateData.checkOutTime = context.checkOutTime
            ? Timestamp.fromDate(context.checkOutTime)
            : null;
        }

        if (context.notes !== undefined) {
          updateData.notes = context.notes;
        }

        // 수정 이력 기록
        const prevCheckIn = workLog.checkInTime ?? null;
        const prevCheckOut = workLog.checkOutTime ?? null;

        const modificationLog = {
          modifiedAt: new Date().toISOString(),
          modifiedBy: ownerId,
          reason: context.reason || '시간 수정',
          previousStartTime: prevCheckIn ?? null,
          previousEndTime: prevCheckOut ?? null,
          newStartTime:
            context.checkInTime !== undefined
              ? context.checkInTime
                ? Timestamp.fromDate(context.checkInTime)
                : null
              : undefined,
          newEndTime:
            context.checkOutTime !== undefined
              ? context.checkOutTime
                ? Timestamp.fromDate(context.checkOutTime)
                : null
              : undefined,
        };

        updateData.modificationHistory = [...(workLog.modificationHistory || []), modificationLog];

        transaction.update(workLogRef, updateData);
      });

      logger.info('근무 시간 수정 완료', { workLogId: context.workLogId });
    } catch (error) {
      // 비즈니스 에러는 그대로 throw
      if (isAppError(error)) {
        throw error;
      }

      throw handleServiceError(error, {
        operation: '근무 시간 수정',
        component: 'SettlementRepository',
        context: { workLogId: context.workLogId, ownerId },
      });
    }
  }

  // ==========================================================================
  // Settlement
  // ==========================================================================

  async settleWorkLogWithTransaction(
    context: SettleWorkLogContext,
    ownerId: string
  ): Promise<SettlementResultDTO> {
    try {
      logger.info('개별 정산 처리 시작', { workLogId: context.workLogId, ownerId });

      await runTransaction(getFirebaseDb(), async (transaction) => {
        // 1-2. 근무 기록 및 공고 조회 + 소유권 확인
        const { workLog, workLogRef } = await this.validateWorkLogOwnership(
          transaction,
          context.workLogId,
          ownerId,
          '정산'
        );

        // 3. 출퇴근 완료 여부 확인
        if (workLog.status !== STATUS.WORK_LOG.CHECKED_OUT && workLog.status !== STATUS.WORK_LOG.COMPLETED) {
          throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
            userMessage: '출퇴근이 완료된 근무 기록만 정산할 수 있습니다',
          });
        }

        // 4. 중복 정산 방지
        if (workLog.payrollStatus === STATUS.PAYROLL.COMPLETED) {
          throw new AlreadySettledError();
        }

        // 5. 정산 처리
        const updateData: Record<string, unknown> = {
          payrollStatus: STATUS.PAYROLL.COMPLETED,
          payrollAmount: context.amount,
          payrollDate: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        if (context.notes !== undefined) {
          updateData.payrollNotes = context.notes;
        }

        transaction.update(workLogRef, updateData);
      });

      logger.info('개별 정산 처리 완료', {
        workLogId: context.workLogId,
        amount: context.amount,
      });

      return {
        success: true,
        workLogId: context.workLogId,
        amount: context.amount,
        message: '정산이 완료되었습니다',
      };
    } catch (error) {
      // 개별 정산은 성공/실패 결과를 반환하므로 throw 대신 로깅 후 반환
      logger.error(
        '개별 정산 처리 실패',
        error instanceof Error ? error : undefined,
        { workLogId: context.workLogId }
      );

      const message =
        isAppError(error)
          ? error.userMessage
          : error instanceof Error
            ? error.message
            : '정산 처리에 실패했습니다';

      return {
        success: false,
        workLogId: context.workLogId,
        amount: 0,
        message,
      };
    }
  }

  async bulkSettlementWithTransaction(
    context: BulkSettlementContext,
    ownerId: string
  ): Promise<BulkSettlementResultDTO> {
    try {
      logger.info('일괄 정산 처리 시작', { count: context.workLogIds.length, ownerId });

      const results: SettlementResultDTO[] = [];
      let successCount = 0;
      let failedCount = 0;
      let totalAmount = 0;

      // Firestore 배치 제한
      const batches: string[][] = [];

      for (let i = 0; i < context.workLogIds.length; i += FIREBASE_LIMITS.BATCH_MAX_OPERATIONS) {
        batches.push(context.workLogIds.slice(i, i + FIREBASE_LIMITS.BATCH_MAX_OPERATIONS));
      }

      for (const batchIds of batches) {
        await runTransaction(getFirebaseDb(), async (transaction) => {
          // 1. 모든 근무 기록 조회
          const workLogDocs = await Promise.all(
            batchIds.map(async (id) => {
              const ref = doc(getFirebaseDb(), COLLECTIONS.WORK_LOGS, id);
              const docSnap = await transaction.get(ref);
              return { id, ref, doc: docSnap };
            })
          );

          // 2. 공고별로 그룹화하여 소유권 확인
          const jobPostingIds = new Set<string>();
          const parsedWorkLogMap = new Map<string, WorkLog>();
          workLogDocs.forEach((wl) => {
            if (wl.doc.exists()) {
              const parsed = parseWorkLogDocument({
                id: wl.doc.id,
                ...(wl.doc.data() as Record<string, unknown>),
              });
              if (parsed) {
                parsedWorkLogMap.set(wl.id, parsed);
                jobPostingIds.add(IdNormalizer.normalizeJobId(parsed));
              }
            }
          });

          const jobPostings = new Map<string, JobPosting>();
          for (const jobId of jobPostingIds) {
            const jobRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, jobId);
            const jobDoc = await transaction.get(jobRef);
            if (jobDoc.exists()) {
              const parsedJob = parseJobPostingDocument({
                id: jobDoc.id,
                ...(jobDoc.data() as Record<string, unknown>),
              });
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
            const workLog = parsedWorkLog as WorkLogWithOverrides;
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
            if (workLog.status !== STATUS.WORK_LOG.CHECKED_OUT && workLog.status !== STATUS.WORK_LOG.COMPLETED) {
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
            if (workLog.payrollStatus === STATUS.PAYROLL.COMPLETED) {
              results.push({
                success: false,
                workLogId: id,
                amount: 0,
                message: '이미 정산 완료되었습니다',
              });
              failedCount++;
              continue;
            }

            // 정산 금액 계산 (SettlementCalculator 사용)
            const salaryInfo = getEffectiveSalaryInfoFromRoles(
              workLog,
              jobPosting.roles,
              jobPosting.defaultSalary
            );
            const allowances = getEffectiveAllowances(workLog, jobPosting.allowances);
            const taxSettings = getEffectiveTaxSettings(workLog, jobPosting.taxSettings);

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
              payrollStatus: STATUS.PAYROLL.COMPLETED,
              payrollAmount: amount,
              payrollDate: serverTimestamp(),
              updatedAt: serverTimestamp(),
            };

            if (context.notes !== undefined) {
              updateData.payrollNotes = context.notes;
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

      const result: BulkSettlementResultDTO = {
        totalCount: context.workLogIds.length,
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
        component: 'SettlementRepository',
        context: { workLogCount: context.workLogIds.length, ownerId },
      });
    }
  }

  // ==========================================================================
  // Status Update
  // ==========================================================================

  async updatePayrollStatusWithTransaction(
    workLogId: string,
    status: PayrollStatus,
    ownerId: string
  ): Promise<void> {
    try {
      logger.info('정산 상태 변경', { workLogId, status, ownerId });

      await runTransaction(getFirebaseDb(), async (transaction) => {
        // 소유권 검증 (통합 헬퍼 사용)
        const { workLogRef } = await this.validateWorkLogOwnership(
          transaction,
          workLogId,
          ownerId,
          '정산 상태 변경'
        );

        // 상태 업데이트
        const updateData: Record<string, unknown> = {
          payrollStatus: status,
          updatedAt: serverTimestamp(),
        };

        if (status === STATUS.PAYROLL.COMPLETED) {
          updateData.payrollDate = serverTimestamp();
        }

        transaction.update(workLogRef, updateData);
      });

      logger.info('정산 상태 변경 완료', { workLogId, status });
    } catch (error) {
      // 비즈니스 에러는 그대로 throw
      if (isAppError(error)) {
        throw error;
      }

      throw handleServiceError(error, {
        operation: '정산 상태 변경',
        component: 'SettlementRepository',
        context: { workLogId, status, ownerId },
      });
    }
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * 근무 기록 소유권 검증 (트랜잭션 내부용)
   *
   * @description 중복 코드 제거 - 단일 헬퍼로 통합
   * - WorkLog 조회 및 파싱
   * - JobPosting 조회 및 소유권 확인
   *
   * @throws BusinessError 문서를 찾을 수 없는 경우
   * @throws PermissionError 소유권이 없는 경우
   */
  private async validateWorkLogOwnership(
    transaction: Transaction,
    workLogId: string,
    ownerId: string,
    operationMessage: string = '처리'
  ): Promise<WorkLogOwnershipResult> {
    // 1. 근무 기록 조회
    const workLogRef = doc(getFirebaseDb(), COLLECTIONS.WORK_LOGS, workLogId);
    const workLogDoc = await transaction.get(workLogRef);

    if (!workLogDoc.exists()) {
      throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
        userMessage: '근무 기록을 찾을 수 없습니다',
      });
    }

    const workLog = parseWorkLogDocument({
      id: workLogDoc.id,
      ...(workLogDoc.data() as Record<string, unknown>),
    });
    if (!workLog) {
      throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
        userMessage: '근무 기록 데이터를 파싱할 수 없습니다',
      });
    }

    // 2. 공고 조회 및 소유권 확인 (IdNormalizer로 ID 정규화)
    const normalizedJobId = IdNormalizer.normalizeJobId(workLog);
    const jobRef = doc(getFirebaseDb(), COLLECTIONS.JOB_POSTINGS, normalizedJobId);
    const jobDoc = await transaction.get(jobRef);

    if (!jobDoc.exists()) {
      throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
        userMessage: '공고를 찾을 수 없습니다',
      });
    }

    const jobPosting = parseJobPostingDocument({
      id: jobDoc.id,
      ...(jobDoc.data() as Record<string, unknown>),
    });
    if (!jobPosting) {
      throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
        userMessage: '공고 데이터를 파싱할 수 없습니다',
      });
    }

    if (jobPosting.ownerId !== ownerId) {
      throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
        userMessage: `본인의 공고에 대한 근무 기록만 ${operationMessage}할 수 있습니다`,
      });
    }

    return { workLog, jobPosting, workLogRef };
  }
}

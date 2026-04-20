/**
 * UNIQN Mobile - Supabase Settlement Repository
 *
 * @description Supabase PostgREST 기반 Settlement Repository 구현
 * @version 1.0.0
 *
 * 책임:
 * 1. 근무 시간 수정 (소유권 검증 + 정산 완료 차단)
 * 2. 개별/일괄 정산 처리 (SettlementCalculator 사용)
 * 3. 정산 상태 변경
 * 4. 개인 정산 설정 수정
 *
 * Note: settlement 데이터는 work_logs 테이블의 payroll 필드에 저장
 */

import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import {
  BusinessError,
  PermissionError,
  AlreadySettledError,
  ERROR_CODES,
  isAppError,
  toError,
} from '@/errors';
import { handleSupabaseError, toCamelCase } from '@/utils/supabase';
import { parseWorkLogDocument, parseJobPostingDocument } from '@/schemas';
import { getPostingSettlementContext } from '@/domains/job-posting';
import { SettlementCalculator } from '@/domains/settlement';
import {
  getEffectiveSalaryInfoFromRoles,
  getEffectiveAllowances,
  getEffectiveTaxSettings,
} from '@/utils/settlement';
import { IdNormalizer } from '@/shared/id';
import { STATUS } from '@/constants';
import type { TaxSettings } from '@/utils/settlement';
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
// Constants
// ============================================================================

const WORK_LOGS_TABLE = 'work_logs';
const JOB_POSTINGS_TABLE = 'job_postings';

/** Supabase에는 Firestore의 500 배치 제한이 없지만 합리적 청크 크기 유지 */
const BATCH_CHUNK_SIZE = 100;
const WORK_LOG_COLUMNS =
  'id,application_id,assignment_group_id,check_in_time,check_out_time,created_at,custom_allowances,custom_role,custom_salary_info,custom_tax_settings,date,has_time_modification_logs,is_fixed_posting,job_posting_id,modification_history,no_show_at,no_show_reason,notes,owner_id,payroll_amount,payroll_date,payroll_notes,payroll_status,role,role_change_history,settlement_modification_history,staff_id,staff_name,staff_nickname,staff_photo_url,staff_photo_url_blurhash,status,time_slot,updated_at' as const;
const JOB_POSTING_COLUMNS =
  'id,closed_at,closed_reason,compensation,contact_phone,created_at,description,filled_positions,fixed_config,is_featured,last_work_date,location,og_image_url,owner_id,owner_name,posting_type,questions,rejection_reason,role_catalog,role_keys,schedule,schema_version,stats,status,tags,title,total_positions,tournament_config,updated_at,urgent_config,view_count,work_date,work_dates' as const;

// ============================================================================
// Internal Types
// ============================================================================

type WorkLogWithOverrides = WorkLog & {
  customRole?: string;
  customSalaryInfo?: unknown;
  customAllowances?: unknown;
  customTaxSettings?: unknown;
};

interface WorkLogOwnershipResult {
  workLog: WorkLog;
  jobPosting: JobPosting;
}

// ============================================================================
// Helpers
// ============================================================================

function toWorkLog(row: Record<string, unknown>): WorkLog | null {
  const camel = toCamelCase<Record<string, unknown>>(row);
  return parseWorkLogDocument({ ...camel, id: row.id });
}

function toJobPosting(row: Record<string, unknown>): JobPosting | null {
  const camel = toCamelCase<Record<string, unknown>>(row);
  return parseJobPostingDocument({ ...camel, id: row.id });
}

/** 공통 catch 핸들러 */
function rethrowOrHandle(
  error: unknown,
  operation: string,
  context?: Record<string, unknown>
): never {
  if (isAppError(error)) throw error;
  logger.error(`${operation} 실패`, toError(error), context);
  handleSupabaseError(error, { operation, table: WORK_LOGS_TABLE });
}

// ============================================================================
// Repository Implementation
// ============================================================================

export class SupabaseSettlementRepository implements ISettlementRepository {
  // ==========================================================================
  // Work Time Update
  // ==========================================================================

  async updateWorkTimeWithTransaction(
    context: UpdateWorkTimeContext,
    ownerId: string
  ): Promise<void> {
    try {
      logger.info('근무 시간 수정 시작', { workLogId: context.workLogId, ownerId });

      // 1. 소유권 검증
      const { workLog } = await this.validateWorkLogOwnership(context.workLogId, ownerId, '수정');

      // 2. 정산 완료된 경우 수정 불가
      if (workLog.payrollStatus === STATUS.PAYROLL.COMPLETED) {
        throw new AlreadySettledError();
      }

      // 3. 업데이트 데이터 구성
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        settlement_breakdown: null, // 시간 수정 시 기존 정산 계산 무효화
        has_time_modification_logs: true,
      };

      if (context.checkInTime !== undefined) {
        updateData.check_in_ts = context.checkInTime ? context.checkInTime.toISOString() : null;
      }

      if (context.checkOutTime !== undefined) {
        updateData.check_out_ts = context.checkOutTime ? context.checkOutTime.toISOString() : null;
      }

      if (context.notes !== undefined) {
        updateData.notes = context.notes;
      }

      const { error } = await supabase
        .from(WORK_LOGS_TABLE)
        .update(updateData)
        .eq('id', context.workLogId);

      if (error)
        handleSupabaseError(error, { operation: '근무 시간 수정', table: WORK_LOGS_TABLE });

      logger.info('근무 시간 수정 완료', { workLogId: context.workLogId });
    } catch (error) {
      rethrowOrHandle(error, '근무 시간 수정', { workLogId: context.workLogId, ownerId });
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

      // 1. 소유권 검증
      const { workLog, jobPosting } = await this.validateWorkLogOwnership(
        context.workLogId,
        ownerId,
        '정산'
      );

      // 2. 출퇴근 완료 여부 확인
      if (
        workLog.status !== STATUS.WORK_LOG.CHECKED_OUT &&
        workLog.status !== STATUS.WORK_LOG.COMPLETED
      ) {
        throw new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
          userMessage: '출퇴근이 완료된 근무 기록만 정산할 수 있습니다',
        });
      }

      // 3. 중복 정산 방지
      if (workLog.payrollStatus === STATUS.PAYROLL.COMPLETED) {
        throw new AlreadySettledError();
      }

      // 4. 정산 금액 계산 (canonical)
      const canonicalAmount = this.calculateSettlementAmount(
        workLog as WorkLogWithOverrides,
        jobPosting
      );

      if (context.amount !== canonicalAmount) {
        logger.warn('Individual settlement amount mismatch detected, using canonical amount', {
          component: 'SettlementRepository',
          workLogId: context.workLogId,
          requestedAmount: context.amount,
          canonicalAmount,
        });
      }

      // 5. 정산 처리
      const now = new Date().toISOString();
      const updateData: Record<string, unknown> = {
        payroll_status: STATUS.PAYROLL.COMPLETED,
        payroll_amount: canonicalAmount,
        payroll_date: now,
        updated_at: now,
      };

      if (context.notes !== undefined) {
        updateData.payroll_notes = context.notes;
      }

      // ES-003: 정산 완료 시점에 allowance snapshot 저장 (customAllowances 비어있을 때만)
      // 공고 수정으로 과거 정산이 retro-active 변경되는 것을 방지
      const workLogWithOverrides = workLog as WorkLogWithOverrides;
      const postingAllowances = jobPosting.compensation?.allowances;
      if (!workLogWithOverrides.customAllowances && postingAllowances) {
        updateData.custom_allowances = postingAllowances;
      }

      const { error } = await supabase
        .from(WORK_LOGS_TABLE)
        .update(updateData)
        .eq('id', context.workLogId);

      if (error)
        handleSupabaseError(error, { operation: '개별 정산 처리', table: WORK_LOGS_TABLE });

      logger.info('개별 정산 처리 완료', {
        workLogId: context.workLogId,
        amount: canonicalAmount,
      });

      return {
        success: true,
        workLogId: context.workLogId,
        amount: canonicalAmount,
        message: '정산이 완료되었습니다',
      };
    } catch (error) {
      logger.error('개별 정산 처리 실패', error instanceof Error ? error : undefined, {
        workLogId: context.workLogId,
      });

      const message = isAppError(error)
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

      // 청크 단위로 처리
      for (let i = 0; i < context.workLogIds.length; i += BATCH_CHUNK_SIZE) {
        const chunkIds = context.workLogIds.slice(i, i + BATCH_CHUNK_SIZE);

        // 1. WorkLog 일괄 조회
        const { data: workLogRows, error: wlError } = await supabase
          .from(WORK_LOGS_TABLE)
          .select(WORK_LOG_COLUMNS)
          .in('id', chunkIds);

        if (wlError) {
          for (const id of chunkIds) {
            results.push({
              success: false,
              workLogId: id,
              amount: 0,
              message: '근무 기록 조회 실패',
            });
            failedCount++;
          }
          continue;
        }

        // 2. WorkLog 파싱 + 공고 ID 수집
        const workLogMap = new Map<string, WorkLog>();
        const jobPostingIds = new Set<string>();

        for (const row of (workLogRows ?? []) as Record<string, unknown>[]) {
          const workLog = toWorkLog(row);
          if (workLog) {
            workLogMap.set(workLog.id, workLog);
            jobPostingIds.add(IdNormalizer.normalizeJobId(workLog));
          }
        }

        // 3. 공고 일괄 조회
        const jobPostingMap = new Map<string, JobPosting>();
        if (jobPostingIds.size > 0) {
          const { data: jpRows, error: jpError } = await supabase
            .from(JOB_POSTINGS_TABLE)
            .select(JOB_POSTING_COLUMNS)
            .in('id', [...jobPostingIds]);

          if (!jpError && jpRows) {
            for (const row of jpRows as Record<string, unknown>[]) {
              const jp = toJobPosting(row);
              if (jp) {
                jobPostingMap.set(jp.id, jp);
              }
            }
          }
        }

        // 4. 각 WorkLog 처리
        for (const id of chunkIds) {
          const workLog = workLogMap.get(id);

          if (!workLog) {
            results.push({
              success: false,
              workLogId: id,
              amount: 0,
              message: '근무 기록을 찾을 수 없습니다',
            });
            failedCount++;
            continue;
          }

          const normalizedJobId = IdNormalizer.normalizeJobId(workLog);
          const jobPosting = jobPostingMap.get(normalizedJobId);

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
          if (
            workLog.status !== STATUS.WORK_LOG.CHECKED_OUT &&
            workLog.status !== STATUS.WORK_LOG.COMPLETED
          ) {
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

          // 정산 금액 계산
          const amount = this.calculateSettlementAmount(
            workLog as WorkLogWithOverrides,
            jobPosting
          );

          // 정산 처리
          const now = new Date().toISOString();
          const updateData: Record<string, unknown> = {
            payroll_status: STATUS.PAYROLL.COMPLETED,
            payroll_amount: amount,
            payroll_date: now,
            updated_at: now,
          };

          if (context.notes !== undefined) {
            updateData.payroll_notes = context.notes;
          }

          // ES-003: allowance snapshot (customAllowances 비어있을 때만 공고값 복사)
          const workLogWithOverridesBulk = workLog as WorkLogWithOverrides;
          const postingAllowancesBulk = jobPosting.compensation?.allowances;
          if (!workLogWithOverridesBulk.customAllowances && postingAllowancesBulk) {
            updateData.custom_allowances = postingAllowancesBulk;
          }

          const { error: updateError } = await supabase
            .from(WORK_LOGS_TABLE)
            .update(updateData)
            .eq('id', id);

          if (updateError) {
            results.push({
              success: false,
              workLogId: id,
              amount: 0,
              message: '정산 업데이트 실패',
            });
            failedCount++;
            continue;
          }

          results.push({
            success: true,
            workLogId: id,
            amount,
            message: '정산 완료',
          });
          successCount++;
          totalAmount += amount;
        }
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
      rethrowOrHandle(error, '일괄 정산 처리', {
        workLogCount: context.workLogIds.length,
        ownerId,
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

      // 소유권 검증
      await this.validateWorkLogOwnership(workLogId, ownerId, '정산 상태 변경');

      // 상태 업데이트
      const now = new Date().toISOString();
      const updateData: Record<string, unknown> = {
        payroll_status: status,
        updated_at: now,
      };

      if (status === STATUS.PAYROLL.COMPLETED) {
        updateData.payroll_date = now;
      }

      const { error } = await supabase.from(WORK_LOGS_TABLE).update(updateData).eq('id', workLogId);

      if (error)
        handleSupabaseError(error, { operation: '정산 상태 변경', table: WORK_LOGS_TABLE });

      logger.info('정산 상태 변경 완료', { workLogId, status });
    } catch (error) {
      rethrowOrHandle(error, '정산 상태 변경', { workLogId, status, ownerId });
    }
  }

  // ==========================================================================
  // Custom Settlement Settings
  // ==========================================================================

  async updateWorkLogCustomSettlement(
    workLogId: string,
    data: {
      customSalaryInfo: { type: string; amount: number };
      customAllowances?: Record<string, unknown>;
      customTaxSettings: TaxSettings;
      modificationEntry: Record<string, unknown>;
    },
    ownerId: string
  ): Promise<void> {
    try {
      logger.info('개인 정산 설정 저장 시작', { workLogId, ownerId });

      // 소유권 검증
      const { workLog } = await this.validateWorkLogOwnership(workLogId, ownerId, '정산 설정 수정');

      // 기존 수정 이력에 새 항목 추가 (Supabase에는 arrayUnion이 없으므로 수동 추가)
      const existingHistory =
        (workLog as unknown as Record<string, unknown>).settlementModificationHistory ?? [];
      const updatedHistory = Array.isArray(existingHistory)
        ? [...existingHistory, data.modificationEntry]
        : [data.modificationEntry];

      const { error } = await supabase
        .from(WORK_LOGS_TABLE)
        .update({
          custom_salary_info: data.customSalaryInfo,
          custom_allowances: data.customAllowances,
          custom_tax_settings: data.customTaxSettings,
          settlement_modification_history: updatedHistory,
          updated_at: new Date().toISOString(),
        })
        .eq('id', workLogId);

      if (error)
        handleSupabaseError(error, { operation: '개인 정산 설정 저장', table: WORK_LOGS_TABLE });

      logger.info('개인 정산 설정 저장 완료', { workLogId });
    } catch (error) {
      rethrowOrHandle(error, '개인 정산 설정 저장', { workLogId, ownerId });
    }
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * 근무 기록 소유권 검증
   *
   * @description WorkLog 조회 → JobPosting 조회 → 소유권 확인
   * @throws BusinessError 문서를 찾을 수 없는 경우
   * @throws PermissionError 소유권이 없는 경우
   */
  private async validateWorkLogOwnership(
    workLogId: string,
    ownerId: string,
    operationMessage: string = '처리'
  ): Promise<WorkLogOwnershipResult> {
    // 1. 근무 기록 조회
    const { data: wlData, error: wlError } = await supabase
      .from(WORK_LOGS_TABLE)
      .select(WORK_LOG_COLUMNS)
      .eq('id', workLogId)
      .maybeSingle();

    if (wlError)
      handleSupabaseError(wlError, {
        operation: `${operationMessage} - WorkLog 조회`,
        table: WORK_LOGS_TABLE,
      });

    if (!wlData) {
      throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
        userMessage: '근무 기록을 찾을 수 없습니다',
      });
    }

    const workLog = toWorkLog(wlData as Record<string, unknown>);
    if (!workLog) {
      throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
        userMessage: '근무 기록 데이터를 파싱할 수 없습니다',
      });
    }

    // 2. 공고 조회 및 소유권 확인
    const normalizedJobId = IdNormalizer.normalizeJobId(workLog);
    const { data: jpData, error: jpError } = await supabase
      .from(JOB_POSTINGS_TABLE)
      .select(JOB_POSTING_COLUMNS)
      .eq('id', normalizedJobId)
      .maybeSingle();

    if (jpError)
      handleSupabaseError(jpError, {
        operation: `${operationMessage} - 공고 조회`,
        table: JOB_POSTINGS_TABLE,
      });

    if (!jpData) {
      throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
        userMessage: '공고를 찾을 수 없습니다',
      });
    }

    const jobPosting = toJobPosting(jpData as Record<string, unknown>);
    if (!jobPosting) {
      throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
        userMessage: '공고 데이터를 파싱할 수 없습니다',
      });
    }

    if (jobPosting.ownerId !== ownerId) {
      throw new PermissionError(ERROR_CODES.INFRA_PERMISSION_DENIED, {
        userMessage: `본인의 공고에 대한 근무 기록만 ${operationMessage}할 수 있습니다`,
      });
    }

    return { workLog, jobPosting };
  }

  /**
   * 정산 금액 계산
   */
  private calculateSettlementAmount(workLog: WorkLogWithOverrides, jobPosting: JobPosting): number {
    const postingSettlement = getPostingSettlementContext(jobPosting);
    const salaryInfo = getEffectiveSalaryInfoFromRoles(
      workLog,
      postingSettlement.roles,
      postingSettlement.defaultSalary
    );
    const allowances = getEffectiveAllowances(workLog, postingSettlement.allowances);
    const taxSettings = getEffectiveTaxSettings(workLog, postingSettlement.taxSettings);

    const settlementResult = SettlementCalculator.calculate({
      startTime: workLog.checkInTime,
      endTime: workLog.checkOutTime,
      salaryInfo,
      allowances,
      taxSettings,
    });

    return settlementResult.afterTaxPay;
  }
}

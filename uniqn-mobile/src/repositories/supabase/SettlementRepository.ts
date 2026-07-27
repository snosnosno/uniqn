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

import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import {
  BusinessError,
  PermissionError,
  ValidationError,
  AlreadySettledError,
  ERROR_CODES,
  isAppError,
  toError,
} from '@/errors';
import { handleSupabaseError, toCamelCase } from '@/utils/supabase';
import { parseWorkLogDocument, parseJobPostingDocument } from '@/schemas';
import { getPostingSettlementContext } from '@/domains/job-posting';
import { SettlementCalculator } from '@/domains/settlement';
import { assertWorkTimeReason, appendWorkTimeModification } from '@/domains/staff';
import {
  getEffectiveSalaryInfoFromRoles,
  getEffectiveAllowances,
  getEffectiveTaxSettings,
} from '@/utils/settlement';
import { IdNormalizer } from '@/shared/id';
import { STATUS } from '@/constants';
import { resolvePostingAuthority, canManagePosting } from './postingAuthority';
// 공고 SELECT 화이트리스트 단일소스 — 정본 TABLE_COLUMNS 를 재사용한다(자체 사본 드리프트 금지).
import { TABLE_COLUMNS as JOB_POSTING_COLUMNS } from './JobPostingRepositoryHelpers';
// work_logs SELECT 화이트리스트·ts 매핑 정본(자체 사본 드리프트 금지).
import { WORK_LOG_COLUMNS, applyTsPreference } from './workLogColumns';
import { resolveWorkTimeStatus } from './workLogTimeStatus';
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

/**
 * 정산 금액 수정 이력 경계 스키마 — 항목별 객체 배열(얇게).
 * work_logs jsonb 는 무검증 단언되어 있어, 이력 누적 전 형식만 확인한다.
 * 실패(비배열·비객체 항목) 시 [] 폴백 + logger.error 관측(throw 금지 — 현 폴백 동작 유지).
 */
const settlementModificationHistorySchema = z.array(z.record(z.string(), z.unknown()));

/**
 * 정산 금액 수정 이력을 안전하게 읽어 새 항목을 덧붙인다.
 *
 * 오염(비배열·비객체)이면 [] 폴백 + 관측만 하고 throw 하지 않는다 —
 * `updateWorkLogCustomSettlement` 의 기존 규약과 동일.
 */
function appendSettlementStatusRevert(
  rawHistory: unknown,
  entry: Record<string, unknown>,
  workLogId: string
): Record<string, unknown>[] {
  const parsed = settlementModificationHistorySchema.safeParse(rawHistory ?? []);
  if (!parsed.success) {
    logger.error('정산 수정 이력 형식 오류 — 빈 배열로 폴백', {
      workLogId,
      issues: parsed.error.issues,
    });
  }
  const existing = parsed.success ? parsed.data : [];
  return [...existing, { type: 'payroll_status_revert', ...entry }];
}

/** Supabase에는 Firestore의 500 배치 제한이 없지만 합리적 청크 크기 유지 */
const BATCH_CHUNK_SIZE = 100;

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
  return parseWorkLogDocument({ ...applyTsPreference(camel), id: row.id });
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
    actorId: string
  ): Promise<void> {
    try {
      logger.info('근무 시간 수정 시작', { workLogId: context.workLogId, actorId });

      // 1. 소유권 검증
      const { workLog } = await this.validateWorkLogOwnership(context.workLogId, actorId, '수정');

      // 2. 정산 완료된 경우 수정 불가
      if (workLog.payrollStatus === STATUS.PAYROLL.COMPLETED) {
        throw new AlreadySettledError();
      }

      // 3. 수정 사유 검증 + 이력 append (ConfirmedStaffRepository 와 동일 규약).
      // modification_history 길이 증가가 트리거 발화 → 스태프 "근무 시간 변경" 알림 + 이력 표시.
      const safeReason = assertWorkTimeReason(context.reason);
      const newModificationHistory = appendWorkTimeModification(workLog.modificationHistory, {
        previousStartTime: workLog.checkInTime,
        previousEndTime: workLog.checkOutTime,
        newStartTime: context.checkInTime,
        newEndTime: context.checkOutTime,
        reason: safeReason,
        modifiedBy: actorId,
        modifiedAt: new Date(),
      });

      // 4. 업데이트 데이터 구성
      // 정산 내역 무효화 컬럼은 없다 — settlementBreakdown 은 ScheduleConverter 가 읽기 시점에
      // 계산하는 파생값이라 시간만 바뀌면 자동으로 새 값이 나온다. 과거 이 payload 에 있던
      // `settlement_breakdown: null` 은 work_logs 에 없는 컬럼이라 PostgREST 가 요청 전체를
      // PGRST204 로 거부했다(= 근무 시간 수정 전량 실패). 회귀 가드는 workLogWriteColumns.test.ts.
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
        has_time_modification_logs: true,
        modification_history: newModificationHistory,
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

      // 5. status 승격 — 서버 정산 게이트(:settleWorkLogWithTransaction)가 status 로 판정하므로
      // 시각만 쓰고 status 를 두면 '시간을 고쳐도 영원히 정산 불가' 인 막다른 길이 된다(SET-1).
      // 형제 경로(ConfirmedStaffRepository)와 같은 헬퍼를 통과시켜 두 화면이 어긋나지 않게 한다.
      const resolvedStatus = resolveWorkTimeStatus({
        currentStatus: workLog.status,
        incomingCheckIn: context.checkInTime,
        incomingCheckOut: context.checkOutTime,
        existingCheckIn: workLog.checkInTime,
        existingCheckOut: workLog.checkOutTime,
      });
      if (resolvedStatus !== undefined) {
        updateData.status = resolvedStatus;
      }

      const { error } = await supabase
        .from(WORK_LOGS_TABLE)
        .update(updateData)
        .eq('id', context.workLogId);

      if (error)
        handleSupabaseError(error, { operation: '근무 시간 수정', table: WORK_LOGS_TABLE });

      logger.info('근무 시간 수정 완료', { workLogId: context.workLogId });
    } catch (error) {
      rethrowOrHandle(error, '근무 시간 수정', { workLogId: context.workLogId, actorId });
    }
  }

  // ==========================================================================
  // Settlement
  // ==========================================================================

  async settleWorkLogWithTransaction(
    context: SettleWorkLogContext,
    actorId: string
  ): Promise<SettlementResultDTO> {
    try {
      logger.info('개별 정산 처리 시작', { workLogId: context.workLogId, actorId });

      // 1. 소유권 검증
      const { workLog, jobPosting } = await this.validateWorkLogOwnership(
        context.workLogId,
        actorId,
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
    actorId: string
  ): Promise<BulkSettlementResultDTO> {
    try {
      logger.info('일괄 정산 처리 시작', { count: context.workLogIds.length, actorId });

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

          if (jpError) {
            // 조회 실패를 삼키면 이 청크 전 행이 "권한 없음"으로 오표기된다(fail-closed).
            // 보안상 안전하나 운영자에게 원인을 남긴다.
            logger.warn('일괄 정산 - 공고 일괄 조회 실패(해당 청크는 권한 판정 불가로 스킵)', {
              jobPostingIds: [...jobPostingIds],
              error: jpError,
            });
          } else if (jpRows) {
            for (const row of jpRows as Record<string, unknown>[]) {
              const jp = toJobPosting(row);
              if (jp) {
                jobPostingMap.set(jp.id, jp);
              }
            }
          }
        }

        // 3-1. 공고별 권한 판정 — 같은 공고의 근무기록 N건에 RPC 를 N번 부르지 않도록
        //      공고당 정확히 1회 판정한다(N+1 방지). admin 은 포함하지 않는다(wl_update RLS 동형).
        const manageableByJobId = new Map<string, boolean>();
        for (const jp of jobPostingMap.values()) {
          // owner 는 workspaceId 유무와 무관하게 자기 공고를 정산할 수 있다(레거시 row 포함).
          if (jp.ownerId === actorId) {
            manageableByJobId.set(jp.id, true);
            continue;
          }
          // 비-owner 는 워크스페이스 멤버십·협업자 판정이 필요하다. workspaceId 없으면 불가.
          if (!jp.workspaceId) {
            manageableByJobId.set(jp.id, false);
            continue;
          }
          const authority = await resolvePostingAuthority({
            jobPostingId: jp.id,
            workspaceId: jp.workspaceId,
            postingOwnerId: jp.ownerId,
            actorId,
            operation: '일괄 정산',
          });
          manageableByJobId.set(jp.id, canManagePosting(authority));
        }

        // 4. 각 WorkLog 처리 (청크 내 병렬 — 행 간 의존 없음, 각 UPDATE는 독립 auto-commit이라
        //    부분 실패 의미(이전 성공분 커밋 유지·롤백 없음)가 직렬과 동일하게 보존된다.
        //    순서·집계는 결과 배열에서 결정적으로 후처리해 카운터 경쟁을 제거한다.)
        const chunkResults = await Promise.all(
          chunkIds.map(async (id): Promise<SettlementResultDTO> => {
            const workLog = workLogMap.get(id);

            if (!workLog) {
              return {
                success: false,
                workLogId: id,
                amount: 0,
                message: '근무 기록을 찾을 수 없습니다',
              };
            }

            const normalizedJobId = IdNormalizer.normalizeJobId(workLog);
            const jobPosting = jobPostingMap.get(normalizedJobId);

            // 권한 확인 — owner/워크스페이스 멤버/협업자 (공고별로 사전 판정된 결과 조회)
            if (!jobPosting || !manageableByJobId.get(jobPosting.id)) {
              return {
                success: false,
                workLogId: id,
                amount: 0,
                message: '권한이 없는 공고입니다',
              };
            }

            // 상태 확인
            if (
              workLog.status !== STATUS.WORK_LOG.CHECKED_OUT &&
              workLog.status !== STATUS.WORK_LOG.COMPLETED
            ) {
              return {
                success: false,
                workLogId: id,
                amount: 0,
                message: '출퇴근이 완료되지 않았습니다',
              };
            }

            // 이미 정산 완료
            if (workLog.payrollStatus === STATUS.PAYROLL.COMPLETED) {
              return {
                success: false,
                workLogId: id,
                amount: 0,
                message: '이미 정산 완료되었습니다',
              };
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
              return {
                success: false,
                workLogId: id,
                amount: 0,
                message: '정산 업데이트 실패',
              };
            }

            return {
              success: true,
              workLogId: id,
              amount,
              message: '정산 완료',
            };
          })
        );

        // 집계 (Promise.all이 입력 순서를 보존하므로 results 순서는 직렬과 동일)
        for (const chunkResult of chunkResults) {
          results.push(chunkResult);
          if (chunkResult.success) {
            successCount++;
            totalAmount += chunkResult.amount;
          } else {
            failedCount++;
          }
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
        actorId,
      });
    }
  }

  // ==========================================================================
  // Status Update
  // ==========================================================================

  async updatePayrollStatusWithTransaction(
    workLogId: string,
    status: PayrollStatus,
    actorId: string,
    options?: { reason?: string }
  ): Promise<void> {
    try {
      logger.info('정산 상태 변경', { workLogId, status, actorId });

      // 소유권 검증
      const { workLog } = await this.validateWorkLogOwnership(workLogId, actorId, '정산 상태 변경');

      // 상태 업데이트
      const now = new Date().toISOString();
      const updateData: Record<string, unknown> = {
        payroll_status: status,
        updated_at: now,
      };

      if (status === STATUS.PAYROLL.COMPLETED) {
        updateData.payroll_date = now;
      }

      // 지급 완료 되돌리기 — 금전 상태를 역행시키는 조작이라 사유·감사 이력을 서버에서 강제한다.
      // DB 는 이 2단계 경로(completed→pending 후 수정)를 이미 허용해 두었다(20260712010000 헤더).
      const isRevertFromCompleted =
        workLog.payrollStatus === STATUS.PAYROLL.COMPLETED && status !== STATUS.PAYROLL.COMPLETED;

      if (isRevertFromCompleted) {
        const trimmedReason = options?.reason?.trim() ?? '';
        if (trimmedReason.length === 0) {
          throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
            userMessage: '지급 완료를 취소하려면 사유를 입력해주세요.',
          });
        }
        // XSS·길이 경계는 시간 수정 사유와 같은 규약을 재사용한다.
        const safeReason = assertWorkTimeReason(trimmedReason);

        // 지급일은 더 이상 유효하지 않다. 동결 표시액(payroll_amount)은 남긴다 —
        // shouldUseFrozenPayrollAmount 가 완료 상태에서만 쓰므로 표시에 새어나가지 않고,
        // '얼마를 지급 완료로 찍었었는지' 기록은 이의 처리에 필요하다.
        updateData.payroll_date = null;
        updateData.settlement_modification_history = appendSettlementStatusRevert(
          (workLog as unknown as Record<string, unknown>).settlementModificationHistory,
          {
            previousStatus: STATUS.PAYROLL.COMPLETED,
            newStatus: status,
            reason: safeReason,
            modifiedBy: actorId,
            modifiedAt: now,
          },
          workLogId
        );
      }

      const { error } = await supabase.from(WORK_LOGS_TABLE).update(updateData).eq('id', workLogId);

      if (error)
        handleSupabaseError(error, { operation: '정산 상태 변경', table: WORK_LOGS_TABLE });

      logger.info('정산 상태 변경 완료', { workLogId, status });
    } catch (error) {
      rethrowOrHandle(error, '정산 상태 변경', { workLogId, status, actorId });
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
    actorId: string
  ): Promise<void> {
    try {
      logger.info('개인 정산 설정 저장 시작', { workLogId, actorId });

      // 소유권 검증
      const { workLog } = await this.validateWorkLogOwnership(workLogId, actorId, '정산 설정 수정');

      // 정산 완료된 근무 기록은 급여/수당/세금 설정 수정 불가 (fail-closed).
      // 완료 시 동결된 payroll_amount 와 표시·이력 정합을 서버측에서 보호한다(UI 방어만으로는 부족).
      if (workLog.payrollStatus === STATUS.PAYROLL.COMPLETED) {
        throw new AlreadySettledError();
      }

      // 기존 수정 이력에 새 항목 추가 (Supabase에는 arrayUnion이 없으므로 수동 추가)
      // 경계 검증: jsonb 이력이 오염(비배열·비객체)이면 [] 폴백 + 관측(throw 금지).
      const rawHistory = (workLog as unknown as Record<string, unknown>)
        .settlementModificationHistory;
      const historyParsed = settlementModificationHistorySchema.safeParse(rawHistory ?? []);
      if (!historyParsed.success) {
        logger.error('정산 수정 이력 형식 오류 — 빈 배열로 폴백', {
          workLogId,
          issues: historyParsed.error.issues,
        });
      }
      const existingHistory = historyParsed.success ? historyParsed.data : [];
      const updatedHistory = [...existingHistory, data.modificationEntry];

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
      rethrowOrHandle(error, '개인 정산 설정 저장', { workLogId, actorId });
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
    actorId: string,
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

    // owner 는 workspaceId 유무와 무관하게 통과(레거시 row 포함). 비-owner 만 멤버십·협업자 판정.
    if (jobPosting.ownerId !== actorId) {
      if (!jobPosting.workspaceId) {
        throw new PermissionError(ERROR_CODES.INFRA_PERMISSION_DENIED, {
          userMessage: `공고에 팀이 지정되지 않았습니다: ${operationMessage}`,
        });
      }

      const authority = await resolvePostingAuthority({
        jobPostingId: jobPosting.id,
        workspaceId: jobPosting.workspaceId,
        postingOwnerId: jobPosting.ownerId,
        actorId,
        operation: operationMessage,
      });

      if (!canManagePosting(authority)) {
        throw new PermissionError(ERROR_CODES.INFRA_PERMISSION_DENIED, {
          userMessage: `권한이 있는 공고의 근무 기록만 ${operationMessage}할 수 있습니다`,
        });
      }
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

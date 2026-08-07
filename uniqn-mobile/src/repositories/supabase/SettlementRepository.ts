/**
 * UNIQN Mobile - Supabase Settlement Repository
 *
 * @description Supabase PostgREST 기반 Settlement Repository 구현
 * @version 1.0.0
 *
 * 책임:
 * 1. 근무 시간 수정 (소유권 검증 + 정산 완료 차단)
 * 2. 개별/일괄 정산 처리 (서버 RPC settle_work_log / bulk_settle_work_logs 위임)
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
import { handleSupabaseError } from '@/utils/supabase';
// 🔑 이 파일은 이제 **읽지 않는다.** SELECT 화이트리스트(WORK_LOG_COLUMNS·JOB_POSTING_COLUMNS),
//    행 → 도메인 변환(toCamelCase·parseWorkLogDocument·parseJobPostingDocument·applyTsPreference),
//    소유권 판정(IdNormalizer·STATUS·postingAuthority) 의존이 전부 사라졌다 —
//    쓰기 경로 5종이 모두 SECDEF RPC 로 옮겨가면서 클라 선행 조회 자체가 없어졌다(아래 묘비 참조).
// 실적(출퇴근) 쓰기의 단일 관문. 이 경로의 직접 UPDATE 는 여기로 흡수됐다.
import { updateSlot as updateWorkLogSlot } from './WorkLogRepositoryVenue';
import type { TaxSettings } from '@/utils/settlement';
import type { PayrollStatus } from '@/types';
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

// 🔑 `settlementModificationHistorySchema` 는 여기 있었고, **서버로 옮겨졌다**.
//    클라가 이력 배열을 읽어 append 하던 시절, 오염(비배열)된 jsonb 를 [] 로 접는 경계 검증이었다.
//    이제 append 가 RPC 의 UPDATE 문 안에서 일어나므로 클라는 배열을 읽지도 보내지도 않는다 —
//    같은 폴백을 서버 `jsonb_typeof(...) = 'array'` CASE 가 수행한다
//    (20260807190000, 회귀 고정 = settlement_custom_rpc.test.sql 15·16번).

/**
 * 정산 RPC 응답 경계 스키마.
 *
 * 서버가 반환한 jsonb 는 PostgREST 를 거쳐 `any` 로 들어온다 — 금액이 걸린 경계라
 * 형태를 확인하지 않으면 `undefined ?? 0` 이 "0원 정산 완료" 로 화면에 그대로 나간다.
 * (경계 검증 규약: 외부 응답은 신뢰하지 않는다)
 */
const settleWorkLogRpcSchema = z.object({
  amount: z.number(),
  breakdown: z.record(z.string(), z.unknown()).optional(),
});

const bulkSettleRpcSchema = z.object({
  results: z.array(
    z.object({
      success: z.boolean(),
      workLogId: z.string(),
      amount: z.number(),
      message: z.string(),
    })
  ),
});

/**
 * RPC 에러에서 메시지 문자열을 뽑는다.
 *
 * supabase-js 의 `PostgrestError` 는 `Error` 를 상속하지만(실측: postgrest-js d.cts:26),
 * 그렇지 않은 에러 모양도 이 경계로 들어올 수 있다. `instanceof Error` 만 보고
 * `String(error)` 로 떨어지면 평범한 객체가 `'[object Object]'` 가 되어 **아래 접두사 매칭이
 * 통째로 무력화**되고, 서버가 보낸 사용자 문구 대신 '알 수 없는 오류'가 화면에 나간다.
 */
function rpcErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

/**
 * `set_work_log_payroll_status` RPC 가 RAISE 한 도메인 에러를 앱 에러로 변환.
 * (매칭되지 않으면 null 반환 → 공통 핸들러로 위임)
 *
 * 서버 메시지는 `CODE: 사용자 문구` 형식이라 접두사를 떼어 그대로 노출한다 —
 * 사유 상한·XSS 문구를 클라와 서버 두 곳에서 따로 관리하면 조용히 갈라진다.
 */
function toPayrollStatusError(
  error: unknown
): BusinessError | PermissionError | ValidationError | null {
  const message = rpcErrorMessage(error);
  const userMessage = (fallback: string): string => {
    const idx = message.indexOf(': ');
    return idx >= 0 ? message.slice(idx + 2).trim() : fallback;
  };

  if (message.includes('PERMISSION_DENIED')) {
    return new PermissionError(ERROR_CODES.INFRA_PERMISSION_DENIED, {
      userMessage: userMessage('권한이 있는 공고의 근무 기록만 정산 상태를 변경할 수 있습니다'),
    });
  }
  if (message.includes('WORK_LOG_NOT_FOUND')) {
    return new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
      userMessage: '근무 기록을 찾을 수 없습니다',
    });
  }
  if (message.includes('POSTING_NOT_FOUND')) {
    return new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
      userMessage: '공고를 찾을 수 없습니다',
    });
  }
  // ⚠️ INVALID_STATUS 를 여기서 반드시 잡아야 한다. 놓치면 공통 핸들러의
  //    `P0001 && INVALID_STATUS` 특례(confirm_application 동시성용)로 떨어져
  //    "다른 사용자가 먼저 처리했어요" 라는 **거짓 안내**가 나간다.
  if (message.includes('INVALID_STATUS')) {
    return new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
      userMessage: userMessage('알 수 없는 정산 상태입니다'),
    });
  }
  if (message.includes('INVALID_INPUT')) {
    // 사유 미입력만 VALIDATION_REQUIRED, 나머지(길이·XSS)는 보안 코드로 — 기존 클라 분기와 동일.
    const isMissingReason = message.includes('사유를 입력');
    return new ValidationError(
      isMissingReason ? ERROR_CODES.VALIDATION_REQUIRED : ERROR_CODES.SECURITY_XSS_DETECTED,
      {
        ...(isMissingReason ? {} : { category: 'security' as const, severity: 'medium' as const }),
        userMessage: userMessage('정산 상태 변경 요청이 올바르지 않습니다'),
      }
    );
  }
  return null;
}

/**
 * `settle_work_log` RPC 가 RAISE 한 도메인 에러를 앱 에러로 변환.
 * (매칭되지 않으면 null 반환 → 공통 핸들러로 위임)
 *
 * 개별 정산은 throw 하지 않고 `{success:false, message}` DTO 로 접어 반환하는 계약이라
 * 여기서 만든 `userMessage` 가 그대로 화면 문구가 된다 — 전환 전 클라 구현이 내던 문구를
 * 서버가 그대로 갖고 있으므로 접두사만 떼어 쓴다(문구를 두 곳에서 관리하면 조용히 갈라진다).
 */
function toSettleWorkLogError(
  error: unknown
): BusinessError | PermissionError | ValidationError | null {
  const message = rpcErrorMessage(error);
  const userMessage = (fallback: string): string => {
    const idx = message.indexOf(': ');
    return idx >= 0 ? message.slice(idx + 2).trim() : fallback;
  };

  if (message.includes('PERMISSION_DENIED')) {
    return new PermissionError(ERROR_CODES.INFRA_PERMISSION_DENIED, {
      userMessage: userMessage('권한이 있는 공고의 근무 기록만 정산할 수 있습니다'),
    });
  }
  if (message.includes('WORK_LOG_NOT_FOUND')) {
    return new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
      userMessage: '근무 기록을 찾을 수 없습니다',
    });
  }
  if (message.includes('POSTING_NOT_FOUND')) {
    return new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
      userMessage: '공고를 찾을 수 없습니다',
    });
  }
  // 전환 전과 같은 에러 클래스를 유지한다 — 중복 정산은 AlreadySettledError(E6009).
  if (message.includes('ALREADY_SETTLED')) {
    return new AlreadySettledError();
  }
  // ⚠️ INVALID_STATUS 를 반드시 여기서 잡아야 한다. 놓치면 공통 핸들러의
  //    `P0001 && INVALID_STATUS` 특례(confirm_application 동시성용)로 떨어져
  //    "다른 사용자가 먼저 처리했어요" 라는 **거짓 안내**가 나간다.
  if (message.includes('INVALID_STATUS')) {
    return new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage: userMessage('출퇴근이 완료된 근무 기록만 정산할 수 있습니다'),
    });
  }
  if (message.includes('INVALID_INPUT')) {
    return new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
      userMessage: userMessage('정산 요청이 올바르지 않습니다'),
    });
  }
  return null;
}

/**
 * `update_work_log_custom_settlement` RPC 가 RAISE 한 도메인 에러를 앱 에러로 변환.
 * (매칭되지 않으면 null 반환 → 공통 핸들러로 위임)
 *
 * 전환 전 클라 구현이 내던 에러 클래스를 그대로 유지한다 — 정산 완료 건은 AlreadySettledError,
 * 소유권 실패는 PermissionError. 화면 분기가 클래스로 되어 있어 여기가 갈라지면 조용히 새 문구가 뜬다.
 */
function toCustomSettlementError(
  error: unknown
): BusinessError | PermissionError | ValidationError | null {
  const message = rpcErrorMessage(error);
  const userMessage = (fallback: string): string => {
    const idx = message.indexOf(': ');
    return idx >= 0 ? message.slice(idx + 2).trim() : fallback;
  };

  if (message.includes('PERMISSION_DENIED')) {
    return new PermissionError(ERROR_CODES.INFRA_PERMISSION_DENIED, {
      userMessage: userMessage('권한이 있는 공고의 근무 기록만 정산 설정을 수정할 수 있습니다'),
    });
  }
  if (message.includes('WORK_LOG_NOT_FOUND')) {
    return new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
      userMessage: '근무 기록을 찾을 수 없습니다',
    });
  }
  if (message.includes('POSTING_NOT_FOUND')) {
    return new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
      userMessage: '공고를 찾을 수 없습니다',
    });
  }
  // 전환 전 `if (payrollStatus === COMPLETED) throw new AlreadySettledError()` 와 같은 클래스.
  if (message.includes('ALREADY_SETTLED')) {
    return new AlreadySettledError();
  }
  if (message.includes('INVALID_INPUT')) {
    // 사유 길이·XSS 는 보안 코드로 접는다 — 형제 toPayrollStatusError 와 같은 판단.
    const isSecurity = message.includes('허용되지 않는 문자') || message.includes('200자');
    return new ValidationError(
      isSecurity ? ERROR_CODES.SECURITY_XSS_DETECTED : ERROR_CODES.VALIDATION_FORMAT,
      {
        ...(isSecurity ? { category: 'security' as const, severity: 'medium' as const } : {}),
        userMessage: userMessage('정산 설정 저장 요청이 올바르지 않습니다'),
      }
    );
  }
  return null;
}

/**
 * 일괄 정산 청크 크기.
 *
 * 🔴 서버 `bulk_settle_work_logs` 의 상한(100)과 **같은 값이어야 한다**
 *    (20260802161000_settle_work_log_rpcs.sql). 청크당 RPC 를 1회 부르는 구조라
 *    이 값을 키우면 서버가 INVALID_INPUT 으로 거부하고, 전량을 한 번에 보내면
 *    statement_timeout 에 걸려 부분 성공이 통째로 사라진다.
 */
const BATCH_CHUNK_SIZE = 100;

// ============================================================================
// Internal Types
// ============================================================================

// (WorkLogWithOverrides 는 calculateSettlementAmount 전용 타입이었고 그 함수와 함께 사라졌다 —
//  override 3종은 이제 서버가 work_logs 컬럼에서 직접 읽는다.)

// ============================================================================
// Helpers
// ============================================================================

// 🔑 `WorkLogOwnershipResult` · `toWorkLog` · `toJobPosting` 도 여기 있었고,
//    소유권 선행 조회(validateWorkLogOwnership)와 함께 사라졌다. 이 파일에 남은 조회는 없다.
//
//    ⚠️ 그중 `toJobPosting` 이 지키던 계약은 **다른 곳에서 계속 살아 있어야 한다**:
//    컨테이너(지점) 공고를 `parseJobPostingDocument` 로 읽으면 null 로 증발한다.
//    컨테이너의 `schedule` 은 `{kind, softTargets, roleSalaries}` 인데 dated 분기가
//    `.strict()` + `primaryDate/allDates/requirements` 필수라 "Unrecognized key: softTargets"
//    로 거부되기 때문이다(prod 실측 행으로 재현 확인, 고정 = JobPostingRepository.venue.test.ts:1-6).
//    이 경로에서 그 함정이 없어진 이유는 함정을 고쳐서가 아니라 **클라가 더 이상 공고를
//    파싱하지 않기 때문**이다 — 서버 RPC 가 job_postings 를 SQL 로 직접 읽는다.
//    따라서 지점 직속 배치의 정산 가능성은 이제 RPC 의 인가 술어가 보장한다.

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

  /**
   * 근무 시간(실적) 수정 — 서버 RPC `update_work_log_slot` 1회.
   *
   * 🔴 형제 경로(ConfirmedStaffRepository)와 **완전히 같은 관문**을 통과한다. 예전엔 두 곳이
   * 각자 조회 → 소유권 검증 → 정산 잠금 → 이력 append → status 파생 → UPDATE 를 재구현했고,
   * 그 어긋남이 SET-1(정산 탭에서 시간을 고쳐도 status 가 안 올라가 영원히 정산 불가)이었다.
   * 공유 헬퍼로 증상을 막아 왔지만 규칙이 두 벌인 사실은 그대로였다 — 서버 한 곳으로 모은다
   * (20260806140000). 권한·정산 잠금·상태 파생·이력 append 는 전부 RPC 안에서 끝난다.
   *
   * 🔴 **`notes` 축은 이 경로에서 사라졌다.** 예전에는 RPC 뒤에 `work_logs.notes` 만 고치는
   *    좁은 UPDATE 가 덧붙어 있었다(채우는 호출부는 없었지만 계약에는 남아 있었다). 배치 메모는
   *    통합 편집 시트가 RPC `memo` 키로 소유하므로 이제 중복이고, 남겨 두면 시간모델 R4
   *    (`work_logs` 직접 UPDATE REVOKE) 시행 시 **"메모를 넣은 저장만 42501 로 실패"** 하는
   *    재현 조건이 좁은 경로가 된다. 저장 한 번 = RPC 한 번을 여기서도 지킨다.
   */
  async updateWorkTimeWithTransaction(
    context: UpdateWorkTimeContext,
    actorId: string
  ): Promise<void> {
    try {
      logger.info('근무 시간 수정 시작', { workLogId: context.workLogId, actorId });

      await updateWorkLogSlot(context.workLogId, {
        checkIn: context.checkInTime,
        checkOut: context.checkOutTime,
        reason: context.reason,
        editedBy: actorId,
      });

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

      // 서버 RPC 단일 왕복 (감사 L1 잔여). 이전에는
      // select(work_log) → select(posting) → (권한 RPC) → 클라 계산 → update 다단계였다.
      //
      // 이 전환이 실제로 고치는 것:
      //   1) 금액이 **클라에서 계산돼** payroll_amount 에 실려 갔다 → 서버가 DB 값으로 재계산한다.
      //      🔑 계산기(fn_settlement_amount)를 함께 옮기지 않고 확정만 옮겼다면 서버가 클라 금액을
      //         그대로 받게 되어 오히려 방어가 사라졌을 것이다 — 두 마이그가 한 묶음인 이유다.
      //   2) 상태 확인과 update 사이 TOCTOU(그 사이 다른 세션이 확정하면 중복 정산이 성사됐다)
      //      → 서버가 FOR UPDATE 로 잠근 뒤 판정한다.
      //   3) 출퇴근 완료 게이트·중복 정산 방지·ES-003 수당 스냅샷이 전부 서버로 이동했다.
      //
      // actorId 는 서버가 auth.uid() 로 다시 판정한다 — 여기서는 관측용으로만 남긴다.
      const { data, error } = await supabase.rpc('settle_work_log', {
        p_work_log_id: context.workLogId,
        p_notes: context.notes ?? null,
      });

      if (error) {
        const mapped = toSettleWorkLogError(error);
        if (mapped) throw mapped;
        handleSupabaseError(error, { operation: '개별 정산 처리', table: WORK_LOGS_TABLE });
      }

      const parsed = settleWorkLogRpcSchema.safeParse(data);
      if (!parsed.success) {
        // 성공 응답인데 형태가 낯설면 금액을 지어내지 않고 실패로 접는다(fail-closed).
        // 여기서 0 원을 반환하면 화면에 "0원 정산 완료" 가 뜬다.
        logger.error('개별 정산 응답 형식 오류', undefined, {
          workLogId: context.workLogId,
          issues: parsed.error.issues,
        });
        throw new BusinessError(ERROR_CODES.UNKNOWN, {
          userMessage: '정산 결과를 확인할 수 없습니다. 잠시 후 다시 시도해주세요',
        });
      }

      const canonicalAmount = parsed.data.amount;

      // 화면 미리보기(features/employer/settlements/settlementCalc)와 서버 canonical 의 차이를 관측한다.
      // 전환 전에도 같은 경고가 있었지만 그때는 "클라 미리보기 vs 클라 canonical" 이었다.
      // 이제는 **클라 계산기 vs 서버 계산기** 를 비교하므로 이식 드리프트까지 이 한 줄에 드러난다.
      if (context.amount !== canonicalAmount) {
        logger.warn('Individual settlement amount mismatch detected, using canonical amount', {
          component: 'SettlementRepository',
          workLogId: context.workLogId,
          requestedAmount: context.amount,
          canonicalAmount,
          breakdown: parsed.data.breakdown,
        });
      }

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

        // 청크당 서버 RPC **1회** (감사 L1 잔여). 이전에는 청크마다
        // select(work_logs) → select(job_postings) → 권한 RPC×공고수 → update×N 이었고
        // 금액도 클라가 계산해 실어 보냈다. 권한·상태·중복·금액 판정이 전부 서버로 갔다.
        //
        // 🔴 전량을 한 번에 보내지 않는다 — 서버가 항목별 서브트랜잭션을 도는 구조라
        //    한 호출이 커지면 statement_timeout 에 걸려 **부분 성공이 통째로 사라진다.**
        //    BATCH_CHUNK_SIZE 는 서버 상한과 같은 값이어야 한다(상수 주석 참조).
        const { data, error: rpcError } = await supabase.rpc('bulk_settle_work_logs', {
          p_work_log_ids: chunkIds,
          p_notes: context.notes ?? null,
        });

        const parsed = rpcError ? null : bulkSettleRpcSchema.safeParse(data);

        // 청크 호출 자체가 실패하거나 응답 형태가 낯설면 **그 청크만** 실패로 기록하고
        // 다음 청크로 넘어간다 — 앞 청크의 성공 커밋을 되돌리지 않는 것이 부분 성공 계약이다.
        if (rpcError || !parsed || !parsed.success) {
          logger.error('일괄 정산 - 청크 처리 실패', rpcError ? toError(rpcError) : undefined, {
            chunkSize: chunkIds.length,
            issues: parsed && !parsed.success ? parsed.error.issues : undefined,
          });
          for (const id of chunkIds) {
            results.push({
              success: false,
              workLogId: id,
              amount: 0,
              message: '정산 업데이트 실패',
            });
            failedCount++;
          }
          continue;
        }

        // 집계는 서버가 준 카운터가 아니라 results 배열에서 다시 낸다 —
        // 화면이 실제로 읽는 건 results(실패자 이름 나열)이고, 둘이 어긋나면 카운터가 거짓말이 된다.
        // 서버가 입력 순서를 보존하므로 results 순서는 전환 전과 동일하다.
        for (const item of parsed.data.results) {
          results.push(item);
          if (item.success) {
            successCount++;
            totalAmount += item.amount;
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

      // 서버 RPC 단일 왕복 (감사 L1). 이전에는 select→select→(권한 RPC)→update 다단계
      // 뮤테이션이었고 CLAUDE.md 의 "정산=RPC 필수" 규약과 어긋났다.
      //
      // 이 전환이 실제로 고치는 것:
      //   1) 되돌리기 사유 필수·XSS·200자 상한이 클라에만 있어 raw PostgREST 로 우회됐다 → 서버 강제
      //   2) settlement_modification_history 를 select 로 읽고 update 로 통째 덮어써서
      //      동시 요청이 앞의 이력 항목을 조용히 지웠다(Lost Update) → 서버가 FOR UPDATE + 단일 문장
      //   3) 소유권 확인 시점과 update 시점 사이 payrollStatus 가 바뀌어도 재확인이 없었다(TOCTOU)
      //
      // actorId 는 서버가 auth.uid() 로 다시 판정한다 — 여기서는 관측용으로만 남긴다.
      const { error } = await supabase.rpc('set_work_log_payroll_status', {
        p_work_log_id: workLogId,
        p_status: status,
        p_reason: options?.reason ?? null,
      });

      if (error) {
        const mapped = toPayrollStatusError(error);
        if (mapped) throw mapped;
        handleSupabaseError(error, { operation: '정산 상태 변경', table: WORK_LOGS_TABLE });
      }

      logger.info('정산 상태 변경 완료', { workLogId, status });
    } catch (error) {
      // 매핑된 앱 에러는 rethrowOrHandle 의 isAppError 분기로 그대로 재전파된다.
      rethrowOrHandle(error, '정산 상태 변경', { workLogId, status, actorId });
    }
  }

  // ==========================================================================
  // Custom Settlement Settings
  // ==========================================================================

  /**
   * 개인 정산 설정(급여/수당/세금) 저장 — 서버 RPC `update_work_log_custom_settlement` 1회.
   *
   * 🔴 **이 전환의 본체는 이력 jsonb Lost Update 다.** 이전 구현은
   *    select(work_log) → select(posting) → 클라에서 배열 append → update 통째 덮어쓰기였다.
   *    잠금이 없어 두 요청이 겹치면 이렇게 됐다:
   *      T1 read [A] · T2 read [A] · T1 write [A,B] · T2 write [A,C]  ← B 가 조용히 사라진다
   *    정산 수정 이력은 금액 분쟁 시 "누가 언제 얼마로 바꿨나"의 유일한 근거라, 무음 유실은
   *    금전 사고의 증거를 지우는 것과 같다. 서버가 FOR UPDATE 로 잡고 **UPDATE 문 안에서**
   *    append 하므로, 클라가 배열을 되돌려보낼 방법 자체가 사라졌다(RPC 시그니처에 인자가 없다).
   *
   * 함께 서버로 넘어간 것:
   *   · 소유권 판정 — 형제 RPC 3종과 **글자 그대로 같은 술어**를 쓴다(갈라지지 않게)
   *   · 정산 완료 동결 — 전환 전 `AlreadySettledError` 분기가 서버 ALREADY_SETTLED 로.
   *     매핑은 toCustomSettlementError 가 같은 에러 클래스로 되돌린다
   *   · 이력 오염(비배열) 폴백 — 클라 zod safeParse 가 하던 일을 서버 jsonb_typeof 가 한다
   *   · modifiedBy/modifiedAt 재판정 — 클라가 보낸 값을 신뢰하지 않는다
   *
   * ⚠️ `actorId` 는 서버가 `auth.uid()` 로 다시 판정한다 — 여기서는 관측용으로만 남긴다.
   * ⚠️ work_logs 직접 PATCH 는 아직 열려 있어 이 RPC 만의 구멍은 아니다. 채널 핀·REVOKE 는
   *    롤아웃 확인이 선행 조건이라 R4 의 몫이다(20260807190000 헤더 참조).
   */
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

      const { error } = await supabase.rpc('update_work_log_custom_settlement', {
        p_work_log_id: workLogId,
        p_custom_salary_info: data.customSalaryInfo,
        p_custom_tax_settings: data.customTaxSettings,
        p_modification_entry: data.modificationEntry,
        // 미설정(undefined)은 null 로 명시한다 — PostgREST 는 키 부재를 DEFAULT 로 보지만,
        // 여기서 값을 생략하면 "수당을 지웠다"와 "수당을 안 건드렸다"가 같은 요청이 된다.
        // 이 화면의 계약은 항상 전량 저장이므로 부재 = 공고 기본 수당 사용 = null 이다.
        p_custom_allowances: data.customAllowances ?? null,
      });

      if (error) {
        const mapped = toCustomSettlementError(error);
        if (mapped) throw mapped;
        handleSupabaseError(error, { operation: '개인 정산 설정 저장', table: WORK_LOGS_TABLE });
      }

      logger.info('개인 정산 설정 저장 완료', { workLogId });
    } catch (error) {
      rethrowOrHandle(error, '개인 정산 설정 저장', { workLogId, actorId });
    }
  }

  // 🔑 `validateWorkLogOwnership` 도 여기 있었고, **서버로 옮겨졌다**(삭제, 복제 아님).
  //    이 클래스의 쓰기 경로 4종(시간 수정·개별 정산·일괄 정산·상태 변경)과 마지막 남았던
  //    개인 정산 설정 저장까지 전부 SECDEF RPC 경유가 되면서, 클라가 소유권을 먼저 조회해
  //    판정하던 단계가 통째로 불필요해졌다. 각 RPC 가 auth.uid() 로 **같은 술어**를 재판정한다.
  //    🔴 이 함수를 되살리지 말 것 — 클라 판정을 다시 두면 서버 술어와 갈라지고,
  //       갈라진 쪽이 넓어져도 아무도 알아채지 못한다(SET-1 회귀의 형태가 바로 그것이었다).
  //    선행 조회가 사라진 부수 효과로 저장 1회의 왕복이 3회 → 1회로 줄었다.

  // 🔑 `calculateSettlementAmount` 는 여기 있었고, 서버로 **옮겨졌다**(삭제, 복제 아님).
  //    정본 = `public.fn_settlement_amount`
  //    (supabase/migrations/20260802160000_settlement_amount_calculator.sql).
  //    컨테이너/일반 분기·역할 단가표 해소·수당 PROVIDED_FLAG·항목별 세금까지 그대로 이식했고,
  //    짝 테스트(pgTAP settlement_amount_calc.test.sql ↔ Jest settlementAmountParity.test.ts)가
  //    같은 픽스처 표로 두 구현의 기대값을 고정한다.
  //    이 파일에 다시 클라 계산기를 들이면 "화면과 지급 기록이 다른" 상태가 되돌아온다.
}

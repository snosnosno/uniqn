/**
 * workTimeModification — 근무 시간 수정 이력(modification_history) 공유 로직
 *
 * 출퇴근 시각 수정 시 work_logs.modification_history(JSONB 배열)에 감사 이력을 append 한다.
 * 이 배열 길이가 증가하면 DB 트리거(notify_on_work_log_update)가 스태프에게 "근무 시간 변경"
 * 알림을 보내고, SettlementDetailModal 의 이력 섹션이 previousStartTime/newStartTime 등을 표시한다.
 *
 * 두 쓰기 경로(ConfirmedStaffRepository·SettlementRepository)가 동일 규약으로 append 하도록
 * 순수 빌더 + reason 검증을 여기에 모은다. 엔트리 키는 트리거·표시 컴포넌트 계약(camelCase)을 따른다.
 */
import { z } from 'zod';
import { ValidationError, ERROR_CODES } from '@/errors';
import { xssValidation } from '@/utils/security';
import type { WorkTimeModification } from '@/types';
import type { TimeInput } from '@/shared/time/types';

/** 수정 사유 최대 길이 — 알림 본문/이력 표시 과팽창 방지. */
export const MAX_WORK_TIME_REASON_LENGTH = 200;

const reasonSchema = z
  .string()
  .max(MAX_WORK_TIME_REASON_LENGTH, {
    message: `수정 사유는 ${MAX_WORK_TIME_REASON_LENGTH}자 이하여야 합니다`,
  })
  .refine(xssValidation, { message: '수정 사유에 허용되지 않는 문자가 포함되어 있습니다' });

/**
 * 수정 사유 XSS·길이 검증(쓰기 경계). 빈 값은 허용(사유 미입력 = '' 로 정규화).
 * modification_history 는 스태프 알림·이력 표시로 노출되므로 미검증 입력 유입을 차단한다(S1).
 */
export function assertWorkTimeReason(reason: string | null | undefined): string {
  if (reason === null || reason === undefined || reason.trim().length === 0) return '';
  const parsed = reasonSchema.safeParse(reason);
  if (!parsed.success) {
    throw new ValidationError(ERROR_CODES.SECURITY_XSS_DETECTED, {
      category: 'security',
      severity: 'medium',
      userMessage: parsed.error.issues[0]?.message ?? '수정 사유가 올바르지 않습니다',
    });
  }
  return reason;
}

export interface BuildWorkTimeModificationInput {
  previousStartTime?: TimeInput;
  previousEndTime?: TimeInput;
  /** 변경 안 함(undefined)은 엔트리에 담지 않는다. null = 미정으로 변경. */
  newStartTime?: TimeInput;
  newEndTime?: TimeInput;
  reason: string;
  modifiedBy: string;
  modifiedAt: TimeInput;
}

/**
 * 기존 이력에 새 수정 엔트리를 append 한 새 배열을 반환(불변). 변경되지 않은 시간축(undefined)은
 * 엔트리에서 생략해 표시 컴포넌트가 "변경 없음"으로 처리하게 한다.
 */
export function appendWorkTimeModification(
  history: WorkTimeModification[] | undefined,
  input: BuildWorkTimeModificationInput
): WorkTimeModification[] {
  const entry: WorkTimeModification = {
    modifiedAt: input.modifiedAt,
    modifiedBy: input.modifiedBy,
    reason: input.reason,
  };
  if (input.newStartTime !== undefined) {
    entry.previousStartTime = input.previousStartTime;
    entry.newStartTime = input.newStartTime;
  }
  if (input.newEndTime !== undefined) {
    entry.previousEndTime = input.previousEndTime;
    entry.newEndTime = input.newEndTime;
  }
  return [...(history ?? []), entry];
}

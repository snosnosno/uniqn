/**
 * 근무 기록 슬롯 편집의 순수 부분(패치 조립·에러 매핑) — 네트워크 없이 테스트하려고 분리.
 * 호출은 lib/workLogSlot.ts.
 */
import {
  AppError,
  BusinessError,
  ERROR_CODES,
  PermissionError,
  ValidationError,
} from '@/core/errors/AppError';
import { notFound } from '@/core/constants/messages';
import { settledLockMessage } from '@/core/domains/settlement/settledLockMessage';

export interface OpsSlotPatch {
  checkIn?: Date | null;
  checkOut?: Date | null;
  reason?: string;
  editedBy?: string;
}

/** 패치 jsonb — 3상 계약을 키 존재로 표현한다. */
export function toSlotPatch(input: OpsSlotPatch): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (input.checkIn !== undefined)
    patch.checkIn = input.checkIn ? input.checkIn.toISOString() : null;
  if (input.checkOut !== undefined) {
    patch.checkOut = input.checkOut ? input.checkOut.toISOString() : null;
  }
  if (input.reason !== undefined) patch.reason = input.reason;
  if (input.editedBy !== undefined) patch.editedBy = input.editedBy;
  return patch;
}

/**
 * 모바일 toUpdateSlotError 와 같은 분기(데드락·권한·없음·정산 잠금·입력 오류).
 * 손 이식본이라 --check 가 못 본다 — 원본이 바뀌면 sync 테스트의 해시 카나리가 실패한다.
 * 원본 해시(sha256 앞 16자): 7161e23510cfc7a8 — 원본 변경을 반영한 뒤 이 값을 갱신한다.
 */
export function toUpdateSlotError(error: unknown, settledVerb = '시간을 수정할'): AppError | null {
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error);
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';
  const serverText = (fallback: string) => {
    const idx = message.indexOf(': ');
    return idx >= 0 ? message.slice(idx + 2).trim() : fallback;
  };
  if (code === '40P01' || message.includes('deadlock detected')) {
    return new BusinessError(ERROR_CODES.BUSINESS_INVALID_STATE, {
      userMessage: '다른 작업과 겹쳤어요. 잠시 후 다시 시도해주세요.',
    });
  }
  if (message.includes('PERMISSION_DENIED')) {
    return new PermissionError(ERROR_CODES.INFRA_PERMISSION_DENIED, {
      userMessage: serverText('권한이 있는 공고의 근무 기록만 수정할 수 있습니다'),
    });
  }
  if (message.includes('WORK_LOG_NOT_FOUND')) {
    return new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, { userMessage: notFound('근무 기록') });
  }
  if (message.includes('ALREADY_SETTLED')) {
    return new BusinessError(ERROR_CODES.BUSINESS_ALREADY_SETTLED, {
      userMessage: settledLockMessage(settledVerb),
    });
  }
  if (message.includes('INVALID_INPUT')) {
    return new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
      userMessage: serverText('수정 요청이 올바르지 않습니다'),
    });
  }
  return null;
}

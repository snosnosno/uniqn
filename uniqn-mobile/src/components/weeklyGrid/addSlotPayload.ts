/**
 * addSlotPayload — 추가 시트(B1)의 add_direct_staff 페이로드 빌더(순수 함수, write 경계).
 *
 * 풀 꽂기·전화검색 모드가 공유하는 단일 변환점. 컨테이너 job_posting_id 로 단일 배정을 만든다.
 * - E5: 날짜키 `toDateString`(YYYY-MM-DD) 정규화 — write 경계에서 1회 정규화(그리드 COUNT 키와 동일 포맷).
 * - S1: customRole(자유입력)은 `xssValidation` 통과분만. 실패 시 ValidationError(미호출 fail-closed).
 * - 시간대: 구조화 시작/종료('HH:mm')를 TIME_RE 형식 검증 후 `composeTimeSlot` 으로
 *   정규 'HH:mm - HH:mm' 로 조합(자유 텍스트 폐기). 형식 위반은 ValidationError(RPC 미호출).
 * - role==='other' 일 때만 customRole 을 동봉(confirm_application 평탄화 규약과 동일).
 *
 * 정원 가드·정원 카운트 정합·컨테이너 filled 미러 skip 은 RPC(add_direct_staff)가 보장한다(R1).
 */
import type { AddDirectStaffInput, DirectStaffAssignmentInput } from '@/types';
import { ValidationError, ERROR_CODES } from '@/errors';
import { toDateString } from '@/utils/date';
import { xssValidation } from '@/utils/security';
import { composeTimeSlot } from '@/domains/weeklyGrid';

const OTHER_ROLE_KEY = 'other';

/** 시각 형식('HH:mm', 시 1~2자리·분 2자리). EditSlotSheet 와 동일 계약. */
const TIME_RE = /^(\d{1,2}):(\d{2})$/;

export interface BuildAddSlotPayloadParams {
  /** venue 컨테이너 job_posting_id (= venueId) */
  containerId: string;
  /** 추가할 앱 가입자(스태프) uid */
  staffId: string;
  /** 선택일 — toDateString 으로 YYYY-MM-DD 정규화 */
  date: Date | string | number;
  /** staff_role 키(dealer/floor/serving/manager/staff/other) */
  role: string;
  /** role==='other' 일 때 표시명 */
  customRole?: string;
  /** 선택 시작 시각('HH:mm') — endTime 과 함께 timeSlot 으로 조합 */
  startTime?: string;
  /** 선택 종료 시각('HH:mm') — startTime 과 함께 timeSlot 으로 조합 */
  endTime?: string;
}

/** 필수 입력 검증 — 빈 문자열이면 ValidationError(작업 미수행). */
function requireValue(value: string, userMessage: string): string {
  if (!value.trim()) {
    throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, { userMessage });
  }
  return value;
}

/** 시각 형식 검증('HH:mm'). 위반 시 ValidationError(requireValue 와 동일 fail-closed 패턴). */
function requireTimeFormat(value: string, userMessage: string): string {
  if (!TIME_RE.test(value)) {
    throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, { userMessage });
  }
  return value;
}

/**
 * 구조화 시작/종료 → 정규 'HH:mm - HH:mm' timeSlot. 둘 다 비어 있으면 undefined(시간 선택은 옵션).
 * 하나라도 입력되면 양쪽 모두 TIME_RE 형식 검증 후 조합한다(반쪽/오형식은 거부).
 */
function buildTimeSlot(startTime?: string, endTime?: string): string | undefined {
  const start = startTime?.trim() ?? '';
  const end = endTime?.trim() ?? '';
  if (!start && !end) return undefined;
  const validStart = requireTimeFormat(start, '시작 시간 형식이 올바르지 않습니다');
  const validEnd = requireTimeFormat(end, '종료 시간 형식이 올바르지 않습니다');
  return composeTimeSlot(validStart, validEnd);
}

/** S1: 자유입력 XSS 검증 — 패턴 감지 시 ValidationError(RPC 미호출). */
function assertSafeText(value: string, field: string): string {
  if (!xssValidation(value)) {
    throw new ValidationError(ERROR_CODES.SECURITY_XSS_DETECTED, {
      category: 'security',
      severity: 'medium',
      userMessage: `${field}에 허용되지 않는 문자가 포함되어 있습니다`,
    });
  }
  return value;
}

/**
 * 추가 시트 입력 → add_direct_staff 페이로드(AddDirectStaffInput). 단일 배정만 생성한다.
 * @throws ValidationError 필수값 누락·날짜 정규화 실패·XSS 패턴 감지 시.
 */
export function buildAddSlotPayload(params: BuildAddSlotPayloadParams): AddDirectStaffInput {
  const containerId = requireValue(params.containerId, '운영처 정보가 필요합니다');
  const staffId = requireValue(params.staffId, '스태프를 선택해주세요');
  const role = requireValue(params.role, '역할을 선택해주세요');

  // E5: write 경계 날짜 정규화. 정규화 실패(빈 문자열)는 거부.
  const date = toDateString(params.date);
  if (!date) {
    throw new ValidationError(ERROR_CODES.VALIDATION_REQUIRED, {
      userMessage: '근무 날짜가 올바르지 않습니다',
    });
  }

  const isCustomRole = role === OTHER_ROLE_KEY;
  const trimmedCustom = params.customRole?.trim();
  // 구조화 시작/종료 → 정규 timeSlot(형식 검증 포함). 미입력이면 undefined.
  const timeSlot = buildTimeSlot(params.startTime, params.endTime);

  const assignment: DirectStaffAssignmentInput = {
    date,
    role,
    ...(isCustomRole && trimmedCustom
      ? { customRole: assertSafeText(trimmedCustom, '역할명') }
      : {}),
    ...(timeSlot ? { timeSlot } : {}),
  };

  return {
    jobPostingId: containerId,
    staffId,
    assignments: [assignment],
  };
}

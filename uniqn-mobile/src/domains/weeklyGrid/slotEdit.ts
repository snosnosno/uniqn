/**
 * slotEdit — 운영처 배치 슬롯 편집(B2)의 순수 로직.
 *
 * 편집 시트(EditSlotSheet)·WorkLogRepository.updateSlot 이 공유하는 검증/정렬 순수함수.
 * - 색상: U3 Midnight Craft 토큰 화이트리스트만 허용(자유 hex 금지, S1/U3).
 * - 메모: z.string().refine(xssValidation) 통과분만 허용(S1 XSS 차단, 기존 workLog notes 패턴).
 * - 시작시간 정렬: timeSlot('HH:MM - HH:MM') 시작시각 기준 비교자(자동정렬).
 * - 중복충돌: 같은 스태프 + 같은 시작시각 슬롯 경고(차단 아님).
 *
 * 모두 렌더 없이 결정적으로 단위테스트 가능한 순수함수(불변성: 새 객체만 생성).
 */
import { z } from 'zod';
import { ValidationError, ERROR_CODES } from '@/errors';
import { xssValidation } from '@/utils/security';

// ============================================================================
// 색상 토큰 팔레트 (U3 화이트리스트 — 자유 hex 금지)
// ============================================================================

/**
 * 슬롯 색상 토큰. tailwind.config.js Midnight Craft 팔레트의 부분집합만 허용.
 * work_logs.color 에는 hex 가 아닌 이 토큰 식별자를 저장한다(렌더 className 은 칩 메타에서 정적 매핑).
 */
export const SLOT_COLOR_TOKENS = [
  'primary-300',
  'primary-500',
  'primary-600',
  'primary-700',
  'surface-elevated',
  'surface-overlay',
  'surface-hover',
  'secondary-50',
  'secondary-100',
  'secondary-200',
  'secondary-900',
  'success',
  'warning',
  'error',
  'info',
] as const;

export type SlotColorToken = (typeof SLOT_COLOR_TOKENS)[number];

const SLOT_COLOR_SET: ReadonlySet<string> = new Set(SLOT_COLOR_TOKENS);

/** 색상 칩 메타(라벨 + 정적 className). NativeWind dark: 유실 방지를 위해 리터럴 문자열만 사용. */
export interface SlotColorChip {
  token: SlotColorToken;
  label: string;
  /** 칩 배경 className(정적 리터럴 — 동적 조합 금지). */
  swatchClassName: string;
}

export const SLOT_COLOR_CHIPS: readonly SlotColorChip[] = [
  { token: 'primary-300', label: '골드 라이트', swatchClassName: 'bg-primary-300' },
  { token: 'primary-500', label: '골드', swatchClassName: 'bg-primary-500' },
  { token: 'primary-600', label: '골드 딥', swatchClassName: 'bg-primary-600' },
  { token: 'primary-700', label: '골드 다크', swatchClassName: 'bg-primary-700' },
  { token: 'surface-elevated', label: '그레이', swatchClassName: 'bg-surface-elevated' },
  { token: 'surface-overlay', label: '그레이 딥', swatchClassName: 'bg-surface-overlay' },
  { token: 'surface-hover', label: '그레이 라이트', swatchClassName: 'bg-surface-hover' },
  { token: 'secondary-50', label: '뉴트럴 50', swatchClassName: 'bg-secondary-50' },
  { token: 'secondary-100', label: '뉴트럴 100', swatchClassName: 'bg-secondary-100' },
  { token: 'secondary-200', label: '뉴트럴 200', swatchClassName: 'bg-secondary-200' },
  { token: 'secondary-900', label: '뉴트럴 900', swatchClassName: 'bg-secondary-900' },
  { token: 'success', label: '성공', swatchClassName: 'bg-success-500 dark:bg-success-400' },
  { token: 'warning', label: '경고', swatchClassName: 'bg-warning-500 dark:bg-warning-400' },
  { token: 'error', label: '에러', swatchClassName: 'bg-error-500 dark:bg-error-400' },
  { token: 'info', label: '정보', swatchClassName: 'bg-info-500 dark:bg-info-400' },
];

/** 화이트리스트 색상 토큰 여부(자유 hex/미등록 값은 false). */
export function isValidSlotColor(value: unknown): value is SlotColorToken {
  return typeof value === 'string' && SLOT_COLOR_SET.has(value);
}

/** 색상 토큰 검증(쓰기 경계). 화이트리스트 외(자유 hex 등)면 ValidationError. */
export function assertSlotColor(value: string): SlotColorToken {
  if (!isValidSlotColor(value)) {
    throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
      field: 'color',
      userMessage: '허용되지 않은 색상입니다. 팔레트에서 선택해주세요.',
    });
  }
  return value;
}

// ============================================================================
// 기본값
// ============================================================================

/**
 * 슬롯 기본 시작시간 SSOT — 홀덤펍 저녁 운영 기준.
 * EditSlotSheet(편집 기본값)와 gridPrefill(프리필 공고 시작시간)이 공유(발산 방지).
 */
export const DEFAULT_SLOT_START_TIME = '18:00';

// ============================================================================
// 메모 (XSS / 길이)
// ============================================================================

export const MAX_SLOT_MEMO_LENGTH = 500;

/** 슬롯 메모 스키마: 길이 + XSS 검증(S1). 기존 workLog notes 패턴 동일. */
export const slotMemoSchema = z
  .string()
  .max(MAX_SLOT_MEMO_LENGTH, { message: `메모는 ${MAX_SLOT_MEMO_LENGTH}자를 초과할 수 없습니다` })
  .refine((val) => !val || xssValidation(val), {
    message: '위험한 문자열이 포함되어 있습니다',
  });

/** 메모 안전성 여부(XSS/길이 통과 시 true). */
export function isSafeSlotMemo(memo: string): boolean {
  return slotMemoSchema.safeParse(memo).success;
}

/** 메모 검증(쓰기 경계). XSS/길이 위반이면 ValidationError, 통과 시 trim 값 반환. */
export function assertSlotMemo(memo: string): string {
  const result = slotMemoSchema.safeParse(memo);
  if (!result.success) {
    throw new ValidationError(ERROR_CODES.VALIDATION_SCHEMA, {
      field: 'memo',
      userMessage: '메모에 허용되지 않은 내용이 있거나 너무 깁니다.',
    });
  }
  return result.data.trim();
}

// ============================================================================
// 시간 파싱 / 정렬 / 조합
// ============================================================================

/** 'HH:MM' 을 0~1439 분으로 파싱(범위 밖/형식 오류는 null). */
function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/**
 * timeSlot('HH:MM - HH:MM' / 'HH:MM~HH:MM' / 'HH:MM') 에서 시작시각을 분으로 추출.
 * 파싱 불가/누락이면 정렬 시 맨 뒤로 가도록 Number.POSITIVE_INFINITY 반환.
 */
export function parseSlotStartMinutes(timeSlot: string | null | undefined): number {
  if (!timeSlot) return Number.POSITIVE_INFINITY;
  const head = timeSlot.split(/\s*[-~]\s*/)[0] ?? '';
  const minutes = toMinutes(head);
  return minutes ?? Number.POSITIVE_INFINITY;
}

/** 시작시간 기준 슬롯 비교자(오름차순). 미파싱은 맨 뒤. */
export function compareSlotsByStartTime(
  a: { timeSlot: string | null },
  b: { timeSlot: string | null }
): number {
  const am = parseSlotStartMinutes(a.timeSlot);
  const bm = parseSlotStartMinutes(b.timeSlot);
  if (am === bm) return 0;
  return am - bm;
}

/** 시작시간 기준 정렬된 새 배열 반환(불변성: 원본 비변경). */
export function sortSlotsByStartTime<T extends { timeSlot: string | null }>(
  slots: readonly T[]
): T[] {
  return [...slots].sort(compareSlotsByStartTime);
}

/** 시작/종료 'HH:MM' → 'HH:MM - HH:MM' timeSlot 문자열 조합(앱 표준 구분자 ' - '). */
export function composeTimeSlot(startTime: string, endTime: string): string {
  return `${startTime} - ${endTime}`;
}

/** timeSlot 문자열을 시작/종료 'HH:MM' 으로 분해(없으면 빈 문자열). */
export function parseTimeSlotParts(timeSlot: string | null | undefined): {
  start: string;
  end: string;
} {
  if (!timeSlot) return { start: '', end: '' };
  const parts = timeSlot.split(/\s*[-~]\s*/);
  return { start: (parts[0] ?? '').trim(), end: (parts[1] ?? '').trim() };
}

// ============================================================================
// 중복충돌 경고 (차단 아님)
// ============================================================================

export interface SlotConflictInput {
  workLogId: string;
  staffId: string | null;
  timeSlot: string | null;
}

export interface SlotConflict {
  workLogId: string;
  reason: 'sameStaffSameStart';
}

/**
 * 같은 스태프 + 같은 시작시각 슬롯을 충돌로 표시(자기 자신 제외). 차단이 아닌 경고용.
 * staffId 누락/시작시각 미파싱이면 충돌 없음으로 본다.
 */
export function detectSlotConflicts(
  target: SlotConflictInput,
  siblings: readonly SlotConflictInput[]
): SlotConflict[] {
  if (!target.staffId) return [];
  const targetStart = parseSlotStartMinutes(target.timeSlot);
  if (!Number.isFinite(targetStart)) return [];
  return siblings
    .filter(
      (s) =>
        s.workLogId !== target.workLogId &&
        s.staffId === target.staffId &&
        parseSlotStartMinutes(s.timeSlot) === targetStart
    )
    .map((s) => ({ workLogId: s.workLogId, reason: 'sameStaffSameStart' as const }));
}

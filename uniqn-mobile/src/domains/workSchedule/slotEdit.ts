/**
 * slotEdit — 운영처 배치 슬롯 편집(B2)의 순수 로직.
 *
 * 편집 시트(EditSlotSheet)·WorkLogRepository.updateSlot 이 공유하는 검증/정렬 순수함수.
 * - 색상: U3 Midnight Craft 토큰 화이트리스트만 허용(자유 hex 금지, S1/U3).
 * - 메모: z.string().refine(xssValidation) 통과분만 허용(S1 XSS 차단, 기존 workLog notes 패턴).
 * - 시작시간 정렬: timeSlot('HH:MM - HH:MM') 시작시각 기준 비교자(자동정렬).
 * - 중복충돌: 같은 스태프의 근무 구간 겹침 경고(자정 포함, 차단 아님).
 *
 * 모두 렌더 없이 결정적으로 단위테스트 가능한 순수함수(불변성: 새 객체만 생성).
 */
import { z } from 'zod';
import { ValidationError, ERROR_CODES } from '@/errors';
import { xssValidation } from '@/utils/security';
import { deriveOvernightPreview } from '@/shared/time';

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

const SLOT_COLOR_SWATCH_BY_TOKEN: ReadonlyMap<string, string> = new Map(
  SLOT_COLOR_CHIPS.map((chip) => [chip.token, chip.swatchClassName])
);

/**
 * 색상 토큰 → 정적 배경 className(스태프 카드 색상 태그 렌더용, #4).
 * 미등록/미설정 토큰은 null — 렌더 측이 스와치를 생략한다. 동적 조합 금지(리터럴 맵 조회).
 */
export function slotColorSwatchClassName(token: string | null | undefined): string | null {
  if (!token) return null;
  return SLOT_COLOR_SWATCH_BY_TOKEN.get(token) ?? null;
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
 * 슬롯 시작시간 SSOT — 홀덤펍 저녁 운영 기준.
 *
 * ⚠️ 이건 **저장되는 기본값이 아니라 휠 피커의 초기 위치**다(결정 4 · §J). 시간 입력 칸은
 * 빈 값으로 시작하고, 사용자가 피커에서 고른 값만 저장된다 — 기본값이 그대로 저장돼
 * 없던 근무시간이 확정되던 경로를 막기 위함이다.
 * gridPrefill(주문서→공고 변환, utils/order-sheet/mappers.ts)은 **다른 맥락**에서 이 상수를
 * 공고 슬롯 시작시간 기본값으로 소비한다 — 그쪽은 이 규칙의 대상이 아니다.
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

/** 하루의 분 수 — 자정 넘김 구간 보정에 쓴다. */
const MINUTES_PER_DAY = 24 * 60;

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

/**
 * 정본 형식('HH:mm' 단일 시각)인가. 던지지 않는 판정용 — 표시·게이트 분기에 쓴다.
 * 레거시 자유 텍스트('저녁 6시')나 범위 문자열이 저장된 슬롯을 "시각이 정해진 값"으로
 * 오인하지 않게 하는 것이 주 용도다.
 */
export function isValidSlotStartTime(value: string | null | undefined): boolean {
  return typeof value === 'string' && toMinutes(value.trim()) !== null;
}

/**
 * 출근 예정 시각 검증(쓰기 경계). 정본은 **단일 시각 'HH:mm'** 이다(§K).
 *
 * 범위 문자열('18:00 - 02:00')·자유 텍스트('저녁 6시')·범위 밖 시각('25:00')을 전부 거부해
 * 폐지된 범위 저장이 다시 `time_slot` 으로 흘러드는 경로를 형식 단계에서 끊는다.
 * 인원 추가 경로(addSlotPayload)와 슬롯 편집 경로(updateSlot)가 공유하는 단일 관문.
 *
 * @throws ValidationError 형식 위반 시(작업 미수행 — fail-closed).
 */
export function assertSlotStartTime(value: string): string {
  const trimmed = value.trim();
  if (toMinutes(trimmed) === null) {
    throw new ValidationError(ERROR_CODES.VALIDATION_FORMAT, {
      field: 'timeSlot',
      userMessage: '출근 시간 형식이 올바르지 않습니다',
    });
  }
  return trimmed;
}

/**
 * timeSlot 문자열을 시작/종료 'HH:MM' 으로 분해(없으면 빈 문자열).
 *
 * 정본 형식은 단일값이라 종료는 보통 빈 문자열이다. **이미 저장된 범위 데이터를 읽기 위한
 * 하위호환**으로 남긴다(§K) — 새로 범위를 만드는 경로는 없다.
 */
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
  reason: 'overlap';
}

/**
 * timeSlot 을 분(minute) 절대구간 [start, end) 으로 환산.
 * 자정을 넘는 구간은 end 가 1440 을 초과한다(deriveOvernightPreview.durationMinutes 로 익일 반영).
 * 시작/종료 미파싱·시작==종료(0분 근무)면 구간을 만들 수 없어 null(충돌 판정 제외).
 */
/**
 * timeSlot("18:00-02:00") → 분 단위 절대 구간. 자정을 넘는 구간도 정확히 환산한다.
 * 스케줄 탭의 더블부킹 감지가 같은 판정을 공유하도록 export 한다.
 */
export function toSlotInterval(
  timeSlot: string | null | undefined
): { start: number; end: number } | null {
  const { start, end } = parseTimeSlotParts(timeSlot);
  if (!start || !end) return null;
  const startMin = toMinutes(start);
  if (startMin === null) return null;
  const preview = deriveOvernightPreview(start, end);
  if (!preview.valid || preview.durationMinutes <= 0) return null;
  return { start: startMin, end: startMin + preview.durationMinutes };
}

/**
 * 겹침 판정에 쓸 수 있는 시각인가. 미정·'NEGOTIABLE' 처럼 읽을 수 없는 값이면 false.
 * 단일값('19:00')과 레거시 범위('18:00 - 02:00') 모두 true — 형식이 아니라 가독 여부만 본다.
 */
export function hasComparableSlotTime(timeSlot: string | null | undefined): boolean {
  return Number.isFinite(parseSlotStartMinutes(timeSlot));
}

/** 분 단위 시각이 구간 [start, end) 안인가. 자정 넘김 구간(end>1440)은 +1일 보정해 한 번 더 본다. */
function isMinuteInInterval(point: number, interval: { start: number; end: number }): boolean {
  return (
    (point >= interval.start && point < interval.end) ||
    (point + MINUTES_PER_DAY >= interval.start && point + MINUTES_PER_DAY < interval.end)
  );
}

/**
 * 두 근무가 시간상 겹치는가 — **저장 형식이 섞여 있어도 한 가지 답만 낸다.**
 *
 * `time_slot` 정본은 출근 예정 시각 단일값이지만(§K), 폐지 전에 저장된 범위 데이터가 DB 에
 * 남아 있다. 그래서 세 조합을 모두 다뤄야 한다:
 * - **양쪽 다 범위**(레거시): 분 절대구간 반열림 겹침 `aStart < bEnd && bStart < aEnd`.
 *   경계가 맞닿기만 하면 겹침이 아니다.
 * - **한쪽만 범위**: 단일값은 구간이 없으니 **점이 구간 안에 있는가**로 본다.
 *   시작시각 일치만 보면 20:00 이 18:00~익일02:00 한복판인데도 놓친다.
 * - **양쪽 다 단일값**(정본): 출근 예정 시각 일치.
 * 시각을 못 읽으면(미정) 겹침 아님 — 비교할 값이 없다.
 *
 * 🔑 구인자 근무표(detectSlotConflicts)와 구직자 내 스케줄(detectScheduleOverlaps)이 **이 함수를
 * 공유해야 한다.** 한쪽만 갈래를 늘리면 같은 근무를 두고 두 화면이 다른 답을 내고, 정작
 * 곤란해지는 스태프 쪽에만 경고가 없던 옛 비대칭이 되살아난다.
 */
export function slotsOverlap(a: string | null | undefined, b: string | null | undefined): boolean {
  const aInterval = toSlotInterval(a);
  const bInterval = toSlotInterval(b);
  if (aInterval && bInterval) {
    return aInterval.start < bInterval.end && bInterval.start < aInterval.end;
  }

  const aStart = parseSlotStartMinutes(a);
  const bStart = parseSlotStartMinutes(b);
  if (aInterval) {
    return Number.isFinite(bStart) && isMinuteInInterval(bStart, aInterval);
  }
  if (bInterval) {
    return Number.isFinite(aStart) && isMinuteInInterval(aStart, bInterval);
  }
  return Number.isFinite(aStart) && Number.isFinite(bStart) && aStart === bStart;
}

/**
 * 같은 스태프의 근무가 겹치는 슬롯을 충돌로 표시(자기 자신 제외). 차단이 아닌 경고용.
 * 판정은 `slotsOverlap` 이 유일 관문이다 — 구직자 화면과 답이 갈리지 않게 하기 위함이다.
 * staffId 누락·시각 미파싱(미정)이면 충돌 없음으로 본다(기존 가드 유지).
 */
export function detectSlotConflicts(
  target: SlotConflictInput,
  siblings: readonly SlotConflictInput[]
): SlotConflict[] {
  if (!target.staffId) return [];
  return siblings
    .filter((s) => {
      if (s.workLogId === target.workLogId) return false;
      if (s.staffId !== target.staffId) return false;
      return slotsOverlap(target.timeSlot, s.timeSlot);
    })
    .map((s) => ({ workLogId: s.workLogId, reason: 'overlap' as const }));
}

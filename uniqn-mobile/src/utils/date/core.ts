import { format, isValid, parseISO } from 'date-fns';

export type DateInput = Date | string | number | null | undefined;

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// strict ISO 8601 (date + time + timezone). Date.parse가 통과시키는 loose 형식 차단.
// 달력 범위 enforce: 월 01-12, 일 01-31, 시 00-23, 분/초 00-59.
// 24:00:00 같은 silent day shift 차단 (parseISO가 다음날로 rollover하면서 work_date 쿼리 깨짐).
const STRICT_ISO_8601 =
  /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/;

export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && isValid(value);
}

function parseStrictIsoString(value: string): Date | null {
  if (!STRICT_ISO_8601.test(value)) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

function parseLenientStringDate(value: string): Date | null {
  // view layer용 lenient 파싱 — toDate() 전용
  const isoParsed = parseISO(value);
  if (isValid(isoParsed)) return isoParsed;

  if (DATE_ONLY_PATTERN.test(value)) return null;

  const parsed = new Date(value);
  return isValid(parsed) ? parsed : null;
}

// ============================================================================
// normalizeToIsoString — 모든 timestamp 입력을 ISO 8601 string으로 정규화
// ============================================================================
// 이 함수가 timestamp 정규화 진실원이다. timestampSchema(Zod throw)가 위임.
// Supabase timestamptz는 ISO string으로 주고받으므로 변환 없이 round-trip.

function isFirestoreTimestampLike(value: unknown): value is { toDate: () => Date } {
  return (
    value !== null &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  );
}

function isSecondsObject(value: unknown): value is { seconds: number; nanoseconds: number } {
  return (
    value !== null &&
    typeof value === 'object' &&
    'seconds' in value &&
    'nanoseconds' in value &&
    typeof (value as { seconds: unknown }).seconds === 'number' &&
    typeof (value as { nanoseconds: unknown }).nanoseconds === 'number'
  );
}

function isServerTimestampSentinel(value: unknown): value is { _methodName: 'serverTimestamp' } {
  return (
    value !== null &&
    typeof value === 'object' &&
    '_methodName' in value &&
    (value as { _methodName: unknown })._methodName === 'serverTimestamp'
  );
}

/**
 * 모든 timestamp 입력을 ISO 8601 string으로 정규화. 실패 시 throw.
 *
 * 지원 입력:
 *  - strict ISO 8601 string (그대로 정규화 후 통과)
 *  - Date 인스턴스 (.toISOString())
 *  - epoch milliseconds (number)
 *  - Firebase Firestore TimestampLike ({ toDate(): Date })
 *  - { seconds, nanoseconds } JSON 직렬화 형태
 *  - serverTimestamp() 센티널 ({ _methodName: 'serverTimestamp' })
 */
export function normalizeToIsoString(val: unknown): string {
  if (typeof val === 'string') {
    const parsed = parseStrictIsoString(val);
    if (parsed) return parsed.toISOString();
    throw new Error('Invalid timestamp format: not strict ISO 8601');
  }

  if (val instanceof Date) {
    if (isValidDate(val)) return val.toISOString();
    throw new Error('Invalid timestamp format: invalid Date');
  }

  if (typeof val === 'number' && Number.isFinite(val)) {
    const date = new Date(val);
    if (isValidDate(date)) return date.toISOString();
    throw new Error('Invalid timestamp format: out of range number');
  }

  if (isFirestoreTimestampLike(val)) {
    // eslint-disable-next-line no-restricted-syntax -- 레거시 TimestampLike 입력을 ISO string으로 정규화하는 진실원. 외부 호출은 ESLint가 차단.
    const date = val.toDate();
    if (isValidDate(date)) return date.toISOString();
    throw new Error('Invalid timestamp format: TimestampLike returned invalid Date');
  }

  if (isSecondsObject(val)) {
    const ms = val.seconds * 1000 + val.nanoseconds / 1_000_000;
    const date = new Date(ms);
    if (isValidDate(date)) return date.toISOString();
    throw new Error('Invalid timestamp format: invalid {seconds, nanoseconds}');
  }

  if (isServerTimestampSentinel(val)) {
    return new Date().toISOString();
  }

  throw new Error('Invalid timestamp format');
}

/**
 * Lenient string→Date 변환. 정규화 실패 시 null 반환.
 * View layer (포맷팅, 비교 등)에서 schema가 반환한 ISO string을 Date로 변환할 때 사용.
 */
export function toDate(value: DateInput | unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return isValidDate(value) ? value : null;
  if (typeof value === 'string') return parseLenientStringDate(value);
  if (typeof value === 'number') {
    const parsed = new Date(value);
    return isValidDate(parsed) ? parsed : null;
  }
  return null;
}

export function toISODateString(value: DateInput): string | null {
  const date = toDate(value);
  if (!date) return null;
  return format(date, 'yyyy-MM-dd');
}

export function getTodayString(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function toDateString(value: DateInput): string {
  return toISODateString(value) ?? '';
}

export function parseDateString(dateStr: string): Date | null {
  if (!dateStr) return null;
  return toDate(dateStr);
}

export function toDateValue(value: DateInput): number | null {
  const date = toDate(value);
  return date ? date.getTime() : null;
}

export { generateId } from '@/utils/generateId';

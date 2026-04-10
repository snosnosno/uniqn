import { format, isValid, parseISO } from 'date-fns';

export interface TimestampLike {
  toDate: () => Date;
}

export interface SerializedTimestamp {
  seconds: number;
  nanoseconds?: number;
}

export type DateInput =
  | Date
  | TimestampLike
  | SerializedTimestamp
  | number
  | string
  | null
  | undefined;

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function hasToDate(value: unknown): value is TimestampLike {
  return (
    value !== null &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as TimestampLike).toDate === 'function'
  );
}

function hasSeconds(value: unknown): value is SerializedTimestamp {
  return (
    value !== null &&
    typeof value === 'object' &&
    'seconds' in value &&
    typeof (value as SerializedTimestamp).seconds === 'number'
  );
}

function parseStringDate(value: string): Date | null {
  const isoParsed = parseISO(value);
  if (isValid(isoParsed)) {
    return isoParsed;
  }

  // Prevent invalid YYYY-MM-DD inputs from being coerced by the JS Date parser.
  if (DATE_ONLY_PATTERN.test(value)) {
    return null;
  }

  const parsed = new Date(value);
  return isValid(parsed) ? parsed : null;
}

export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && isValid(value);
}

export function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date) {
    return isValidDate(value) ? value : null;
  }

  if (typeof value === 'string') {
    return parseStringDate(value);
  }

  if (typeof value === 'number') {
    const parsed = new Date(value);
    return isValidDate(parsed) ? parsed : null;
  }

  if (hasToDate(value)) {
    return toDate(value.toDate());
  }

  if (hasSeconds(value)) {
    const parsed = new Date(value.seconds * 1000);
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

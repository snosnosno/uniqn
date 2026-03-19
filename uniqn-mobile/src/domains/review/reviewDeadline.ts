import { REVIEW_DEADLINE_DAYS } from '@/types/review';
import { toDateValue, type DateInput } from '@/utils/date';

const DAY_IN_MS = 1000 * 60 * 60 * 24;

export function getReviewBaseTime(checkOutTime: DateInput, workDate: string): number | null {
  return toDateValue(checkOutTime) ?? toDateValue(workDate);
}

export function isWithinReviewDeadline(
  checkOutTime: DateInput,
  workDate: string,
  now = Date.now()
): boolean {
  const baseTime = getReviewBaseTime(checkOutTime, workDate);

  if (baseTime === null) {
    return false;
  }

  const daysDiff = (now - baseTime) / DAY_IN_MS;
  return daysDiff >= 0 && daysDiff <= REVIEW_DEADLINE_DAYS;
}

export function getReviewDaysRemaining(
  checkOutTime: DateInput,
  workDate: string,
  now = Date.now()
): number {
  const baseTime = getReviewBaseTime(checkOutTime, workDate);

  if (baseTime === null) {
    return 0;
  }

  const diff = REVIEW_DEADLINE_DAYS - (now - baseTime) / DAY_IN_MS;
  return Math.max(0, Math.ceil(diff));
}

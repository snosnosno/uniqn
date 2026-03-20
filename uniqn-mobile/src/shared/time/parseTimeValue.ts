import { toDate } from '@/utils/date/core';
import type { TimeInput } from './types';

const TIME_ONLY_PATTERN = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

export function parseTimeValue(value: TimeInput): Date | null {
  if (typeof value === 'string' && TIME_ONLY_PATTERN.test(value)) {
    return parseTimeOnlyString(value);
  }

  return toDate(value);
}

function parseTimeOnlyString(value: string): Date | null {
  const match = value.match(TIME_ONLY_PATTERN);
  if (!match) {
    return null;
  }

  const [, hourString, minuteString, secondString] = match;
  const hours = Number(hourString);
  const minutes = Number(minuteString);
  const seconds = secondString ? Number(secondString) : 0;

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    Number.isNaN(seconds) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null;
  }

  return new Date(1970, 0, 1, hours, minutes, seconds, 0);
}

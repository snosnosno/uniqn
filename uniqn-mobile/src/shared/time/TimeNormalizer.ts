import { toDate } from '@/utils/date/core';
import type { NormalizedWorkTime, TimeFieldsInput, TimeInput } from './types';

export class TimeNormalizer {
  private static readonly TIME_ONLY_PATTERN = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

  static normalize(input: TimeFieldsInput): NormalizedWorkTime {
    const scheduledStart = this.parseTime(input.scheduledStartTime);
    const scheduledEnd = this.parseTime(input.scheduledEndTime);
    const actualStart = this.parseTime(input.checkInTime);
    const actualEnd = this.parseTime(input.checkOutTime);
    const isEstimate = actualStart === null || actualEnd === null;

    return {
      scheduledStart,
      scheduledEnd,
      actualStart,
      actualEnd,
      isEstimate,
    };
  }

  static calculateHours(normalized: NormalizedWorkTime): number {
    const { actualStart, actualEnd } = normalized;

    if (!actualStart || !actualEnd) {
      return 0;
    }

    return this.calculateDurationInHours(actualStart, actualEnd);
  }

  static calculateHoursFromScheduled(normalized: NormalizedWorkTime): number {
    const { scheduledStart, scheduledEnd } = normalized;

    if (!scheduledStart || !scheduledEnd) {
      return 0;
    }

    return this.calculateDurationInHours(scheduledStart, scheduledEnd);
  }

  static getEffectiveHours(normalized: NormalizedWorkTime): number {
    if (normalized.actualStart && normalized.actualEnd) {
      return this.calculateHours(normalized);
    }

    return this.calculateHoursFromScheduled(normalized);
  }

  static hasActualTime(normalized: NormalizedWorkTime): boolean {
    return normalized.actualStart !== null && normalized.actualEnd !== null;
  }

  static isCheckedIn(normalized: NormalizedWorkTime): boolean {
    return normalized.actualStart !== null;
  }

  static isCheckedOut(normalized: NormalizedWorkTime): boolean {
    return normalized.actualEnd !== null;
  }

  static parseTime(value: TimeInput): Date | null {
    if (typeof value === 'string') {
      if (this.TIME_ONLY_PATTERN.test(value)) {
        return this.parseTimeOnlyString(value);
      }
    }

    return toDate(value);
  }

  static calculateDurationInHours(start: Date, end: Date): number {
    const totalMinutes = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60));
    return totalMinutes / 60;
  }

  private static parseTimeOnlyString(value: string): Date | null {
    const match = value.match(this.TIME_ONLY_PATTERN);
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
}

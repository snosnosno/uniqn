import { parseTimeSlotToDate } from '@/utils/date/ranges';
import { parseTimeValue } from './parseTimeValue';
import type { NormalizedWorkTime, TimeFieldsInput, TimeInput } from './types';

export class TimeNormalizer {
  static normalize(input: TimeFieldsInput): NormalizedWorkTime {
    const parsedScheduled =
      input.timeSlot && input.date ? parseTimeSlotToDate(input.timeSlot, input.date) : null;
    const scheduledStart = parsedScheduled?.startTime ?? this.parseTime(input.startTime ?? null);
    const scheduledEnd = parsedScheduled?.endTime ?? this.parseTime(input.endTime ?? null);
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
    return parseTimeValue(value);
  }

  static calculateDurationInHours(start: Date, end: Date): number {
    const totalMinutes = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60));
    return totalMinutes / 60;
  }
}

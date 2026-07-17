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
    let diffMs = end.getTime() - start.getTime();
    // 종료가 시작보다 이르면 자정을 넘긴 것으로 보고 +24h 보정.
    // (실제 timestamptz 경로는 end>start 라 무영향 — 순수 HH:mm 경로 회귀 방어)
    if (diffMs < 0) {
      diffMs += 24 * 60 * 60 * 1000;
    }
    return Math.max(0, diffMs) / (1000 * 60 * 60);
  }
}

import { TimeNormalizer } from './TimeNormalizer';
import type { TimeInput } from './types';
import { parseTimeSlotToDate } from '@/utils/date/ranges';

export interface WorkTimeSource {
  checkInTime?: TimeInput;
  checkOutTime?: TimeInput;
  startTime?: TimeInput;
  endTime?: TimeInput;
  timeSlot?: string;
  date?: string;
}

export interface WorkTimeDisplayResult {
  checkIn: string;
  checkOut: string;
  scheduledStart: string;
  scheduledEnd: string;
  effectiveStart: string;
  effectiveEnd: string;
  isEffectiveStartActual: boolean;
  isEffectiveEndActual: boolean;
  hasActualTime: boolean;
  duration: string;
  isActualTime: boolean;
  rawTimeSlot: string | null;
  /**
   * 종료가 시작 다음날인가(심야 운영 "18:00~익일 02:00").
   * parseTimeSlotToDate 가 end<start 를 +1일로 해석해 duration 은 맞았지만 표시에서
   * "익일" 정보가 소실되던 갭(P2-3-lite)을 SSOT 결과로 노출한다.
   */
  isEndNextDay: boolean;
}

const DEFAULT_TIME_STR = '미정';
const DEFAULT_DURATION_STR = '-';

export class WorkTimeDisplay {
  static getDisplayInfo(source: WorkTimeSource): WorkTimeDisplayResult {
    const actualStart = TimeNormalizer.parseTime(source.checkInTime);
    const actualEnd = TimeNormalizer.parseTime(source.checkOutTime);

    const timeSlotStr = source.timeSlot;
    const parsedScheduled = parseTimeSlotToDate(timeSlotStr ?? null, source.date ?? '');
    const scheduledStart = parsedScheduled.startTime ?? TimeNormalizer.parseTime(source.startTime);
    const scheduledEnd = parsedScheduled.endTime ?? TimeNormalizer.parseTime(source.endTime);

    const hasActualTime = actualStart !== null || actualEnd !== null;
    const effectiveStartDate = actualStart ?? scheduledStart;
    const effectiveEndDate = actualEnd ?? scheduledEnd;

    // 종료가 시작과 다른 달력 날짜면 익일(자정 넘김). 시각 비교가 아니라 날짜 비교(E5 무관).
    const isEndNextDay =
      effectiveStartDate !== null &&
      effectiveEndDate !== null &&
      (effectiveEndDate.getFullYear() !== effectiveStartDate.getFullYear() ||
        effectiveEndDate.getMonth() !== effectiveStartDate.getMonth() ||
        effectiveEndDate.getDate() !== effectiveStartDate.getDate());

    return {
      checkIn: this.formatTimeOrDefault(actualStart),
      checkOut: this.formatTimeOrDefault(actualEnd),
      scheduledStart: this.formatTimeOrDefault(scheduledStart),
      scheduledEnd: this.formatTimeOrDefault(scheduledEnd),
      effectiveStart: this.formatTimeOrDefault(effectiveStartDate),
      effectiveEnd: this.formatTimeOrDefault(effectiveEndDate),
      isEffectiveStartActual: actualStart !== null,
      isEffectiveEndActual: actualEnd !== null,
      hasActualTime,
      duration: this.calculateDuration(effectiveStartDate, effectiveEndDate),
      isActualTime: hasActualTime,
      rawTimeSlot: timeSlotStr ?? null,
      isEndNextDay,
    };
  }

  static getActualTimeRange(source: WorkTimeSource): string | null {
    const info = this.getDisplayInfo(source);
    if (!info.hasActualTime) {
      return null;
    }

    return `${info.checkIn} - ${info.checkOut}`;
  }

  private static formatTimeOrDefault(date: Date | null): string {
    if (!date) {
      return DEFAULT_TIME_STR;
    }

    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  private static calculateDuration(start: Date | null, end: Date | null): string {
    if (!start || !end) {
      return DEFAULT_DURATION_STR;
    }

    let diffMs = end.getTime() - start.getTime();
    if (diffMs < 0) {
      diffMs += 24 * 60 * 60 * 1000;
    }

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0 && minutes > 0) {
      return `${hours}시간 ${minutes}분`;
    }
    if (hours > 0) {
      return `${hours}시간`;
    }
    if (minutes > 0) {
      return `${minutes}분`;
    }

    return DEFAULT_DURATION_STR;
  }
}

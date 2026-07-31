import { TimeNormalizer } from './TimeNormalizer';
import type { TimeInput } from './types';
import { parseTimeSlotToDate } from '@/utils/date/ranges';
import { FIXED_TIME_MARKER } from '@/types/assignment';

/**
 * 출근 예정 시각이 어떤 상태인가 — 셋은 서로 다른 사실이고 다른 문장을 받아야 한다.
 *
 * - `confirmed`  : 예정 시각이 정해져 있다
 * - `undecided`  : 아직 안 정해졌다 (time_slot 미기록). 구인자가 '미정'을 명시 선택했거나
 *                  아직 손대지 않은 레거시 배치. 스태프에게는 둘 다 "아직 모른다"로 동일하다
 * - `negotiable` : 고정공고의 협의 근무(`'NEGOTIABLE'`). 애초에 정해질 값이 아니다
 *
 * 예전엔 `undecided` 와 `negotiable` 이 똑같이 "시간 협의"로 표시됐다. 시간이 안 정해진 것을
 * "협의하기로 했다"고 말하는 건 거짓말이라, 스태프가 물어볼 곳조차 잃는다.
 */
export type ScheduleTimeState = 'confirmed' | 'undecided' | 'negotiable';

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
  /** 예정 시각이 확정인지·미정인지·협의인지. 표시 문장을 가르는 단일 근거. */
  scheduleTimeState: ScheduleTimeState;
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
      // 협의 판정이 먼저다 — 'NEGOTIABLE' 은 시각으로 파싱되지 않아서 미정과 구분이 안 된다.
      // 그 다음은 레거시 startTime 폴백까지 반영된 scheduledStart 로 본다.
      scheduleTimeState:
        timeSlotStr === FIXED_TIME_MARKER
          ? 'negotiable'
          : scheduledStart !== null
            ? 'confirmed'
            : 'undecided',
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

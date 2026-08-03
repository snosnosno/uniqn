import { TimeNormalizer } from './TimeNormalizer';
import type { TimeInput } from './types';
import { parseTimeSlotToDate } from '@/utils/date/ranges';

/**
 * 출근 예정 시각이 어떤 상태인가 — 스태프에게 남는 사실은 둘뿐이다.
 *
 * - `confirmed` : 예정 시각이 정해져 있다
 * - `undecided` : 아직 안 정해졌다. 구인자가 '미정'을 명시 선택했든, 고정공고의 협의 근무든,
 *                 아직 손대지 않은 레거시 배치든 — 스태프 입장에선 전부 "아직 모른다"이다
 *
 * ⚠️ 예전엔 `negotiable`(고정공고 `'NEGOTIABLE'`)을 셋째 상태로 두고 "시간 협의"로 표시했다.
 *    D4(2026-08-03 사용자 확정)로 **구분 표시를 포기**했다 — 근거는 두 가지다:
 *    ① 스태프가 취할 행동이 같다(기다린다). ② 구분의 유일한 근거가 센티널 문자열 비교뿐이라
 *      공고 종류가 이 함수 입력에 없었다 — "공고 유형에서 유도"할 배선 자체가 없었다.
 *    "협의"라는 말은 **공고(광고) 표면**에 남는다(`postingSurfaceModel`) — 거긴 공고 유형과
 *    `isStartTimeNegotiable` 플래그를 실제로 알고 있다.
 */
export type ScheduleTimeState = 'confirmed' | 'undecided';

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
      // 레거시 startTime 폴백까지 반영된 scheduledStart 로 본다 — 센티널('미정'·'NEGOTIABLE')은
      // 애초에 시각으로 파싱되지 않아 여기서 자연히 undecided 로 떨어진다.
      scheduleTimeState: scheduledStart !== null ? 'confirmed' : 'undecided',
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

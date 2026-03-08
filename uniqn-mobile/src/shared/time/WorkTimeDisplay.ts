/**
 * WorkTimeDisplay - 근무 시간 표시 통합 유틸리티
 *
 * @description 구인자/직원 화면 간 시간 표시 일관성 확보
 * @version 2.0.0
 *
 * 표시 우선순위:
 * 1. 실제 시간 (checkInTime/checkOutTime)
 * 2. timeSlot 파싱 (예정 시간)
 * 3. '미정' 표시
 *
 * NOTE: scheduledStartTime/scheduledEndTime은 deprecated (유령 필드).
 *       예정 시간은 timeSlot 문자열 파싱으로 통합.
 */

import { TimeNormalizer } from './TimeNormalizer';
import type { TimeInput } from './types';
import { parseTimeSlotToDate } from '@/utils/date/ranges';

// ============================================================================
// Types
// ============================================================================

/**
 * 시간 표시에 필요한 입력 데이터
 */
export interface WorkTimeSource {
  /** 실제 출근 시간 (QR 스캔 또는 관리자 수정) */
  checkInTime?: TimeInput;
  /** 실제 퇴근 시간 (QR 스캔 또는 관리자 수정) */
  checkOutTime?: TimeInput;
  /** @deprecated startTime은 scheduledStartTime의 alias. timeSlot 사용 권장 */
  startTime?: TimeInput;
  /** @deprecated endTime은 scheduledEndTime의 alias. timeSlot 사용 권장 */
  endTime?: TimeInput;
  /** @deprecated checkInTime과 동일값. 향후 제거 예정 */
  scheduledStartTime?: TimeInput;
  /** @deprecated checkOutTime과 동일값. 향후 제거 예정 */
  scheduledEndTime?: TimeInput;
  /** 시간대 문자열 (예: "18:00~02:00") - 예정 시간의 단일 진실 소스 */
  timeSlot?: string;
  /** 날짜 (YYYY-MM-DD) - timeSlot 파싱에 필요 */
  date?: string;
  /** JobPostingCard (rawTimeSlot 참조용) */
  jobPostingCard?: {
    timeSlot?: string;
  };
}

/**
 * 시간 표시 결과
 */
export interface WorkTimeDisplayResult {
  /** 실제 출근 시간 (HH:mm) 또는 '미정' */
  checkIn: string;
  /** 실제 퇴근 시간 (HH:mm) 또는 '미정' */
  checkOut: string;
  /** 예정 출근 시간 (HH:mm) 또는 '미정' - timeSlot 파싱 기반 */
  scheduledStart: string;
  /** 예정 퇴근 시간 (HH:mm) 또는 '미정' - timeSlot 파싱 기반 */
  scheduledEnd: string;
  /** 통합 표시용 시작 시간 (실제 > timeSlot 파싱 > '미정') */
  effectiveStart: string;
  /** 통합 표시용 종료 시간 (실제 > timeSlot 파싱 > '미정') */
  effectiveEnd: string;
  /** effectiveStart가 실제 시간인지 여부 (라벨 결정용: true → '출근', false → '예정') */
  isEffectiveStartActual: boolean;
  /** effectiveEnd가 실제 시간인지 여부 (라벨 결정용: true → '퇴근', false → '예정') */
  isEffectiveEndActual: boolean;
  /** 실제 출퇴근 기록 유무 */
  hasActualTime: boolean;
  /** 근무 시간 (X시간 X분) 또는 '-' */
  duration: string;
  /** @deprecated hasActualTime 사용. 동일한 값 */
  isActualTime: boolean;
  /** 원본 timeSlot 문자열 (참조용) */
  rawTimeSlot: string | null;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_TIME_STR = '미정';
const DEFAULT_DURATION_STR = '-';

// ============================================================================
// WorkTimeDisplay Class
// ============================================================================

/**
 * 근무 시간 표시 유틸리티 클래스
 *
 * @example
 * const info = WorkTimeDisplay.getDisplayInfo(schedule);
 * console.log(info.checkIn);        // '09:05' 또는 '미정'
 * console.log(info.scheduledStart); // '09:00' 또는 '미정'
 * console.log(info.duration);       // '8시간 30분'
 */
export class WorkTimeDisplay {
  /**
   * 통합 시간 표시 정보 생성
   *
   * @param source 시간 필드를 가진 객체 (ScheduleEvent, ConfirmedStaff, WorkLog 등)
   * @returns 표시용 시간 정보
   */
  static getDisplayInfo(source: WorkTimeSource): WorkTimeDisplayResult {
    // 1. 실제 시간 파싱
    const actualStart = TimeNormalizer.parseTime(source.checkInTime);
    const actualEnd = TimeNormalizer.parseTime(source.checkOutTime);

    // 2. 예정 시간 파싱 (timeSlot 파싱 우선, legacy 필드 폴백)
    const timeSlotStr = source.timeSlot || source.jobPostingCard?.timeSlot;
    const timeSlotParsed = parseTimeSlotToDate(timeSlotStr ?? null, source.date ?? '');
    const scheduledStart =
      timeSlotParsed.startTime ??
      TimeNormalizer.parseTime(source.startTime) ??
      TimeNormalizer.parseTime(source.scheduledStartTime);
    const scheduledEnd =
      timeSlotParsed.endTime ??
      TimeNormalizer.parseTime(source.endTime) ??
      TimeNormalizer.parseTime(source.scheduledEndTime);

    // 3. 실제 시간 유무 확인
    const hasActualTime = actualStart !== null || actualEnd !== null;

    // 4. 통합 표시 시간 (실제 > 예정 > '미정')
    const effectiveStartDate = actualStart ?? scheduledStart;
    const effectiveEndDate = actualEnd ?? scheduledEnd;

    // 5. 근무 시간 계산 (effective 시간 기반)
    const duration = this.calculateDuration(effectiveStartDate, effectiveEndDate);

    // 6. 예정 시간 문자열 결정
    const scheduledStartStr = this.formatTimeOrDefault(scheduledStart);
    const scheduledEndStr = this.formatTimeOrDefault(scheduledEnd);

    return {
      checkIn: this.formatTimeOrDefault(actualStart),
      checkOut: this.formatTimeOrDefault(actualEnd),
      scheduledStart: scheduledStartStr,
      scheduledEnd: scheduledEndStr,
      effectiveStart: this.formatTimeOrDefault(effectiveStartDate),
      effectiveEnd: this.formatTimeOrDefault(effectiveEndDate),
      isEffectiveStartActual: actualStart !== null,
      isEffectiveEndActual: actualEnd !== null,
      hasActualTime,
      duration,
      isActualTime: hasActualTime,
      rawTimeSlot: timeSlotStr ?? null,
    };
  }

  /**
   * 실제 시간 범위 문자열 (있는 경우에만)
   *
   * @param source 시간 필드를 가진 객체
   * @returns "HH:mm - HH:mm" 또는 null
   */
  static getActualTimeRange(source: WorkTimeSource): string | null {
    const info = this.getDisplayInfo(source);
    if (!info.hasActualTime) return null;
    return `${info.checkIn} - ${info.checkOut}`;
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Date를 HH:mm 형식 문자열로 변환, null이면 기본값 반환
   */
  private static formatTimeOrDefault(date: Date | null): string {
    if (!date) return DEFAULT_TIME_STR;
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }

  /**
   * 두 시간 사이의 근무 시간 계산
   *
   * @returns "X시간 X분" 형식 문자열 또는 '-'
   */
  private static calculateDuration(start: Date | null, end: Date | null): string {
    if (!start || !end) return DEFAULT_DURATION_STR;

    let diffMs = end.getTime() - start.getTime();

    // 자정 넘김 처리 (음수면 하루 더함)
    if (diffMs < 0) {
      diffMs += 24 * 60 * 60 * 1000;
    }

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0 && minutes > 0) return `${hours}시간 ${minutes}분`;
    if (hours > 0) return `${hours}시간`;
    if (minutes > 0) return `${minutes}분`;
    return DEFAULT_DURATION_STR;
  }
}

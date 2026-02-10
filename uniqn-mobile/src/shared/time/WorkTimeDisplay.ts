/**
 * WorkTimeDisplay - 근무 시간 표시 통합 유틸리티
 *
 * @description 구인자/직원 화면 간 시간 표시 일관성 확보
 * @version 1.1.0
 *
 * 표시 우선순위:
 * 1. 실제 시간 (checkInTime/checkOutTime)
 * 2. 예정 시간 (startTime/endTime 또는 scheduledStartTime/scheduledEndTime)
 * 3. '미정' 표시
 *
 * NOTE: timeSlot 폴백은 사용하지 않음 (checkInTime이 null이면 "미정" 표시)
 */

import { TimeNormalizer } from './TimeNormalizer';
import type { TimeInput } from './types';
import { STATUS } from '@/constants';

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
  /** 예정 시작 시간 (공고에서 설정) */
  startTime?: TimeInput;
  /** 예정 종료 시간 (공고에서 설정) */
  endTime?: TimeInput;
  /** 예정 시작 시간 (WorkLog에서 사용) */
  scheduledStartTime?: TimeInput;
  /** 예정 종료 시간 (WorkLog에서 사용) */
  scheduledEndTime?: TimeInput;
  /** 시간대 문자열 (예: "18:00~02:00") - rawTimeSlot 결과에 전달용 */
  timeSlot?: string;
  /** 날짜 */
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
  /** 예정 출근 시간 (HH:mm) 또는 '미정' */
  scheduledStart: string;
  /** 예정 퇴근 시간 (HH:mm) 또는 '미정' */
  scheduledEnd: string;
  /** 실제 출퇴근 기록 유무 */
  hasActualTime: boolean;
  /** 근무 시간 (X시간 X분) 또는 '-' */
  duration: string;
  /** 실제 시간 사용 여부 (출근/퇴근 둘 중 하나라도 있으면 true) */
  isActualTime: boolean;
  /** 원본 timeSlot 문자열 (참조용, 폴백에 사용되지 않음) */
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

    // 2. 예정 시간 파싱 (startTime 우선, scheduledStartTime 폴백, timeSlot 폴백 없음)
    const scheduledStart =
      TimeNormalizer.parseTime(source.startTime) ??
      TimeNormalizer.parseTime(source.scheduledStartTime);
    const scheduledEnd =
      TimeNormalizer.parseTime(source.endTime) ?? TimeNormalizer.parseTime(source.scheduledEndTime);

    // 3. 실제 시간 유무 확인
    const hasActualTime = actualStart !== null || actualEnd !== null;

    // 4. 근무 시간 계산 (실제 시간 우선, 없으면 예정 시간)
    const duration = this.calculateDuration(
      actualStart ?? scheduledStart,
      actualEnd ?? scheduledEnd
    );

    // 5. 예정 시간 문자열 결정
    const scheduledStartStr = this.formatTimeOrDefault(scheduledStart);
    const scheduledEndStr = this.formatTimeOrDefault(scheduledEnd);

    return {
      checkIn: this.formatTimeOrDefault(actualStart),
      checkOut: this.formatTimeOrDefault(actualEnd),
      scheduledStart: scheduledStartStr,
      scheduledEnd: scheduledEndStr,
      hasActualTime,
      duration,
      isActualTime: hasActualTime,
      rawTimeSlot: (source.timeSlot || source.jobPostingCard?.timeSlot) ?? null,
    };
  }

  /**
   * 상태에 따른 시간 범위 표시
   *
   * @param source 시간 필드를 가진 객체
   * @param status 스케줄 상태 ('applied' | 'confirmed' | 'completed' | 'cancelled' | 'scheduled')
   * @returns "HH:mm - HH:mm" 형식 문자열
   *
   * @example
   * // completed 상태: 실제 시간 반환
   * WorkTimeDisplay.getTimeRangeForStatus(schedule, 'completed')
   * // => "09:05 - 18:30"
   *
   * // confirmed 상태: 예정 시간 반환
   * WorkTimeDisplay.getTimeRangeForStatus(schedule, 'confirmed')
   * // => "09:00 - 18:00"
   */
  static getTimeRangeForStatus(
    source: WorkTimeSource,
    status: 'applied' | 'confirmed' | 'completed' | 'cancelled' | 'scheduled'
  ): string {
    const info = this.getDisplayInfo(source);

    // completed 상태이고 실제 시간이 있으면 실제 시간 반환
    if (status === STATUS.WORK_LOG.COMPLETED && info.hasActualTime) {
      return `${info.checkIn} - ${info.checkOut}`;
    }

    // 그 외: 예정 시간 반환
    return `${info.scheduledStart} - ${info.scheduledEnd}`;
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

  /**
   * 예정 시간 범위 문자열
   *
   * @param source 시간 필드를 가진 객체
   * @returns "HH:mm - HH:mm" 형식 문자열
   */
  static getScheduledTimeRange(source: WorkTimeSource): string {
    const info = this.getDisplayInfo(source);
    return `${info.scheduledStart} - ${info.scheduledEnd}`;
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

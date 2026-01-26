/**
 * TimeNormalizer - 시간 필드 정규화 클래스
 *
 * @description Phase 3 - 시간 필드 정규화
 * checkInTime/checkOutTime을 통일된 인터페이스로 정규화
 */

import type { Timestamp } from 'firebase/firestore';
import type { NormalizedWorkTime, TimeFieldsInput } from './types';

/**
 * TimeNormalizer 클래스
 *
 * @description 모든 시간 관련 정규화 및 계산 로직을 중앙 집중화
 * - checkInTime/checkOutTime: 실제 출퇴근 시간
 * - scheduledStartTime/scheduledEndTime: 예정 시간
 * - 근무 시간 계산
 */
export class TimeNormalizer {
  // ===========================================================================
  // 시간 필드 정규화
  // ===========================================================================

  /**
   * 다양한 시간 필드를 NormalizedWorkTime으로 정규화
   *
   * @description checkInTime/checkOutTime만 사용 (통합됨)
   *
   * @param input 시간 필드를 가진 객체 (WorkLog, ConfirmedStaff 등)
   * @returns 정규화된 근무 시간
   */
  static normalize(input: TimeFieldsInput): NormalizedWorkTime {
    // 예정 시간 정규화
    const scheduledStart = this.parseTime(input.scheduledStartTime);
    const scheduledEnd = this.parseTime(input.scheduledEndTime);

    // 실제 시간 정규화 (checkInTime/checkOutTime 사용)
    const actualStart = this.parseTime(input.checkInTime);
    const actualEnd = this.parseTime(input.checkOutTime);

    // 예상 금액 여부: 실제 시간이 없으면 true
    const isEstimate = actualStart === null || actualEnd === null;

    return {
      scheduledStart,
      scheduledEnd,
      actualStart,
      actualEnd,
      isEstimate,
    };
  }

  // ===========================================================================
  // 근무 시간 계산
  // ===========================================================================

  /**
   * 실제 출퇴근 시간으로 근무 시간 계산
   *
   * @param normalized 정규화된 근무 시간
   * @returns 근무 시간 (시간 단위, 소수점 포함)
   */
  static calculateHours(normalized: NormalizedWorkTime): number {
    const { actualStart, actualEnd } = normalized;

    if (!actualStart || !actualEnd) {
      return 0;
    }

    return this.calculateDurationInHours(actualStart, actualEnd);
  }

  /**
   * 예정 시간으로 근무 시간 계산
   *
   * @param normalized 정규화된 근무 시간
   * @returns 예정 근무 시간 (시간 단위, 소수점 포함)
   */
  static calculateHoursFromScheduled(normalized: NormalizedWorkTime): number {
    const { scheduledStart, scheduledEnd } = normalized;

    if (!scheduledStart || !scheduledEnd) {
      return 0;
    }

    return this.calculateDurationInHours(scheduledStart, scheduledEnd);
  }

  /**
   * 유효한 근무 시간 계산 (실제 시간 우선, 없으면 예정 시간)
   *
   * @param normalized 정규화된 근무 시간
   * @returns 근무 시간 (시간 단위)
   */
  static getEffectiveHours(normalized: NormalizedWorkTime): number {
    // 실제 시간이 있으면 사용
    if (normalized.actualStart && normalized.actualEnd) {
      return this.calculateHours(normalized);
    }

    // 없으면 예정 시간 사용
    return this.calculateHoursFromScheduled(normalized);
  }

  // ===========================================================================
  // 상태 확인 헬퍼
  // ===========================================================================

  /**
   * 실제 출퇴근 시간이 모두 있는지 확인
   */
  static hasActualTime(normalized: NormalizedWorkTime): boolean {
    return normalized.actualStart !== null && normalized.actualEnd !== null;
  }

  /**
   * 출근 여부 확인
   */
  static isCheckedIn(normalized: NormalizedWorkTime): boolean {
    return normalized.actualStart !== null;
  }

  /**
   * 퇴근 여부 확인
   */
  static isCheckedOut(normalized: NormalizedWorkTime): boolean {
    return normalized.actualEnd !== null;
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * 다양한 형식의 시간을 Date로 변환
   *
   * @param value Timestamp, Date, string, null, undefined
   * @returns Date 또는 null
   */
  private static parseTime(
    value: Timestamp | Date | string | null | undefined
  ): Date | null {
    if (!value) {
      return null;
    }

    // Date 객체
    if (value instanceof Date) {
      return value;
    }

    // Firebase Timestamp
    if (
      typeof value === 'object' &&
      'toDate' in value &&
      typeof value.toDate === 'function'
    ) {
      return value.toDate();
    }

    // 문자열
    if (typeof value === 'string') {
      const parsed = new Date(value);
      return isNaN(parsed.getTime()) ? null : parsed;
    }

    return null;
  }

  /**
   * 두 시간 사이의 시간 차이 계산 (시간 단위)
   *
   * @param start 시작 시간
   * @param end 종료 시간
   * @returns 시간 차이 (시간 단위, 소수점 포함)
   */
  private static calculateDurationInHours(start: Date, end: Date): number {
    const totalMinutes = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60));
    return totalMinutes / 60;
  }
}

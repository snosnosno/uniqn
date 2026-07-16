/**
 * WorkLogCreator - 근무 기록 생성 통합 클래스
 *
 * @description Phase 5 - 확정 트랜잭션 WorkLog 생성 로직 분리
 * Application 확정 시 Assignment별 WorkLog 생성 로직 캡슐화
 *
 * 주요 기능:
 * 1. Assignment에서 WorkLog 데이터 생성
 * 2. 시간 파싱 및 Timestamp 변환
 * 3. 트랜잭션 내 배치 생성 지원
 */

import { parseTimeSlotToDate } from '@/utils/date';

// ============================================================================
// Types
// ============================================================================

/** 시간 슬롯 정보 */
export interface TimeSlotInfo {
  /** 시작 시간 (HH:mm) */
  startTime: string | null;
  /** 종료 시간 (HH:mm) */
  endTime: string | null;
  /** 원본 timeSlot 문자열 */
  original: string;
}

// ============================================================================
// WorkLogCreator Class
// ============================================================================

export class WorkLogCreator {
  // ==========================================================================
  // 시간 파싱 유틸리티
  // ==========================================================================

  /**
   * timeSlot 문자열에서 시작/종료 시간 추출
   *
   * @description 다양한 형식 지원:
   * - "09:00" → { startTime: "09:00", endTime: null }
   * - "09:00~18:00" → { startTime: "09:00", endTime: "18:00" }
   * - "09:00 - 18:00" → { startTime: "09:00", endTime: "18:00" }
   *
   * @param timeSlot - 시간 슬롯 문자열
   * @returns TimeSlotInfo 객체
   */
  static parseTimeSlot(timeSlot: string): TimeSlotInfo {
    if (!timeSlot) {
      return { startTime: null, endTime: null, original: '' };
    }

    const trimmed = timeSlot.trim();

    // "~" 또는 " - " 로 분리
    const separators = /[-~]/;
    const parts = trimmed
      .split(separators)
      .map((p) => p.trim())
      .filter(Boolean);

    return {
      startTime: parts[0] || null,
      endTime: parts[1] || null,
      original: trimmed,
    };
  }

  /**
   * 시작 시간만 추출
   *
   * @param timeSlot - 시간 슬롯 문자열
   * @returns 시작 시간 (HH:mm) 또는 빈 문자열
   */
  static extractStartTime(timeSlot: string): string {
    const { startTime } = this.parseTimeSlot(timeSlot);
    return startTime ?? '';
  }

  /**
   * 날짜와 시간 문자열을 Date로 변환
   *
   * @param date - 날짜 (YYYY-MM-DD)
   * @param time - 시간 (HH:mm)
   * @returns Date 또는 null (파싱 실패 시)
   */
  static createTimestampFromDateTime(date: string, time: string): Date | null {
    if (!date || !time) return null;

    // 시간 형식 검증 (HH:mm 또는 H:mm)
    const timeMatch = time.match(/^(\d{1,2}):(\d{2})$/);
    if (!timeMatch) return null;

    const hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

    try {
      // HH:mm 형식으로 패딩
      const paddedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      const { startTime } = parseTimeSlotToDate(paddedTime, date);

      return startTime ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Assignment 개수 계산 (정원 확인용)
   *
   * @param assignments - Assignment 배열
   * @returns 총 날짜 개수 (= 생성될 WorkLog 수)
   */
  static countAssignments(assignments: { dates: string[] }[]): number {
    return assignments.reduce((sum, a) => sum + a.dates.length, 0);
  }
}

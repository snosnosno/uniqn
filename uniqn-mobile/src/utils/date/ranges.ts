/**
 * 날짜 범위 유틸리티
 *
 * @description 날짜 범위 생성 및 계산 함수들
 * @version 1.0.0
 */

import { format, addDays } from 'date-fns';
import { toISODateString } from './core';

/**
 * 날짜 범위 생성 (YYYY-MM-DD 배열)
 */
export function getDateRange(start: Date, end: Date): string[] {
  const dates: string[] = [];
  let current = new Date(start);

  while (current <= end) {
    dates.push(format(current, 'yyyy-MM-dd'));
    current = addDays(current, 1);
  }

  return dates;
}

/**
 * 시작일부터 종료일까지의 모든 날짜 배열 반환 (문자열 버전)
 */
export function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const isoString = toISODateString(date);
    if (isoString) {
      dates.push(isoString);
    }
  }

  return dates;
}

/**
 * 이번 달 시작/끝 날짜
 */
export function getMonthRange(
  date: Date = new Date()
): {
  start: string;
  end: string;
} {
  const year = date.getFullYear();
  const month = date.getMonth();

  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);

  return {
    start: format(start, 'yyyy-MM-dd'),
    end: format(end, 'yyyy-MM-dd'),
  };
}

/**
 * 날짜 정렬 (오름차순)
 */
export function sortDates(dates: string[]): string[] {
  return [...dates].sort();
}

/**
 * 근무 시간 문자열 파싱
 *
 * @description 다양한 형식 지원:
 * - "09:00" → { start: "09:00", end: null }
 * - "09:00~18:00" → { start: "09:00", end: "18:00" }
 * - "09:00 - 18:00" → { start: "09:00", end: "18:00" }
 *
 * @param timeSlot - 시간 슬롯 문자열
 * @returns { start, end } 또는 null (파싱 실패)
 */
export function parseTimeSlot(
  timeSlot: string
): {
  start: string;
  end: string | null;
} | null {
  // 시작-종료 형식 먼저 시도 (예: "14:00~22:00", "09:00 - 18:00")
  const fullMatch = timeSlot.match(/(\d{1,2}:\d{2})\s*[-~]\s*(\d{1,2}:\d{2})/);
  if (fullMatch) {
    return { start: fullMatch[1], end: fullMatch[2] };
  }

  // 시작 시간만 있는 형식 (예: "19:00")
  const startOnlyMatch = timeSlot.match(/^(\d{1,2}:\d{2})$/);
  if (startOnlyMatch) {
    return { start: startOnlyMatch[1], end: null };
  }

  return null;
}

/**
 * timeSlot 문자열에서 시작/종료 시간을 Date 객체로 추출
 *
 * @description 단일 시간 형식도 지원:
 * - "09:00-18:00" → { startTime: Date, endTime: Date }
 * - "19:00" → { startTime: Date, endTime: null }
 *
 * @param timeSlot "09:00-18:00", "09:00 - 18:00", 또는 "19:00" 형식
 * @param dateStr 날짜 (YYYY-MM-DD)
 * @returns { startTime: Date | null, endTime: Date | null }
 */
export function parseTimeSlotToDate(
  timeSlot: string | null | undefined,
  dateStr: string
): { startTime: Date | null; endTime: Date | null } {
  if (!timeSlot || !dateStr) return { startTime: null, endTime: null };

  const parsed = parseTimeSlot(timeSlot);
  if (!parsed) return { startTime: null, endTime: null };

  const startTime = new Date(`${dateStr}T${parsed.start}:00`);

  // 유효하지 않은 시작 시간 체크
  if (isNaN(startTime.getTime())) return { startTime: null, endTime: null };

  // 종료 시간이 null이면 endTime도 null (단일 시간 형식)
  if (!parsed.end) {
    return { startTime, endTime: null };
  }

  let endTime = new Date(`${dateStr}T${parsed.end}:00`);

  // 자정을 넘어가는 경우 (예: 18:00-02:00)
  if (endTime < startTime) {
    endTime = addDays(endTime, 1);
  }

  // 유효하지 않은 종료 시간 체크
  if (isNaN(endTime.getTime())) return { startTime, endTime: null };

  return { startTime, endTime };
}

/**
 * 근무 시간 계산 (분 단위)
 */
export function calculateWorkDuration(startTime: string, endTime: string): number {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  const startMinutes = startHour * 60 + startMin;
  let endMinutes = endHour * 60 + endMin;

  // 자정을 넘어가는 경우
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }

  return endMinutes - startMinutes;
}

/**
 * 분을 시간:분 형식으로 변환
 */
export function minutesToHoursMinutes(
  minutes: number
): {
  hours: number;
  minutes: number;
  display: string;
} {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  return {
    hours,
    minutes: mins,
    display: mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`,
  };
}

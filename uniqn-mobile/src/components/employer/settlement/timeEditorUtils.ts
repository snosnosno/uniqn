/**
 * UNIQN Mobile - 근무 시간 편집 유틸리티
 *
 * @description WorkTimeEditor에서 사용하는 시간 파싱/포맷팅/계산 헬퍼 함수
 * @version 1.0.0
 */

import { TimeNormalizer, type TimeInput } from '@/shared/time';

// ============================================================================
// Time Parsing
// ============================================================================

/**
 * TimeInput을 Date로 변환 (null일 경우 현재 시간 반환)
 */
export function parseTimestamp(value: TimeInput): Date {
  return TimeNormalizer.parseTime(value) ?? new Date();
}

/**
 * "HH:MM" 형식 문자열을 Date로 파싱
 * 0-47시까지 허용 (24시 이상은 다음날)
 */
export function parseTimeInput(timeStr: string, baseDate: Date): Date | null {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  if (hours < 0 || hours > 47 || minutes < 0 || minutes > 59) return null;

  const result = new Date(baseDate);

  if (hours >= 24) {
    // 24시 이상이면 다음날로 설정
    result.setDate(result.getDate() + 1);
    result.setHours(hours - 24, minutes, 0, 0);
  } else {
    result.setHours(hours, minutes, 0, 0);
  }

  return result;
}

// ============================================================================
// Time Formatting
// ============================================================================

/**
 * Date를 "HH:MM" 형식 문자열로 변환
 */
export function formatTimeForInput(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * 퇴근 시간을 24+ 형식으로 변환 (다음날인 경우)
 */
export function formatEndTimeForInput(endDate: Date, baseDate: Date): string {
  const baseDateOnly = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
  const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

  // 퇴근 날짜가 기준 날짜보다 하루 뒤면 24+ 형식
  const dayDiff = Math.round(
    (endDateOnly.getTime() - baseDateOnly.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (dayDiff === 1) {
    const hours = (endDate.getHours() + 24).toString().padStart(2, '0');
    const minutes = endDate.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  return formatTimeForInput(endDate);
}

// ============================================================================
// Time Calculation
// ============================================================================

/**
 * 출근/퇴근 시간 간 근무 시간 계산
 */
export function calculateDuration(start: Date, end: Date): string {
  const diffMs = end.getTime() - start.getTime();

  // 퇴근이 출근보다 빠르면 계산 불가
  if (diffMs <= 0) {
    return '시간 오류';
  }

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours === 0) return `${minutes}분`;
  if (minutes === 0) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
}

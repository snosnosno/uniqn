/**
 * UNIQN Mobile - ScheduleCard 시간 헬퍼
 *
 * @description 시간 포맷팅 관련 유틸리티
 * @version 1.1.0 - TimeNormalizer 통합
 */

import { TimeNormalizer, type TimeInput } from '@/shared/time';

/**
 * TimeInput을 HH:mm 형식으로 포맷
 */
export function formatTime(value: TimeInput): string {
  const date = TimeNormalizer.parseTime(value);
  if (!date) return '--:--';
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * 시작/종료 시간 범위 포맷
 */
export function formatTimeRange(start: TimeInput, end: TimeInput): string {
  return `${formatTime(start)} - ${formatTime(end)}`;
}

/**
 * 근무 시간 계산 (자정 넘기 처리 포함)
 */
export function calculateDuration(start: TimeInput, end: TimeInput): string {
  const startDate = TimeNormalizer.parseTime(start);
  const endDate = TimeNormalizer.parseTime(end);

  if (!startDate || !endDate) return '-';

  let diffMs = endDate.getTime() - startDate.getTime();

  // 자정을 넘어가는 경우 (예: 18:00 ~ 02:00)
  if (diffMs < 0) {
    diffMs += 24 * 60 * 60 * 1000;
  }

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0 && minutes > 0) return `${hours}시간 ${minutes}분`;
  if (hours > 0) return `${hours}시간`;
  return `${minutes}분`;
}

/**
 * 날짜 문자열을 M/D(요일) 형식으로 포맷
 */
export function formatDate(dateString: string): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
  return `${month}/${day}(${dayOfWeek})`;
}

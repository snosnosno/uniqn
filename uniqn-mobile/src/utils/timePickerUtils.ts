/**
 * UNIQN Mobile - 시간 피커 공유 유틸리티
 *
 * @description TimeWheelPicker의 웹/네이티브 구현에서 공유하는 배열 생성 로직
 * @version 1.0.0
 */

/** 시간 배열 생성 (minHour ~ maxHour) */
export function generateHours(minHour: number, maxHour: number): number[] {
  return Array.from({ length: maxHour - minHour + 1 }, (_, i) => minHour + i);
}

/** 분 배열 생성 (0부터 interval 단위) */
export function generateMinutes(interval: number): number[] {
  return Array.from({ length: 60 / interval }, (_, i) => i * interval);
}

/** 분 값을 interval에 맞게 정규화 */
export function normalizeMinute(minute: number, interval: number): number {
  return Math.round(minute / interval) * interval;
}

/** 시간 표시 포맷 (24시 이상은 다음날 표시) */
export function formatHourLabel(hour: number): string {
  if (hour >= 24) {
    return `다음날 ${(hour - 24).toString().padStart(2, '0')}`;
  }
  return hour.toString().padStart(2, '0');
}

/**
 * 기간(duration) 포맷 — impeccable v2 §19
 *
 * "N시간 M분" 한글 표기. 0 처리 포함.
 * `src/utils/settlement/formatters.formatDuration` 의 canonical 위치.
 */

/**
 * 소수 시간값을 "N시간 M분" 으로 포맷. 분은 반올림.
 * - 0 → "0분"
 * - 3.5 → "3시간 30분"
 * - 0.25 → "15분"
 * - 2 → "2시간"
 */
export function formatDuration(hours: number | null | undefined): string {
  if (hours === null || hours === undefined || Number.isNaN(hours)) return '0분';
  if (hours === 0) return '0분';

  const sign = hours < 0 ? '-' : '';
  const absHours = Math.abs(hours);
  const h = Math.floor(absHours);
  const m = Math.round((absHours - h) * 60);

  if (h === 0) return `${sign}${m}분`;
  if (m === 0) return `${sign}${h}시간`;
  return `${sign}${h}시간 ${m}분`;
}

/**
 * 분(minutes) 정수값을 "N시간 M분" 으로 포맷.
 * TextInput 등 분 단위 raw 값을 다룰 때 사용.
 */
export function formatDurationFromMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) return '0분';
  return formatDuration(minutes / 60);
}

/**
 * UNIQN Mobile - 정산 포맷팅 유틸리티
 */

import type { SalaryType } from '@/types/jobPosting';
import { SALARY_TYPE_LABELS } from './constants';

/**
 * 금액을 한국 원화 형식으로 포맷
 */
export function formatCurrency(amount: number): string {
  return amount.toLocaleString('ko-KR') + '원';
}

/**
 * 근무 시간을 시간/분 형식으로 포맷.
 *
 * impeccable v2 §19 에 따라 canonical 구현(`@/utils/formatters`)으로 위임.
 * 기존 호출부 `formatDuration(hours: number)` 시그니처는 그대로 동작하며,
 * null/undefined/NaN 입력에 대해 "0분" 을 반환하는 null-safety 를 추가로 확보.
 */
// 명시적 subpath — `@/utils/formatters` 는 동명 파일(src/utils/formatters.ts)로
// resolve 되므로 canonical 배럴(폴더)을 직접 참조.
export { formatDuration } from '@/utils/formatters/duration';

/**
 * 시간을 HH:MM 형식으로 포맷
 */
export function formatTime(date: Date | null): string {
  if (!date) return '--:--';
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * 날짜를 YYYY년 MM월 DD일 형식으로 포맷
 */
export function formatDate(date: Date | null): string {
  if (!date) return '-';
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * 급여 타입 라벨 가져오기
 */
export function getSalaryTypeLabel(type: SalaryType): string {
  return SALARY_TYPE_LABELS[type] || '협의';
}

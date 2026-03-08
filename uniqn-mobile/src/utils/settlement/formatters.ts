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
 * 근무 시간을 시간/분 형식으로 포맷
 */
export function formatDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);

  if (h === 0) return `${m}분`;
  if (m === 0) return `${h}시간`;
  return `${h}시간 ${m}분`;
}

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

/**
 * UNIQN Mobile - 정산 상수
 */

import type { SalaryType, SalaryInfo } from '@/types/jobPosting';

/** 기본 급여 정보 (설정 없는 경우) */
export const DEFAULT_SALARY_INFO: SalaryInfo = {
  type: 'hourly',
  amount: 15000,
};

/** 급여 타입 라벨 */
export const SALARY_TYPE_LABELS: Record<SalaryType, string> = {
  hourly: '시급',
  daily: '일급',
  monthly: '월급',
  other: '협의',
};

/** "제공" 상태를 나타내는 특별 값 */
export const PROVIDED_FLAG = -1;

/**
 * UNIQN Mobile - SalarySection 상수 정의
 *
 * @description 급여 섹션에서 사용하는 상수
 */

import type { SalaryType } from '@/types';

/** 역할별 급여 타입 (협의 포함) */
export const SALARY_TYPES: { value: SalaryType; label: string }[] = [
  { value: 'hourly', label: '시급' },
  { value: 'daily', label: '일급' },
  { value: 'monthly', label: '월급' },
  { value: 'other', label: '협의' },
];

/** 수당 타입 정의 */
export const ALLOWANCE_TYPES = [
  { key: 'meal', label: '식비', providedLabel: '식사제공', placeholder: '0', icon: '🍱' },
  { key: 'transportation', label: '교통비', providedLabel: '교통비제공', placeholder: '0', icon: '🚗' },
  { key: 'accommodation', label: '숙박비', providedLabel: '숙박제공', placeholder: '0', icon: '🏨' },
] as const;

/** 수당 키 타입 */
export type AllowanceKey = typeof ALLOWANCE_TYPES[number]['key'];

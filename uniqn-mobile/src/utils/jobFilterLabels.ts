/**
 * UNIQN Mobile - 구인구직 필터 pill 라벨 포매터
 *
 * @description FilterBar/시트가 공유하는 표시 라벨 — 지역 라벨은 utils/regionSelection,
 * 역할/급여 라벨은 여기. 스토어/컴포넌트에 의존하지 않는 순수 함수 모듈.
 */

import { SALARY_TYPE_LABELS } from '@/constants';
import { STAFF_ROLE_LABELS, type StaffRole } from '@/types/role';
import type { FilterableSalaryType } from '@/types/jobPosting';

/** 역할 pill 라벨 — 없음: '역할' / 1개: '딜러' / n개: '딜러 외 1' */
export function formatRoleFiltersLabel(roles: StaffRole[]): string {
  if (roles.length === 0) return '역할';
  const first = STAFF_ROLE_LABELS[roles[0]!] ?? roles[0]!;
  if (roles.length === 1) return first;
  return `${first} 외 ${roles.length - 1}`;
}

/** 금액(원) → 만원 축약 — 11000: '1.1만', 20000: '2만', 3000000: '300만' */
export function formatManWon(amount: number): string {
  const man = Math.round((amount / 10000) * 100) / 100;
  return `${man}만`;
}

/** 급여 pill 라벨 — 없음: '급여' / 있음: '시급 1.3만+' */
export function formatSalaryFilterLabel(
  filter: { type: FilterableSalaryType; min: number } | null
): string {
  if (!filter) return '급여';
  return `${SALARY_TYPE_LABELS[filter.type]} ${formatManWon(filter.min)}+`;
}

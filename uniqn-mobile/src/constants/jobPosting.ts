/**
 * 구인공고 관련 상수 정의
 *
 * @version 2.1.0
 * @description 날짜별 요구사항 섹션 구현을 위한 상수
 *
 * ## 역할 통합 (v2.1.0)
 * - UI용 STAFF_ROLES는 별도 유지 (아이콘, 표시명 포함)
 */

import { PostingType } from '@/types/postingConfig';
import { DateConstraint } from '@/types/jobPosting/dateRequirement';
import { type StaffRole } from '@/types/role';

/**
 * 타입별 날짜 제약사항
 *
 * @description
 * - regular/urgent: 최대 7개 날짜
 * - tournament: 복수 날짜 (최대 30개)
 * - fixed: DateRequirementsSection 사용 안 함
 */
export const DATE_CONSTRAINTS: Record<PostingType, DateConstraint> = {
  regular: {
    maxDates: 7,
    label: '최대 7개',
  },
  urgent: {
    maxDates: 7,
    label: '최대 7개',
  },
  tournament: {
    maxDates: 30,
    label: '최대 30개',
  },
  fixed: {
    maxDates: 0,
    label: '해당 없음',
  },
};

/**
 * 날짜당 최대 시간대 개수
 */
export const MAX_TIME_SLOTS_PER_DATE = 10;

/**
 * 시간대당 최대 역할 개수
 */
export const MAX_ROLES_PER_SLOT = 10;

/**
 * 스태프 역할 옵션 인터페이스
 */
export interface StaffRoleOption {
  key: StaffRole;
  name: string;
  icon: string;
}

/**
 * 스태프 역할 목록 (통합)
 *
 * @description 전체 앱에서 사용하는 역할 옵션
 */
export const STAFF_ROLES: StaffRoleOption[] = [
  { key: 'dealer', name: '딜러', icon: '🃏' },
  { key: 'floor', name: '플로어', icon: '👔' },
  { key: 'serving', name: '서빙', icon: '🍸' },
  { key: 'manager', name: '매니저', icon: '👔' },
  { key: 'staff', name: '직원', icon: '👤' },
  { key: 'other', name: '기타', icon: '✏️' },
];

/**
 * 역할명 → 아이콘 매핑
 */
export const ROLE_ICONS: Record<string, string> = Object.fromEntries(
  STAFF_ROLES.map((r) => [r.name, r.icon])
);

/**
 * 기본 역할 아이콘
 */
export const DEFAULT_ROLE_ICON = '👤';

/**
 * 기본 시작 시간
 */
export const DEFAULT_START_TIME = '09:00';

/**
 * 급여 타입별 기본값 (주문서 SSOT — 의존성 0 모듈에 배치, mappers가 재수출)
 */
export const DEFAULT_SALARY_BY_TYPE = { hourly: 20000, daily: 200000, monthly: 2500000 } as const;

/**
 * 역할별 시급 기본단가 (설계 §S2.2 — D2 승인: 딜러 20,000/플로어 30,000/그 외 20,000)
 *
 * @description 시급만 역할 차등. 일급/월급은 DEFAULT_SALARY_BY_TYPE 균일(보수적).
 */
export const DEFAULT_ROLE_HOURLY: Record<string, number> = { dealer: 20_000, floor: 30_000 };
export const DEFAULT_ROLE_HOURLY_FALLBACK = 20_000; // serving·manager·staff·other(커스텀 포함)

/**
 * 급여 금액 상한 (Eng-M4 — 역할별 입력 지점 N개 확대 시점에 조임. 프리셋 경유 이상치도 재검증)
 */
export const MAX_SALARY_AMOUNT = 100_000_000;

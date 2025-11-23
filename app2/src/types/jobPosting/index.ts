// 모든 jobPosting 관련 타입 재내보내기

// 기본 타입들
export * from './base';

// 구인공고 관련 타입
export * from './jobPosting';

// 유틸리티 클래스
export * from './utils';

// 근무일정 관련 타입 (고정공고용)
export type {
  StaffRole,
  WorkSchedule,
  RoleWithCount,
  FixedWorkScheduleSectionProps
} from './workSchedule';
export { STAFF_ROLES } from './workSchedule';
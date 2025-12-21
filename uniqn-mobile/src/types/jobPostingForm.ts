/**
 * UNIQN Mobile - 공고 작성 폼 타입
 *
 * @description 공고 작성/수정 폼에서 사용되는 타입 정의
 * @version 1.0.0
 */

import type {
  Location,
  RoleRequirement,
  SalaryInfo,
  Allowances,
} from './index';

// ============================================================================
// Form Data Types
// ============================================================================

/**
 * 공고 작성 폼 데이터 타입
 *
 * @description 5단계 폼 전체에서 사용되는 데이터 구조
 */
export interface JobPostingFormData {
  // Step 1: 기본 정보
  /** 공고 제목 (최대 25자) */
  title: string;
  /** 근무 장소 */
  location: Location | null;
  /** 상세 주소 (선택) */
  detailedAddress: string;
  /** 문의 연락처 */
  contactPhone: string;
  /** 공고 설명 (선택, 최대 500자) */
  description: string;

  // Step 2: 일정
  /** 근무 날짜 (YYYY-MM-DD) */
  workDate: string;
  /** 근무 시간대 (예: "10:00 - 18:00") */
  timeSlot: string;

  // Step 3: 역할/인원
  /** 역할별 모집 인원 */
  roles: RoleRequirement[];

  // Step 4: 급여
  /** 급여 정보 */
  salary: SalaryInfo;
  /** 추가 수당 */
  allowances: Allowances;

  // 기타
  /** 긴급 공고 여부 (7일 이내) */
  isUrgent: boolean;
  /** 태그 */
  tags: string[];
}

/**
 * 폼 데이터 초기값
 */
export const INITIAL_JOB_POSTING_FORM_DATA: JobPostingFormData = {
  title: '',
  location: null,
  detailedAddress: '',
  contactPhone: '',
  description: '',
  workDate: '',
  timeSlot: '',
  roles: [],
  salary: {
    type: 'daily',
    amount: 0,
    useRoleSalary: false,
  },
  allowances: {},
  isUrgent: false,
  tags: [],
};

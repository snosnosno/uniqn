/**
 * UNIQN Mobile - 공고 작성 폼 타입
 *
 * @description 공고 작성/수정 폼에서 사용되는 타입 정의
 * @version 2.0.0 - 4가지 공고 타입 지원
 */

import type {
  Location,
  SalaryInfo,
  Allowances,
  PostingType,
  PreQuestion,
  TaxSettings,
} from './index';
import type { DateSpecificRequirement } from './jobPosting/dateRequirement';
import { STAFF_ROLES } from '@/constants';
import { isWithinUrgentDateLimit } from '@/utils/date';

// ============================================================================
// 공고 타입별 설정
// ============================================================================

/**
 * 역할 + 인원 + 급여 정보
 *
 * @description 기본 역할: 직원, 매니저 / 추가 역할 가능
 */
export interface FormRoleWithCount {
  /** 역할 이름 (직원, 매니저, 또는 직접 입력) */
  name: string;
  /** 필요 인원 */
  count: number;
  /** 사용자가 직접 추가한 역할인지 */
  isCustom?: boolean;
  /** 역할별 급여 */
  salary?: SalaryInfo;
}

/**
 * 기본 역할 목록
 */
export const DEFAULT_ROLES: FormRoleWithCount[] = [
  { name: '직원', count: 1, isCustom: false },
  { name: '매니저', count: 1, isCustom: false },
];

/**
 * 공고 타입별 라벨 (UI 표시용)
 */
export const POSTING_TYPE_INFO: Record<
  PostingType,
  { label: string; icon: string; description: string }
> = {
  regular: {
    label: '지원',
    icon: '📋',
    description: '일반 공고',
  },
  fixed: {
    label: '고정',
    icon: '📌',
    description: '장기 근무',
  },
  tournament: {
    label: '대회',
    icon: '🏆',
    description: '승인 필요',
  },
  urgent: {
    label: '긴급',
    icon: '🚨',
    description: '급한 구인',
  },
};

// ============================================================================
// Form Data Types
// ============================================================================

/**
 * 공고 작성 폼 데이터 타입 (v2.0)
 *
 * @description 6단계 폼 전체에서 사용되는 데이터 구조
 * - Step1: 타입 선택 + 기본 정보
 * - Step2: 일정 (타입별 분기)
 * - Step3: 역할/인원
 * - Step4: 급여
 * - Step5: 사전질문 (선택)
 * - Step6: 확인
 */
export interface JobPostingFormData {
  // ============================================================
  // Step 1: 타입 선택 + 기본 정보
  // ============================================================

  /** 공고 타입 */
  postingType: PostingType;

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

  // ============================================================
  // Step 2: 일정 (타입별 분기)
  // ============================================================

  // --- regular/urgent: 단일 날짜 ---
  /** 근무 날짜 (YYYY-MM-DD) */
  workDate: string;

  /** 출근 시간 (HH:mm) - 종료시간 없음 */
  startTime: string;

  /** 출근 시간 협의 여부 (fixed 공고용) */
  isStartTimeNegotiable?: boolean;

  // --- 날짜별 요구사항 (v2.0) ---
  /** 날짜별 모집 정보 (regular/urgent/tournament 공통) */
  dateSpecificRequirements?: DateSpecificRequirement[];

  // --- fixed: 주 출근일수 ---
  /** 주 출근일수 (0 = 협의, 1-7 = 일수) */
  daysPerWeek: number;

  // ============================================================
  // Step 3: 역할/인원
  // ============================================================

  /** 역할별 모집 인원 (기본: 직원, 매니저) */
  roles: FormRoleWithCount[];

  // ============================================================
  // Step 4: 급여 (roles[].salary에 통합)
  // ============================================================

  /** 기본 급여 (useSameSalary=true일 때 사용) */
  defaultSalary?: SalaryInfo;

  /** 추가 수당 */
  allowances: Allowances;

  /** 전체 동일 급여 사용 여부 (false = 역할별 급여가 기본) */
  useSameSalary: boolean;
  // 역할별 급여는 roles[].salary에 통합됨

  /** 세금 설정 (선택) */
  taxSettings?: TaxSettings;

  // ============================================================
  // Step 5: 사전질문 (선택)
  // ============================================================

  /** 사전질문 사용 여부 */
  usesPreQuestions: boolean;

  /** 사전질문 목록 */
  preQuestions: PreQuestion[];

  // ============================================================
  // 기타
  // ============================================================

  /** 태그 */
  tags: string[];
}

/**
 * 폼 데이터 초기값 (v2.0)
 */
export const INITIAL_JOB_POSTING_FORM_DATA: JobPostingFormData = {
  // Step 1
  postingType: 'regular',
  title: '',
  location: null,
  detailedAddress: '',
  contactPhone: '',
  description: '',

  // Step 2
  workDate: '',
  startTime: '',
  isStartTimeNegotiable: false,
  dateSpecificRequirements: [],
  daysPerWeek: 0, // 0 = 협의 (기본값)

  // Step 3
  roles: [...DEFAULT_ROLES],

  // Step 4: 역할별 급여가 기본 (roles[].salary에 저장)
  defaultSalary: undefined, // useSameSalary=true일 때만 사용
  allowances: {},
  useSameSalary: false, // false = 역할별 급여 (기본)
  taxSettings: undefined, // 기본값: 세금 없음 (undefined → DEFAULT_TAX_SETTINGS로 폴백)

  // Step 5
  usesPreQuestions: false,
  preQuestions: [],

  // 기타
  tags: [],
};

// ============================================================================
// 유틸리티 함수
// ============================================================================

/**
 * 폼 데이터 유효성 검사 (Step별)
 */
export function validateStep(
  step: number,
  data: JobPostingFormData
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  switch (step) {
    case 1: // 타입 + 기본 정보
      if (!data.title.trim()) errors.push('제목을 입력해주세요');
      if (data.title.length > 25) errors.push('제목은 25자 이내로 입력해주세요');
      if (!data.location) errors.push('지역을 선택해주세요');
      if (!data.contactPhone.trim()) errors.push('연락처를 입력해주세요');
      break;

    case 2: // 일정
      if (data.postingType === 'regular' || data.postingType === 'urgent') {
        if (!data.workDate) errors.push('근무 날짜를 선택해주세요');
        if (!data.startTime) errors.push('출근 시간을 선택해주세요');

        // urgent: 7일 이내 검증
        if (data.postingType === 'urgent' && data.workDate) {
          const isUrgentDateValid = isWithinUrgentDateLimit(data.workDate);
          if (!isUrgentDateValid) {
            errors.push('긴급 공고는 오늘부터 7일 이내만 가능합니다');
          }
        }
      } else if (data.postingType === 'tournament') {
        if (!data.dateSpecificRequirements || data.dateSpecificRequirements.length === 0) {
          errors.push('최소 1일 이상의 대회 일정을 추가해주세요');
        }
      } else if (data.postingType === 'fixed') {
        // daysPerWeek: 0 = 협의, 1-7 = 일수 (모두 유효)
        if (data.daysPerWeek < 0 || data.daysPerWeek > 7) {
          errors.push('주 출근일수를 선택해주세요');
        }
        // 출근 시간: 협의가 아닌 경우에만 필수
        if (!data.isStartTimeNegotiable && !data.startTime) {
          errors.push('출근 시간을 선택해주세요');
        }
      }
      break;

    case 3: // 역할
      if (data.roles.length === 0) {
        errors.push('최소 1개 이상의 역할을 추가해주세요');
      }
      data.roles.forEach((role) => {
        if (!role.name.trim()) errors.push('역할 이름을 입력해주세요');
        if (role.count < 1) errors.push(`${role.name}: 인원은 1명 이상이어야 합니다`);
      });
      break;

    case 4: // 급여 (역할별 급여가 기본, roles[].salary에 저장)
      data.roles.forEach((role) => {
        const staffRole = STAFF_ROLES.find((sr) => sr.name === role.name || sr.key === role.name);
        const displayName = staffRole?.name || role.name;
        const roleSalary = role.salary;
        // 협의(other)가 아닌 경우 금액 필수
        if (roleSalary?.type !== 'other' && (!roleSalary || roleSalary.amount <= 0)) {
          errors.push(`${displayName}: 급여를 입력해주세요`);
        }
      });
      break;

    case 5: // 사전질문 (선택)
      // 선택 사항이므로 검증 없음
      break;

    case 6: // 확인
      // 전체 검증은 제출 시 수행
      break;
  }

  return { isValid: errors.length === 0, errors };
}

/**
 * 전체 폼 검증
 */
export function validateForm(data: JobPostingFormData): {
  isValid: boolean;
  errors: Record<number, string[]>;
} {
  const allErrors: Record<number, string[]> = {};

  for (let step = 1; step <= 5; step++) {
    const { errors } = validateStep(step, data);
    if (errors.length > 0) {
      allErrors[step] = errors;
    }
  }

  return {
    isValid: Object.keys(allErrors).length === 0,
    errors: allErrors,
  };
}

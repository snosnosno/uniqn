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
} from './index';
import type { DateSpecificRequirement } from './jobPosting/dateRequirement';

// ============================================================================
// 공고 타입별 설정
// ============================================================================

/**
 * 대회 Day 정보
 *
 * @description 대회 공고에서 여러 날짜를 선택할 때 사용
 */
export interface TournamentDay {
  /** Day 번호 (1, 2, 3...) */
  day: number;
  /** 날짜 (YYYY-MM-DD) */
  date: string;
  /** 출근 시간 (HH:mm) */
  startTime: string;
}

/**
 * 역할 + 인원 정보
 *
 * @description 기본 역할: 딜러, 플로어 / 추가 역할 가능
 */
export interface FormRoleWithCount {
  /** 역할 이름 (딜러, 플로어, 또는 직접 입력) */
  name: string;
  /** 필요 인원 */
  count: number;
  /** 사용자가 직접 추가한 역할인지 */
  isCustom?: boolean;
}

/**
 * 기본 역할 목록
 */
export const DEFAULT_ROLES: FormRoleWithCount[] = [
  { name: '딜러', count: 1, isCustom: false },
  { name: '플로어', count: 1, isCustom: false },
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

  // --- tournament: 여러 날짜 ---
  /** 대회 일정 (Day 1, 2, 3...) */
  tournamentDates: TournamentDay[];

  // --- 날짜별 요구사항 (v2.0) ---
  /** 날짜별 모집 정보 (regular/urgent/tournament 공통) */
  dateSpecificRequirements?: DateSpecificRequirement[];

  // --- fixed: 주 출근일수 ---
  /** 주 출근일수 (1-7) */
  daysPerWeek: number;

  /** 근무 요일 (월, 화, 수...) */
  workDays: string[];

  // ============================================================
  // Step 3: 역할/인원
  // ============================================================

  /** 역할별 모집 인원 (기본: 딜러, 플로어) */
  roles: FormRoleWithCount[];

  // ============================================================
  // Step 4: 급여
  // ============================================================

  /** 급여 정보 */
  salary: SalaryInfo;

  /** 추가 수당 */
  allowances: Allowances;

  /** 역할별 급여 설정 사용 여부 */
  useRoleSalary: boolean;

  /** 역할별 급여 (역할명 -> 급여 정보) */
  roleSalaries: Record<string, SalaryInfo>;

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
  tournamentDates: [],
  dateSpecificRequirements: [],
  daysPerWeek: 5,
  workDays: [],

  // Step 3
  roles: [...DEFAULT_ROLES],

  // Step 4
  salary: {
    type: 'hourly',
    amount: 0,
    useRoleSalary: false,
  },
  allowances: {},
  useRoleSalary: false,
  roleSalaries: {},

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
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const workDate = new Date(data.workDate);
          const diffDays = Math.ceil(
            (workDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          );
          if (diffDays < 0 || diffDays > 7) {
            errors.push('긴급 공고는 오늘부터 7일 이내만 가능합니다');
          }
        }
      } else if (data.postingType === 'tournament') {
        if (data.tournamentDates.length === 0) {
          errors.push('최소 1일 이상의 대회 일정을 추가해주세요');
        }
        data.tournamentDates.forEach((day, idx) => {
          if (!day.date) errors.push(`Day ${idx + 1}: 날짜를 선택해주세요`);
          if (!day.startTime) errors.push(`Day ${idx + 1}: 출근 시간을 선택해주세요`);
        });
      } else if (data.postingType === 'fixed') {
        if (data.daysPerWeek < 1 || data.daysPerWeek > 7) {
          errors.push('주 출근일수는 1~7일 사이로 입력해주세요');
        }
        if (!data.startTime) errors.push('출근 시간을 선택해주세요');
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

    case 4: // 급여
      if (data.salary.amount < 0) errors.push('급여는 0 이상이어야 합니다');
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

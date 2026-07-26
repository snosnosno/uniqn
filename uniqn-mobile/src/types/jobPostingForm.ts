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
import type { DateSpecificRequirement, TimeSlot } from './jobPosting/dateRequirement';

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
    description: '기본 공고',
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
    label: '급구',
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

  /** 공고 제목 (최대 MAX_POSTING_TITLE_LENGTH 자 — constants/jobPosting.ts 단일 소스) */
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
  datedTemplateTimeSlots?: TimeSlot[];

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

  /**
   * 운영처(venue) 컨테이너 self-FK (주간 배치 그리드).
   * 일반 공고 폼은 미설정. 컨테이너 "공고 열기" 경로에서만 주입.
   */
  venueId?: string;
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
  datedTemplateTimeSlots: [],
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

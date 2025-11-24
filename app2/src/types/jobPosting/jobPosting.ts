import { Timestamp } from 'firebase/firestore';
import {
  DateSpecificRequirement,
  PreQuestion,
  Benefits,
  ConfirmedStaff
} from './base';

/**
 * 공고 타입 (4가지)
 */
export type PostingType = 'regular' | 'fixed' | 'tournament' | 'urgent';

/**
 * 고정 공고 설정
 */
export interface FixedConfig {
  durationDays: 7 | 30 | 90;        // 노출 기간
  chipCost: 3 | 5 | 10;             // 칩 비용 (기간에 따라)
  expiresAt: Timestamp;             // 만료일
  createdAt: Timestamp;             // 생성일
}

/**
 * 고정공고 근무 일정
 *
 * 주간 출근일수와 근무 시작/종료 시간을 정의합니다.
 * 시간은 24시간제 HH:mm 형식을 사용합니다.
 */
export interface WorkSchedule {
  /**
   * 주 출근일수 (1-7일)
   * @example 5 // 주 5일 근무
   */
  daysPerWeek: number;

  /**
   * 근무 시작 시간 (HH:mm 형식, 24시간제)
   * @example "09:00"
   */
  startTime: string;

  /**
   * 근무 종료 시간 (HH:mm 형식, 24시간제)
   * @example "18:00"
   */
  endTime: string;
}

/**
 * 역할별 모집 인원
 *
 * 고정공고에서 모집하려는 역할명과 필요 인원수를 정의합니다.
 */
export interface RoleWithCount {
  /**
   * 역할명
   * @example "딜러"
   * @example "플로어 매니저"
   */
  name: string;

  /**
   * 모집 인원 (1명 이상)
   * @example 3
   */
  count: number;
}

/**
 * 고정공고 전용 데이터
 *
 * 고정공고에서만 사용하는 추가 정보를 정의합니다.
 * - 근무 일정 (WorkSchedule)
 * - 역할별 모집 인원 (RoleWithCount[])
 * - 조회수
 */
export interface FixedJobPostingData {
  /**
   * 근무 일정
   */
  workSchedule: WorkSchedule;

  /**
   * 역할별 모집 인원 (Source of truth)
   *
   * 이 필드가 고정공고의 역할 및 인원 정보의 신뢰 원천입니다.
   * 최소 1개 이상의 역할을 포함해야 합니다.
   */
  requiredRolesWithCount: RoleWithCount[];

  /**
   * 조회수 (기본값: 0)
   */
  viewCount: number;
}

/**
 * 대회 공고 설정
 */
export interface TournamentConfig {
  approvalStatus: 'pending' | 'approved' | 'rejected'; // 승인 상태
  approvedBy?: string;              // 승인자 userId (admin)
  approvedAt?: Timestamp;           // 승인일
  rejectedBy?: string;              // 거부자 userId (admin)
  rejectedAt?: Timestamp;           // 거부일
  rejectionReason?: string;         // 거부 사유 (최소 10자)
  resubmittedAt?: Timestamp;        // 재신청일 (거부 후)
  submittedAt: Timestamp;           // 최초 제출일
}

/**
 * 긴급 공고 설정
 */
export interface UrgentConfig {
  chipCost: 5;                      // 고정 5칩
  createdAt: Timestamp;             // 생성일
  priority: 'high';                 // 우선순위 (향후 확장 대비)
}

/**
 * 공고 작성/수정 폼 데이터 타입
 */
export interface JobPostingFormData {
  title: string;
  /**
   * @deprecated 레거시 필드입니다. `postingType` 필드를 대신 사용하세요.
   * 하위 호환성을 위해 유지되지만 향후 버전에서 제거될 예정입니다.
   */
  type?: 'application' | 'fixed';
  description: string;
  location: string;
  detailedAddress?: string;
  district?: string;       // 시/군/구
  contactPhone?: string;   // 문의 연락처
  // startDate와 endDate 제거 - dateSpecificRequirements로 대체
  status: 'open' | 'closed';
  dateSpecificRequirements: DateSpecificRequirement[];
  preQuestions?: PreQuestion[];
  usesPreQuestions?: boolean;  // 사전질문 사용 여부
  requiredRoles?: string[];
  salaryType?: 'hourly' | 'daily' | 'monthly' | 'negotiable' | 'other'; // 급여 유형 (협의 추가)
  salaryAmount?: string;    // 급여 금액
  benefits?: Benefits;       // 복리후생 정보
  useRoleSalary?: boolean;  // 역할별 급여 사용 여부
  roleSalaries?: {          // 역할별 급여 정보
    [role: string]: {
      salaryType: 'hourly' | 'daily' | 'monthly' | 'negotiable' | 'other';
      salaryAmount: string;
      customRoleName?: string;  // 기타 선택 시 직접 입력한 역할명
    }
  };
  taxSettings?: {           // 세금 설정
    enabled: boolean;       // 세금 적용 여부
    taxRate?: number;       // 세율 (%) - 비율 기반 계산
    taxAmount?: number;     // 고정 세금 - 고정 금액 계산
  };

  // ========== 새 필드 (확장) ==========
  postingType: PostingType;         // 공고 타입 (필수)
  fixedConfig?: FixedConfig;        // 고정 공고 설정
  tournamentConfig?: TournamentConfig; // 대회 공고 설정
  urgentConfig?: UrgentConfig;      // 긴급 공고 설정

  // ========== 고정공고 근무일정 섹션 필드 ==========
  workSchedule?: {                  // 근무 일정 (고정공고용)
    daysPerWeek: number;            // 주 출근일수 (1-7)
    startTime: string;              // 시작시간 (HH:mm)
    endTime: string;                // 종료시간 (HH:mm)
  };
  requiredRolesWithCount?: Array<{  // 역할별 필요 인원 (고정공고용)
    id: string;                     // React key용 고유 ID
    role: string;                   // 역할명 (딜러, 플로어, 칩러너, 서빙, 기타)
    count: number;                  // 필요 인원수
  }>;
}

/**
 * Job Posting 기본 인터페이스
 */
export interface JobPosting {
  id: string;
  title: string;
  /**
   * @deprecated 레거시 필드입니다. `postingType` 필드를 대신 사용하세요.
   * 하위 호환성을 위해 유지되지만 향후 버전에서 제거될 예정입니다.
   */
  type?: 'application' | 'fixed';
  description: string;
  location: string;
  district?: string;
  detailedAddress?: string;
  contactPhone?: string;  // 문의 연락처
  // startDate와 endDate 제거 - dateSpecificRequirements로 대체
  dateSpecificRequirements: DateSpecificRequirement[];
  requiredRoles?: string[];
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  createdBy: string;
  status: 'open' | 'closed';
  applicants?: string[];
  confirmedStaff?: ConfirmedStaff[];
  /**
   * @deprecated 레거시 필드입니다. `postingType` 필드를 대신 사용하세요.
   * 하위 호환성을 위해 유지되지만 향후 버전에서 제거될 예정입니다.
   */
  recruitmentType?: 'application' | 'fixed';
  usesPreQuestions?: boolean;  // 사전질문 사용 여부
  preQuestions?: PreQuestion[];

  // 변경 사유 기록
  statusChangeReason?: string;
  statusChangedAt?: Timestamp;
  statusChangedBy?: string;

  // 급여 정보 필드
  salaryType?: 'hourly' | 'daily' | 'monthly' | 'negotiable' | 'other';
  salaryAmount?: string;

  // 복리후생 정보
  benefits?: Benefits;

  // 역할별 급여 정보
  useRoleSalary?: boolean;
  roleSalaries?: {
    [role: string]: {
      salaryType: 'hourly' | 'daily' | 'monthly' | 'negotiable' | 'other';
      salaryAmount: string;
      customRoleName?: string;
    }
  };

  // 세금 설정
  taxSettings?: {
    enabled: boolean;      // 세금 적용 여부
    taxRate?: number;      // 세율 (%) - 비율 기반 계산
    taxAmount?: number;    // 고정 세금 - 고정 금액 계산
  };

  // 자동 관리 기능 플래그
  autoManageStatus?: boolean; // 자동 상태 관리 활성화 여부

  // ========== 새 필드 (확장) ==========
  postingType: PostingType;             // 공고 타입 (필수)
  fixedConfig?: FixedConfig;            // 고정 공고 설정 (postingType === 'fixed'일 때)
  tournamentConfig?: TournamentConfig;  // 대회 공고 설정 (postingType === 'tournament'일 때)
  urgentConfig?: UrgentConfig;          // 긴급 공고 설정 (postingType === 'urgent'일 때)
  chipCost?: number;                    // 칩 비용 (fixed/urgent 타입)
  isChipDeducted: boolean;              // 칩 차감 여부 (기본값: false)

  // ========== 고정공고 근무일정 필드 ==========
  workSchedule?: WorkSchedule;          // 근무 일정 (고정공고용)
  requiredRolesWithCount?: Array<{      // 역할별 필요 인원 (고정공고용)
    id?: string;                        // React key용 고유 ID (폼에서만 사용)
    role?: string;                      // 역할명 (폼 호환)
    name?: string;                      // 역할명 (RoleWithCount 호환)
    count: number;                      // 필요 인원수
  }>;
}

/**
 * 고정공고 타입
 *
 * JobPosting을 확장하여 고정공고 전용 필드를 필수로 만듭니다.
 * - postingType을 'fixed' 리터럴로 제한
 * - fixedConfig를 필수 필드로 변경
 * - fixedData를 필수 필드로 추가
 *
 * @example
 * ```typescript
 * const posting: FixedJobPosting = {
 *   id: 'abc123',
 *   title: '딜러 모집',
 *   postingType: 'fixed',  // 리터럴 타입
 *   fixedConfig: {
 *     durationDays: 30,
 *     chipCost: 5,
 *     expiresAt: Timestamp.now(),
 *     createdAt: Timestamp.now()
 *   },
 *   fixedData: {
 *     workSchedule: {
 *       daysPerWeek: 5,
 *       startTime: '14:00',
 *       endTime: '22:00'
 *     },
 *     requiredRolesWithCount: [
 *       { name: '딜러', count: 3 },
 *       { name: '플로어 매니저', count: 1 }
 *     ],
 *     viewCount: 0
 *   },
 *   // ... 기타 JobPosting 필드들
 * };
 * ```
 */
export interface FixedJobPosting extends Omit<JobPosting, 'postingType' | 'fixedConfig'> {
  /**
   * 공고 타입 (고정공고는 'fixed'로 고정)
   */
  postingType: 'fixed';

  /**
   * 고정공고 설정 (필수)
   *
   * 고정공고에서는 항상 존재해야 하는 설정 정보입니다.
   * - durationDays: 노출 기간 (7/30/90일)
   * - chipCost: 칩 비용
   * - expiresAt: 만료일
   * - createdAt: 생성일
   */
  fixedConfig: FixedConfig;

  /**
   * 고정공고 전용 데이터 (필수)
   *
   * 고정공고에서만 사용하는 추가 정보입니다.
   * - workSchedule: 근무 일정
   * - requiredRolesWithCount: 역할별 모집 인원 (Source of truth)
   * - viewCount: 조회수
   */
  fixedData: FixedJobPostingData;
}

/**
 * 구인공고 통계 타입
 */
export interface JobPostingStats {
  totalApplicants: number;
  confirmedStaff: number;
  pendingApplicants: number;
  rejectedApplicants: number;
  byRole: { [role: string]: number };
  byTimeSlot: { [timeSlot: string]: number };
  completionRate: number; // 충원율 (%)
}

/**
 * 구인공고 템플릿 타입
 */
export interface JobPostingTemplate {
  id?: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: any;
  templateData: Partial<JobPostingFormData>;
  usageCount?: number;
  lastUsedAt?: any;
  isPublic?: boolean;
}

/**
 * 구인공고 필터 타입
 */
export interface JobPostingFilters {
  status?: 'open' | 'closed' | 'all';
  location?: string;
  district?: string;
  recruitmentType?: 'application' | 'fixed' | 'all';
  type?: 'application' | 'fixed' | 'all';
  postingType?: PostingType | 'all'; // 새 필드: 공고 타입 필터
  startDate?: string;
  endDate?: string;
  role?: string;
  keyword?: string;
  myApplicationsOnly?: boolean;
  userId?: string;
  searchTerms?: string[];
}

/**
 * 템플릿 생성 요청 타입
 */
export interface CreateTemplateRequest {
  name: string;
  description: string;
  templateData: Partial<JobPostingFormData>;
  createdBy?: string;
  usageCount?: number;
}

/**
 * 타입 가드: 고정공고 여부 확인
 *
 * JobPosting 객체가 FixedJobPosting 타입인지 런타임에 검증합니다.
 * TypeScript의 타입 좁히기(Type Narrowing)를 활성화합니다.
 *
 * @param posting - 검증할 JobPosting 객체
 * @returns posting이 FixedJobPosting이면 true, 아니면 false
 *
 * @example
 * ```typescript
 * const posting: JobPosting = await fetchPosting(id);
 *
 * if (isFixedJobPosting(posting)) {
 *   // 이 블록 안에서 posting은 FixedJobPosting 타입으로 좁혀집니다
 *   console.log(posting.fixedData.workSchedule.startTime);  // ✅ 타입 안전
 *   console.log(posting.fixedConfig.durationDays);          // ✅ 타입 안전
 * } else {
 *   // posting.fixedData는 존재하지 않을 수 있음
 *   console.log(posting.fixedData?.workSchedule);           // ❌ 옵셔널 체이닝 필요
 * }
 * ```
 */
export function isFixedJobPosting(posting: JobPosting): posting is FixedJobPosting {
  return (
    posting.postingType === 'fixed' &&
    posting.fixedConfig !== undefined &&
    'fixedData' in posting &&
    posting.fixedData !== undefined
  );
}
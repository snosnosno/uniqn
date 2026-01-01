/**
 * UNIQN Mobile - 구인공고 관련 타입 정의
 *
 * @version 2.0.0
 * @description PostingType 4가지 + DateSpecificRequirement + PreQuestion 지원
 */

import { Timestamp } from 'firebase/firestore';
import { FirebaseDocument, Location, StaffRole } from './common';
import type {
  PostingType,
  FixedConfig,
  TournamentConfig,
  UrgentConfig,
  DateSpecificRequirement,
  WorkSchedule,
  RoleWithCount,
} from './postingConfig';
import type { PreQuestion } from './preQuestion';

// Re-export for convenience
export type { PostingType } from './postingConfig';

/**
 * 공고 상태
 */
export type JobPostingStatus = 'draft' | 'active' | 'closed' | 'cancelled';

/**
 * 급여 타입
 */
export type SalaryType = 'hourly' | 'daily' | 'monthly' | 'other';

/**
 * 급여 정보
 */
export interface SalaryInfo {
  type: SalaryType;
  amount: number;
  useRoleSalary?: boolean;
  roleSalaries?: Record<
    string,
    {
      type: SalaryType;
      amount: number;
    }
  >;
}

/**
 * 수당 정보
 */
export interface Allowances {
  meal?: number;
  transportation?: number;
  accommodation?: number;
}

/**
 * 세금 설정
 */
export interface TaxSettings {
  enabled: boolean;
  taxRate?: number;
  taxAmount?: number;
}

/**
 * 역할별 모집 인원
 */
export interface RoleRequirement {
  role: StaffRole;
  count: number;
  filled: number;
}

/**
 * 구인공고 타입
 *
 * @description v2.0: PostingType 4가지 + DateSpecificRequirement + PreQuestion 지원
 */
export interface JobPosting extends FirebaseDocument {
  // === 기본 정보 ===
  title: string;
  description?: string;
  status: JobPostingStatus;

  // === 장소 정보 ===
  location: Location;
  detailedAddress?: string;
  contactPhone?: string;

  // === 일정 정보 (레거시: 단일 날짜) ===
  workDate: string; // YYYY-MM-DD
  timeSlot: string; // "18:00 - 02:00" or "18:00~02:00"
  startTime?: Timestamp;
  endTime?: Timestamp;

  // === 일정 정보 (v2.0: 다중 날짜) ===
  /**
   * 날짜별 모집 정보
   * @description 여러 날짜에 각각 다른 시간대/역할 모집 가능
   */
  dateSpecificRequirements?: DateSpecificRequirement[];

  // === 모집 정보 ===
  roles: RoleRequirement[];
  totalPositions: number;
  filledPositions: number;

  // === 급여 정보 ===
  salary: SalaryInfo;
  allowances?: Allowances;
  taxSettings?: TaxSettings;

  // === 소유자 정보 ===
  ownerId: string;
  ownerName?: string;

  // === 통계 ===
  viewCount?: number;
  applicationCount?: number;

  // === 메타데이터 ===
  tags?: string[];
  isUrgent?: boolean;

  // === PostingType v2.0 ===
  /**
   * 공고 타입
   * - regular: 일반 공고 (기본)
   * - fixed: 고정 공고 (기간제)
   * - tournament: 대회 공고 (관리자 승인)
   * - urgent: 긴급 공고 (우선 노출)
   */
  postingType?: PostingType;

  /** 고정 공고 설정 */
  fixedConfig?: FixedConfig;

  /** 대회 공고 설정 */
  tournamentConfig?: TournamentConfig;

  /** 긴급 공고 설정 */
  urgentConfig?: UrgentConfig;

  // === 고정공고 전용 필드 ===
  /** 근무 스케줄 */
  workSchedule?: WorkSchedule;

  /** 역할별 모집 인원 (상세) */
  requiredRolesWithCount?: RoleWithCount[];

  // === 사전질문 ===
  /** 사전질문 사용 여부 */
  usesPreQuestions?: boolean;

  /** 사전질문 목록 */
  preQuestions?: PreQuestion[];
}

/**
 * 공고 목록 필터
 */
export interface JobPostingFilters {
  status?: JobPostingStatus;
  roles?: StaffRole[];
  district?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  searchTerm?: string;
  isUrgent?: boolean;
  ownerId?: string;
}

/**
 * 공고 생성 입력
 */
export interface CreateJobPostingInput {
  title: string;
  description?: string;
  location: Location;
  detailedAddress?: string;
  contactPhone?: string;
  workDate: string;
  timeSlot: string;
  roles: RoleRequirement[];
  salary: SalaryInfo;
  allowances?: Allowances;
  taxSettings?: TaxSettings;
  tags?: string[];
  isUrgent?: boolean;
}

/**
 * 공고 수정 입력
 */
export type UpdateJobPostingInput = Partial<CreateJobPostingInput> & {
  status?: JobPostingStatus;
};

/**
 * 공고 카드용 간소화 타입
 */
export interface JobPostingCard {
  id: string;
  title: string;
  location: string;
  workDate: string;
  timeSlot: string;
  roles: string[];
  salary: {
    type: SalaryType;
    amount: number;
  };
  status: JobPostingStatus;
  isUrgent?: boolean;
  applicationCount?: number;
}

/**
 * JobPosting을 JobPostingCard로 변환
 */
export const toJobPostingCard = (posting: JobPosting): JobPostingCard => ({
  id: posting.id,
  title: posting.title,
  location: posting.location.name,
  workDate: posting.workDate,
  timeSlot: posting.timeSlot,
  roles: posting.roles.map((r) => r.role),
  salary: {
    type: posting.salary.type,
    amount: posting.salary.amount,
  },
  status: posting.status,
  isUrgent: posting.isUrgent,
  applicationCount: posting.applicationCount,
});

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
  WorkSchedule,
  RoleWithCount,
} from './postingConfig';
import type { DateSpecificRequirement } from './jobPosting/dateRequirement';
import type { PreQuestion } from './preQuestion';
import type { FormRoleWithCount, TournamentDay } from './jobPostingForm';

// Re-export for convenience
export type { PostingType } from './postingConfig';

/**
 * 공고 상태
 */
export type JobPostingStatus = 'active' | 'closed' | 'cancelled';

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
  /** @deprecated 역할별 급여가 기본이므로 더 이상 사용하지 않음 */
  useRoleSalary?: boolean;
  /** @deprecated useSameSalary로 대체 */
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
  /** 보장시간 */
  guaranteedHours?: number;
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
 * 역할별 모집 통계 (공고에서 사용)
 *
 * @description 공고의 역할별 모집 인원 및 충원 현황
 * @see RoleRequirement in types/jobPosting/dateRequirement.ts (폼 편집용)
 */
export interface JobRoleStats {
  role: StaffRole;
  count: number;
  filled: number;
}

/**
 * 역할별 모집 인원
 *
 * @deprecated JobRoleStats 사용 권장. 폼 편집에는 types/jobPosting/dateRequirement.ts의 RoleRequirement 사용
 */
export type RoleRequirement = JobRoleStats;

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
  /**
   * 날짜 필터용 배열
   * @description dateSpecificRequirements에서 날짜만 추출한 배열 (array-contains 쿼리용)
   */
  workDates?: string[];

  // === 모집 정보 ===
  roles: RoleRequirement[];
  totalPositions: number;
  filledPositions: number;

  // === 급여 정보 ===
  salary: SalaryInfo;
  allowances?: Allowances;
  taxSettings?: TaxSettings;
  /** 전체 동일 급여 사용 여부 (false = 역할별 급여가 기본) */
  useSameSalary?: boolean;
  /** 역할별 급여 */
  roleSalaries?: Record<string, SalaryInfo>;

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

  /** 주 출근일수 (0 = 협의, 1-7 = 일수) - fixed 타입용 */
  daysPerWeek?: number;

  /** 출근 시간 협의 여부 - fixed 타입용 */
  isStartTimeNegotiable?: boolean;

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
  /** 공고 타입 필터 (regular, fixed, tournament, urgent) */
  postingType?: PostingType;
  /** 근무일 필터 (YYYY-MM-DD) - regular 타입에서 날짜 필터링용 */
  workDate?: string;
}

/**
 * 공고 생성 입력 (v2.0 - 4가지 타입 지원)
 */
export interface CreateJobPostingInput {
  // 기본 정보
  postingType?: 'regular' | 'fixed' | 'tournament' | 'urgent';
  title: string;
  description?: string;
  location: Location;
  detailedAddress?: string;
  contactPhone?: string;

  // 일정 (타입별 분기)
  workDate?: string;              // regular/urgent
  timeSlot?: string;              // 기존 호환용 (deprecated)
  startTime?: string;             // 출근시간
  tournamentDates?: TournamentDay[];  // tournament (deprecated, v2.0에서 dateSpecificRequirements로 대체)
  dateSpecificRequirements?: DateSpecificRequirement[]; // v2.0: 날짜별 요구사항 (regular/urgent/tournament 공통)
  daysPerWeek?: number;           // fixed (0 = 협의, 1-7 = 일수)
  isStartTimeNegotiable?: boolean; // fixed: 출근시간 협의 여부

  // 역할
  roles: RoleRequirement[] | FormRoleWithCount[];

  // 급여
  salary: SalaryInfo;
  allowances?: Allowances;
  taxSettings?: TaxSettings;
  /** @deprecated useSameSalary로 대체 */
  useRoleSalary?: boolean;
  /** 전체 동일 급여 사용 여부 (false = 역할별 급여가 기본) */
  useSameSalary?: boolean;
  roleSalaries?: Record<string, SalaryInfo>;

  // 사전질문
  usesPreQuestions?: boolean;
  preQuestions?: PreQuestion[];

  // 기타
  tags?: string[];
  isUrgent?: boolean;  // deprecated (postingType으로 대체)
}

/**
 * 공고 수정 입력
 */
export type UpdateJobPostingInput = Partial<CreateJobPostingInput> & {
  status?: JobPostingStatus;
};

/**
 * 카드용 역할 정보 (확정인원 포함)
 */
export interface CardRole {
  role: string;
  customRole?: string;
  count: number;
  filled: number;
}

/**
 * 카드용 시간대 정보
 */
export interface CardTimeSlot {
  startTime: string;
  /** 시간 미정 여부 */
  isTimeToBeAnnounced?: boolean;
  roles: CardRole[];
}

/**
 * 카드용 날짜별 정보
 */
export interface CardDateRequirement {
  date: string;
  timeSlots: CardTimeSlot[];
}

/**
 * 공고 카드용 간소화 타입
 */
export interface JobPostingCard {
  id: string;
  title: string;
  location: string;
  // 레거시 호환
  workDate: string;
  timeSlot: string;
  roles: string[];
  // 신규 필드 (v2.0)
  dateRequirements: CardDateRequirement[];
  salary: {
    type: SalaryType;
    amount: number;
  };
  allowances?: Allowances;
  /** 전체 동일 급여 여부 */
  useSameSalary?: boolean;
  /** 역할별 급여 */
  roleSalaries?: Record<string, SalaryInfo>;
  status: JobPostingStatus;
  isUrgent?: boolean;
  applicationCount?: number;
  /** 공고 타입 (v2.0) */
  postingType?: PostingType;
  /** 구인자 이름 */
  ownerName?: string;

  // === 고정공고 전용 필드 ===
  /** 주 출근일수 (0 = 협의, 1-7 = 일수) */
  daysPerWeek?: number;
  /** 출근 시간 (HH:mm) */
  startTime?: string;
  /** 역할별 모집 인원 */
  requiredRolesWithCount?: RoleWithCount[];
}

/**
 * JobPosting을 JobPostingCard로 변환
 */
export const toJobPostingCard = (posting: JobPosting): JobPostingCard => {
  // dateSpecificRequirements → CardDateRequirement 변환
  const dateRequirements: CardDateRequirement[] = (
    posting.dateSpecificRequirements ?? []
  )
    .map((req) => {
      // 날짜 문자열 추출
      let dateStr: string;
      if (typeof req.date === 'string') {
        dateStr = req.date;
      } else if (req.date instanceof Timestamp) {
        dateStr = req.date.toDate().toISOString().split('T')[0] ?? '';
      } else if (req.date && 'seconds' in req.date) {
        dateStr =
          new Date(req.date.seconds * 1000).toISOString().split('T')[0] ?? '';
      } else {
        dateStr = '';
      }

      return {
        date: dateStr,
        timeSlots: (req.timeSlots ?? []).map((ts) => ({
          startTime:
            (ts as { startTime?: string; time?: string }).startTime ||
            (ts as { startTime?: string; time?: string }).time ||
            '',
          isTimeToBeAnnounced:
            (ts as { isTimeToBeAnnounced?: boolean }).isTimeToBeAnnounced ??
            false,
          roles: (ts.roles ?? []).map((r) => ({
            role:
              (r as { role?: string; name?: string }).role ||
              (r as { role?: string; name?: string }).name ||
              '',
            customRole: (r as { customRole?: string }).customRole,
            count:
              (r as { headcount?: number; count?: number }).headcount ||
              (r as { headcount?: number; count?: number }).count ||
              0,
            filled: (r as { filled?: number }).filled ?? 0,
          })),
        })),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // 레거시 데이터 폴백 (dateSpecificRequirements 없을 때)
  if (dateRequirements.length === 0 && posting.workDate) {
    dateRequirements.push({
      date: posting.workDate,
      timeSlots: [
        {
          startTime: posting.timeSlot?.split(/[-~]/)[0]?.trim() || '',
          roles: posting.roles.map((r) => ({
            role: r.role,
            customRole: (r as { customRole?: string }).customRole,
            count: r.count,
            filled: r.filled ?? 0,
          })),
        },
      ],
    });
  }

  return {
    id: posting.id,
    title: posting.title,
    location: posting.location.name,
    workDate: dateRequirements[0]?.date ?? posting.workDate ?? '',
    timeSlot: posting.timeSlot,
    roles: posting.roles.map((r) => r.role),
    dateRequirements,
    salary: {
      type: posting.salary.type,
      amount: posting.salary.amount,
    },
    allowances: posting.allowances,
    useSameSalary: posting.useSameSalary,
    roleSalaries: posting.roleSalaries,
    status: posting.status,
    isUrgent: posting.isUrgent,
    applicationCount: posting.applicationCount,
    postingType: posting.postingType,
    ownerName: posting.ownerName,

    // 고정공고 전용 필드
    daysPerWeek: posting.daysPerWeek,
    startTime:
      posting.workSchedule?.timeSlots?.[0] ||
      posting.timeSlot?.split(/[-~]/)[0]?.trim(),
    requiredRolesWithCount: posting.requiredRolesWithCount,
  };
};

/**
 * UNIQN Mobile - 구인공고 관련 타입 정의
 *
 * @version 2.0.0
 * @description PostingType 4가지 + DateSpecificRequirement + PreQuestion 지원
 */

import { Timestamp } from 'firebase/firestore';
import type { FirebaseDocument, Location } from './common';
import type { StaffRole } from './role';
import type {
  PostingType,
  FixedConfig,
  TournamentConfig,
  UrgentConfig,
  RoleWithCount,
} from './postingConfig';
import type { DateSpecificRequirement } from './jobPosting/dateRequirement';
import { getDateString } from './jobPosting/dateRequirement';
import type { PreQuestion } from './preQuestion';
import type { FormRoleWithCount } from './jobPostingForm';
import type {
  TaxSettings as SettlementTaxSettings,
  TaxType,
  TaxableItems,
} from '@/utils/settlement';

// Re-export for convenience
export type { PostingType } from './postingConfig';

/**
 * 공고 상태
 */
export type JobPostingStatus = 'active' | 'closed' | 'cancelled';

/**
 * 공고 마감 사유
 */
export type ClosedReason = 'manual' | 'expired' | 'expired_by_work_date';

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
 * @description settlement 유틸리티와 동일한 타입 사용
 */
export type TaxSettings = SettlementTaxSettings;
export type { TaxType, TaxableItems };

/**
 * 역할별 모집 통계 (공고에서 사용)
 *
 * @description 공고의 역할별 모집 인원 및 충원 현황 + 급여 정보
 * @see RoleRequirement in types/jobPosting/dateRequirement.ts (폼 편집용)
 */
export interface JobRoleStats {
  role: StaffRole;
  /** 커스텀 역할명 (role이 'other'일 때 사용) */
  customRole?: string;
  count: number;
  filled: number;
  /** 역할별 급여 */
  salary?: SalaryInfo;
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

  // === 일정 정보 (쿼리용 필수 필드) ===
  /**
   * 대표 근무일 (YYYY-MM-DD)
   * @important Firestore 범위 쿼리(>=, <=)에서 필수 사용 - 제거 불가
   * @description dateSpecificRequirements[0].date와 동기화하여 저장
   * @see jobManagementService에서 자동 설정
   */
  workDate: string;
  /**
   * @deprecated dateSpecificRequirements[].timeSlots 사용 권장
   * @description 레거시 시간대 필드 (폴백용으로 유지)
   * @format "18:00 - 02:00" or "18:00~02:00"
   */
  timeSlot: string;

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
  /** 기본 급여 (useSameSalary=true일 때 사용, 또는 폴백용) */
  defaultSalary?: SalaryInfo;
  allowances?: Allowances;
  taxSettings?: TaxSettings;
  /** 전체 동일 급여 사용 여부 (false = 역할별 급여가 기본) */
  useSameSalary?: boolean;
  // 역할별 급여는 roles[].salary에 통합됨

  // === 소유자 정보 ===
  ownerId: string;
  ownerName?: string;

  // === 통계 ===
  viewCount?: number;
  applicationCount?: number;

  // === 마감 정보 ===
  /** 마감 시간 (자동 마감 또는 수동 마감 시 설정) */
  closedAt?: Timestamp;
  /** 마감 사유 */
  closedReason?: ClosedReason;

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
  /** 공고 타입 필터 (단일) */
  postingType?: PostingType;
  /** 공고 타입 필터 (복수) - postingType보다 우선 적용 */
  postingTypes?: PostingType[];
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
  workDate?: string; // regular/urgent
  timeSlot?: string; // 시간대 표시용
  startTime?: string; // 출근시간
  dateSpecificRequirements?: DateSpecificRequirement[]; // 날짜별 요구사항 (regular/urgent/tournament 공통)
  daysPerWeek?: number; // fixed (0 = 협의, 1-7 = 일수)
  isStartTimeNegotiable?: boolean; // fixed: 출근시간 협의 여부

  // 역할 (급여 정보 포함)
  roles: RoleRequirement[] | FormRoleWithCount[];

  // 급여
  /** 기본 급여 (useSameSalary=true일 때 사용) */
  defaultSalary?: SalaryInfo;
  allowances?: Allowances;
  taxSettings?: TaxSettings;
  /** 전체 동일 급여 사용 여부 (false = 역할별 급여가 기본) */
  useSameSalary?: boolean;
  // 역할별 급여는 roles[].salary에 통합됨

  // 사전질문
  usesPreQuestions?: boolean;
  preQuestions?: PreQuestion[];

  // 기타
  tags?: string[];
  isUrgent?: boolean; // deprecated (postingType으로 대체)
}

/**
 * 공고 수정 입력
 */
export type UpdateJobPostingInput = Partial<CreateJobPostingInput> & {
  status?: JobPostingStatus;
};

/**
 * 카드용 역할 정보 (확정인원 + 급여 포함)
 */
export interface CardRole {
  role: string;
  customRole?: string;
  count: number;
  filled: number;
  /** 역할별 급여 */
  salary?: SalaryInfo;
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
  /** 그룹화 여부 (연속 날짜 그룹 표시용) */
  isGrouped?: boolean;
}

/**
 * 공고 카드용 간소화 타입
 */
export interface JobPostingCard {
  id: string;
  title: string;
  /** 공고 설명 */
  description?: string;
  location: string;
  // 레거시 호환
  workDate: string;
  timeSlot: string;
  roles: string[];
  // 신규 필드 (v2.0)
  dateRequirements: CardDateRequirement[];
  /** 기본 급여 (useSameSalary=true일 때 사용) */
  defaultSalary?: SalaryInfo;
  allowances?: Allowances;
  taxSettings?: TaxSettings;
  /** 전체 동일 급여 여부 */
  useSameSalary?: boolean;
  // 역할별 급여는 roles 정보에서 참조 (dateRequirements.timeSlots.roles)
  status: JobPostingStatus;
  isUrgent?: boolean;
  applicationCount?: number;
  /** 공고 타입 (v2.0) */
  postingType?: PostingType;
  /** 구인자 이름 */
  ownerName?: string;
  /** 구인자 연락처 */
  contactPhone?: string;
  /** 구인자 ID */
  ownerId?: string;

  // === 고정공고 전용 필드 ===
  /** 주 출근일수 (0 = 협의, 1-7 = 일수) */
  daysPerWeek?: number;
  /** 출근 시간 (HH:mm) */
  startTime?: string;
  /** 역할별 모집 인원 */
  requiredRolesWithCount?: RoleWithCount[];

  // === 대회공고 전용 필드 ===
  /** 대회 공고 설정 (승인 상태 등) */
  tournamentConfig?: TournamentConfig;
}

// ============================================================================
// Firestore Raw Data Types (레거시 호환)
// ============================================================================

/**
 * Firestore에서 실제로 오는 역할 데이터
 *
 * @description 레거시 데이터에서 필드명이 다를 수 있음:
 * - role/name: 역할 ID
 * - headcount/count: 모집 인원
 */
interface FirestoreRawRoleData {
  role?: string;
  /** @deprecated legacy: role 대신 name 사용 */
  name?: string;
  customRole?: string;
  headcount?: number;
  /** @deprecated legacy: headcount 대신 count 사용 */
  count?: number;
  filled?: number;
  salary?: SalaryInfo;
}

/**
 * Firestore에서 실제로 오는 시간대 데이터
 */
interface FirestoreRawTimeSlotData {
  startTime?: string;
  /** @deprecated legacy: startTime 대신 time 사용 */
  time?: string;
  isTimeToBeAnnounced?: boolean;
  roles?: FirestoreRawRoleData[];
}

// Raw data → 정규화 헬퍼 함수

function extractRoleId(r: FirestoreRawRoleData): string {
  return r.role ?? r.name ?? '';
}

function extractRoleCount(r: FirestoreRawRoleData): number {
  return r.headcount ?? r.count ?? 0;
}

function extractStartTime(ts: FirestoreRawTimeSlotData): string {
  return ts.startTime ?? ts.time ?? '';
}

// ============================================================================
// toJobPostingCard
// ============================================================================

/**
 * JobPosting을 JobPostingCard로 변환
 */
export const toJobPostingCard = (posting: JobPosting): JobPostingCard => {
  // posting.roles에서 역할별 급여 조회 헬퍼
  const getRoleSalary = (roleId: string, customRole?: string): SalaryInfo | undefined => {
    if (roleId === 'other' && customRole) {
      return posting.roles.find((r) => r.role === 'other' && r.customRole === customRole)?.salary;
    }
    return posting.roles.find((r) => r.role === roleId)?.salary;
  };

  // dateSpecificRequirements → CardDateRequirement 변환
  // timeSlots를 FirestoreRawTimeSlotData로 취급 (레거시 필드명 호환)
  const dateRequirements: CardDateRequirement[] = (posting.dateSpecificRequirements ?? [])
    .map((req) => {
      const rawTimeSlots = (req.timeSlots ?? []) as unknown as FirestoreRawTimeSlotData[];

      return {
        date: getDateString(req.date),
        isGrouped: req.isGrouped,
        timeSlots: rawTimeSlots.map((ts) => ({
          startTime: extractStartTime(ts),
          isTimeToBeAnnounced: ts.isTimeToBeAnnounced ?? false,
          roles: (ts.roles ?? []).map((r) => {
            const roleId = extractRoleId(r);
            const resolvedSalary = r.salary ?? getRoleSalary(roleId, r.customRole);

            return {
              role: roleId,
              customRole: r.customRole,
              count: extractRoleCount(r),
              filled: r.filled ?? 0,
              salary: resolvedSalary,
            };
          }),
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
            customRole: r.customRole,
            count: r.count,
            filled: r.filled ?? 0,
            salary: r.salary,
          })),
        },
      ],
    });
  }

  // defaultSalary 결정: 명시적 defaultSalary 또는 첫 번째 역할의 급여
  const resolvedDefaultSalary: SalaryInfo | undefined =
    posting.defaultSalary ?? posting.roles.find((r) => r.salary)?.salary;

  return {
    id: posting.id,
    title: posting.title,
    description: posting.description,
    location: posting.location.name,
    workDate: dateRequirements[0]?.date ?? posting.workDate ?? '',
    timeSlot: posting.timeSlot,
    roles: posting.roles.map((r) => r.role),
    dateRequirements,
    defaultSalary: resolvedDefaultSalary,
    allowances: posting.allowances,
    taxSettings: posting.taxSettings,
    useSameSalary: posting.useSameSalary,
    status: posting.status,
    isUrgent: posting.isUrgent,
    applicationCount: posting.applicationCount,
    postingType: posting.postingType,
    ownerName: posting.ownerName,
    contactPhone: posting.contactPhone,
    ownerId: posting.ownerId,

    // 고정공고 전용 필드
    daysPerWeek: posting.daysPerWeek,
    startTime: posting.timeSlot?.split(/[-~]/)[0]?.trim(),
    requiredRolesWithCount: posting.requiredRolesWithCount,

    // 대회공고 전용 필드
    tournamentConfig: posting.tournamentConfig,
  };
};

/**
 * UNIQN Mobile - job posting domain types
 *
 * @description Canonical job posting entity/document types plus presentation
 * view-model types used by posting surfaces.
 */

import type { FirebaseDocument, Location } from './common';
import type { StaffRole } from './role';
import type {
  PostingType,
  FixedConfig,
  TournamentConfig,
  UrgentConfig,
  RoleWithCount,
} from './postingConfig';
import type { PreQuestion } from './preQuestion';
import type {
  TaxSettings as SettlementTaxSettings,
  TaxType,
  TaxableItems,
} from '@/utils/settlement';

export type { PostingType } from './postingConfig';

export const JOB_POSTING_SCHEMA_VERSION = 3 as const;
export type JobPostingSchemaVersion = typeof JOB_POSTING_SCHEMA_VERSION;

export type JobPostingStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'active'
  | 'capacity_full'
  | 'closed'
  | 'cancelled'
  | 'expired'
  | 'rejected'
  // 운영처(venue) 컨테이너 — 숨김 공고. 공개/운영자 조회는 fail-closed 중앙 deny 로 제외.
  | 'container';
export type ClosedReason = 'manual' | 'expired' | 'expired_by_work_date' | 'filled';
export type SalaryType = 'hourly' | 'daily' | 'monthly' | 'other';

/** 급여 필터가 지원하는 타입 — 'other'(협의)는 금액 비교가 불가해 제외 */
export type FilterableSalaryType = Exclude<SalaryType, 'other'>;

export interface SalaryInfo {
  type: SalaryType;
  amount: number;
}

export interface Allowances {
  guaranteedHours?: number;
  meal?: number;
  transportation?: number;
  accommodation?: number;
}

export type TaxSettings = SettlementTaxSettings;
export type { TaxType, TaxableItems };

export interface JobRoleStats {
  role: StaffRole | 'other';
  customRole?: string;
  count: number;
  filled: number;
  salary?: SalaryInfo;
}

export type RoleRequirement = JobRoleStats;

export interface PostingLocation extends Location {
  detailedAddress?: string;
}

/** 모집 조건 (복장·경력) — 프리셋 문구 또는 직접 입력 */
export interface PostingConditions {
  dressCode?: string;
  experience?: string;
}

export interface PostingRoleCatalogEntry {
  role: StaffRole | 'other';
  customRole?: string;
  salary?: SalaryInfo;
}

export interface PostingSlotRoleRequirement {
  id?: string;
  role?: StaffRole | 'other';
  customRole?: string;
  count: number;
}

export interface PostingTimeSlot {
  id?: string;
  startTime?: string;
  isTimeToBeAnnounced?: boolean;
  tentativeDescription?: string;
  roles: PostingSlotRoleRequirement[];
}

export interface PostingDateRequirement {
  date: string | null;
  timeSlots: PostingTimeSlot[];
  isGrouped?: boolean;
}

export interface PostingDatedSchedule {
  kind: 'dated';
  primaryDate: string;
  allDates: string[];
  requirements: PostingDateRequirement[];
}

export interface PostingFixedSchedule {
  kind: 'fixed';
  daysPerWeek?: number;
  startTime?: string;
  isStartTimeNegotiable?: boolean;
  requirements: PostingDateRequirement[];
}

export type PostingSchedule = PostingDatedSchedule | PostingFixedSchedule;

export interface PostingCompensation {
  mode: 'shared' | 'by_role';
  defaultSalary?: SalaryInfo;
  allowances?: Allowances;
  taxSettings?: TaxSettings;
}

export interface PostingQuestions {
  items: PreQuestion[];
}

export interface JobPostingAggregateStats {
  totalApplicants: number;
  activeApplicants: number;
  confirmedApplicants: number;
  cancellationPendingApplicants: number;
  filledPositions: number;
}

/**
 * Canonical V3 Firestore document shape.
 * Query-critical fields stay top-level for Firestore indexes.
 */
export interface JobPostingDocumentV3 extends FirebaseDocument {
  schemaVersion: JobPostingSchemaVersion;
  title: string;
  description?: string;
  status: JobPostingStatus;
  ownerId: string;
  ownerName?: string;
  /** 워크스페이스 협업 (M1+) — INSERT 시 owner 의 default workspace 자동 주입. M3 에서 NOT NULL */
  workspaceId?: string;
  /**
   * 운영처(venue) 컨테이너 self-FK (주간 배치 그리드). 일반 공고는 미설정(undefined).
   * 컨테이너로 묶인 공고만 보유. DB 컬럼 job_postings.venue_id 와 camelCase 매핑.
   */
  venueId?: string;
  postingType?: PostingType;
  workDate: string;
  workDates?: string[];
  roleKeys?: string[];
  /**
   * 타입별 최대 급여(원) — defaultSalary + roleCatalog 전체의 GREATEST(serialization.getSalaryBounds).
   * 협의(other)만 있으면 null. 급여 필터(gte) 전용 비정규화 컬럼이라 읽기(select)에는 미포함 —
   * null 을 명시 기록해 편집으로 급여 타입이 사라졌을 때 stale 값을 UPDATE 가 지우도록 한다.
   */
  salaryHourlyMax?: number | null;
  salaryDailyMax?: number | null;
  salaryMonthlyMax?: number | null;
  totalPositions: number;
  filledPositions: number;
  viewCount?: number;
  stats?: JobPostingAggregateStats;
  createdAt?: Date;
  updatedAt?: Date;
  closedAt?: Date;
  closedReason?: ClosedReason;
  tags?: string[];
  contactPhone?: string;
  location: PostingLocation;
  schedule: PostingSchedule;
  roleCatalog: PostingRoleCatalogEntry[];
  compensation: PostingCompensation;
  questions: PostingQuestions;
  conditions?: PostingConditions;
  fixedConfig?: FixedConfig;
  tournamentConfig?: TournamentConfig;
  urgentConfig?: UrgentConfig;
}

/** Canonical runtime entity. */
export type JobPostingEntity = JobPostingDocumentV3;

export type JobPosting = JobPostingEntity;
export type SupportedReleasePostingType = Exclude<PostingType, 'fixed'>;
export type SupportedReleasePostingSchedule = PostingDatedSchedule;
export type SupportedReleaseJobPosting = JobPosting & {
  postingType?: SupportedReleasePostingType;
  schedule: SupportedReleasePostingSchedule;
};

export interface PostingFactsPosting extends JobPosting {
  roles: RoleRequirement[];
}

export interface JobPostingFilters {
  status?: JobPostingStatus;
  roles?: StaffRole[];
  district?: string;
  /** 정규화된 지역 slug (src/constants/regions.ts) — location.region 과 eq 매칭 */
  region?: string;
  /**
   * 정규화된 지역 slug 목록 — location.region 과 in 매칭.
   * 그룹 전체/멀티 선택(utils/regionSelection 의 expandRegionTokens 결과).
   * 비어있지 않으면 region(단일)보다 우선한다.
   */
  regions?: string[];
  /**
   * 지역 접두 목록 — location.region 과 like '{접두}%' 매칭.
   * 그룹 전체 선택의 압축 표현(utils/regionSelection 의 expandRegionTokensToScope 결과).
   * regions 와 함께 하나의 OR 스코프를 이룬다 (repository applyRegionScope).
   */
  regionPrefixes?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  /**
   * 급여 필터 — salaryType 의 salary_*_max 컬럼과 salaryMin 을 gte 매칭.
   * 해당 타입 급여 행(default+역할별) "최대값 ≥ 기준" 의미론 — 그 이상 받을 수 있는
   * 역할이 존재하면 노출. 협의(other) 공고는 컬럼 NULL 이라 자연 제외.
   * 두 값이 모두 있어야 적용된다(repository applySalaryScope).
   */
  salaryType?: FilterableSalaryType;
  salaryMin?: number;
  searchTerm?: string;
  isUrgent?: boolean;
  ownerId?: string;
  postingType?: PostingType;
  postingTypes?: PostingType[];
  workDate?: string;
}

export interface JobPostingInput {
  postingType?: 'regular' | 'fixed' | 'tournament' | 'urgent';
  title: string;
  description?: string;
  location: PostingLocation;
  contactPhone?: string;
  /** 운영처(venue) 컨테이너 self-FK (주간 배치 그리드). 일반 공고는 미설정. */
  venueId?: string;
  tags?: string[];
  schedule: PostingSchedule;
  roleCatalog: PostingRoleCatalogEntry[];
  compensation: PostingCompensation;
  questions: PostingQuestions;
  conditions?: PostingConditions;
}

export type CreateJobPostingInput = JobPostingInput;

export type UpdateJobPostingInput = Partial<JobPostingInput> & {
  status?: JobPostingStatus;
};

export interface CardRole {
  id?: string;
  role: string;
  customRole?: string;
  count: number;
  filled: number;
  salary?: SalaryInfo;
}

export interface CardTimeSlot {
  id?: string;
  startTime: string;
  isTimeToBeAnnounced?: boolean;
  tentativeDescription?: string;
  roles: CardRole[];
}

export interface CardDateRequirement {
  date: string;
  timeSlots: CardTimeSlot[];
  isGrouped?: boolean;
}

export interface PostingSalaryRow {
  key: string;
  role: string;
  roleLabel: string;
  customRole?: string;
  salary: SalaryInfo;
  text: string;
}

export interface PostingWorkflow {
  scheduleKind: PostingSchedule['kind'];
  isFixed: boolean;
  isDated: boolean;
  isTournament: boolean;
  isUrgent: boolean;
  recruitmentType: 'fixed' | 'event';
  usesGroupedDateRanges: boolean;
}

export interface PostingRoleAvailabilityItem {
  key: string;
  role: StaffRole | 'other';
  customRole?: string;
  roleLabel: string;
  count: number;
  filled: number;
  remaining: number;
  salary?: SalaryInfo;
  isAvailable: boolean;
}

export interface PostingRoleAvailability {
  items: PostingRoleAvailabilityItem[];
  availableItems: PostingRoleAvailabilityItem[];
  totalCount: number;
  filledCount: number;
  remainingCount: number;
  hasAvailableRoles: boolean;
}

export interface PostingDateGroup {
  id: string;
  startDate: string;
  endDate: string;
  timeSlots: CardTimeSlot[];
}

export interface PostingScheduleDisplay {
  variant: 'fixed' | 'grouped_dates' | 'dated_requirements' | 'legacy';
  dateRequirements: CardDateRequirement[];
  dateGroups: PostingDateGroup[];
  workDate: string;
  timeSlot: string;
  fixed?: {
    daysPerWeek?: number;
    startTime?: string;
    isStartTimeNegotiable?: boolean;
    roles?: RoleWithCount[];
  };
}

export interface PostingCardDisplayContext {
  focusedDate?: string;
  wasGroupedRange?: boolean;
}

export interface PostingSalaryDisplay {
  defaultSalary?: SalaryInfo;
  rows: PostingSalaryRow[];
  previewRows: PostingSalaryRow[];
  overflowCount: number;
  useSameSalary: boolean;
  hasRoleSpecificSalary: boolean;
}

export interface PostingApplicationEligibility {
  canApply: boolean;
  selectionMode: 'fixed_role' | 'dated_assignment';
  requiresRoleSelection: boolean;
  requiresAssignmentSelection: boolean;
  requiresPreQuestions: boolean;
  fixedAssignmentTimeSlot: string;
  availableRoleOptions: PostingRoleAvailabilityItem[];
  reason?: 'inactive' | 'posting_full' | 'role_full' | 'unsupported_workflow';
}

export interface PostingSettlementContext {
  roles: JobRoleStats[];
  defaultSalary?: SalaryInfo;
  allowances?: PostingCompensation['allowances'];
  taxSettings?: PostingCompensation['taxSettings'];
}

export interface PostingFacts {
  posting: PostingFactsPosting;
  title: string;
  description?: string;
  status: JobPostingStatus;
  postingType?: PostingType;
  isUrgent: boolean;
  workflow: PostingWorkflow;
  location: {
    shortLabel: string;
    fullLabel: string;
    /** 구조화 지역 표시 라벨(예: '강남구'). region slug 미설정 시 undefined. */
    regionLabel?: string;
  };
  owner: {
    id: string;
    name?: string;
    contactPhone?: string;
  };
  schedule: {
    kind: PostingSchedule['kind'];
    workDate: string;
    timeSlot: string;
    dateRequirements: CardDateRequirement[];
    daysPerWeek?: number;
    startTime?: string;
    isStartTimeNegotiable?: boolean;
    requiredRolesWithCount?: RoleWithCount[];
    display: PostingScheduleDisplay;
  };
  compensation: {
    mode: PostingCompensation['mode'];
    defaultSalary?: SalaryInfo;
    salaryRows: PostingSalaryRow[];
    allowanceLabels: string[];
    taxLabel?: string;
    display: PostingSalaryDisplay;
  };
  roleAvailability: PostingRoleAvailability;
  application: PostingApplicationEligibility;
  stats: {
    totalPositions: number;
    filledPositions: number;
    totalApplicants: number;
    activeApplicants: number;
    confirmedApplicants: number;
    cancellationPendingApplicants: number;
  };
  questions: {
    items: PreQuestion[];
    enabled: boolean;
  };
  tournamentConfig?: TournamentConfig;
}

export type PostingAudience = 'public' | 'employer' | 'admin';
export type PostingSurface = 'card' | 'detail' | 'manage';

export interface PostingCardViewModel {
  id: string;
  title: string;
  description?: string;
  workflow: PostingWorkflow;
  location: string;
  fullLocation: string;
  /** 구조화 지역 표시 라벨(예: '강남구'). region slug 미설정 시 undefined. */
  regionLabel?: string;
  workDate: string;
  timeSlot: string;
  roles: string[];
  dateRequirements: CardDateRequirement[];
  defaultSalary?: SalaryInfo;
  allowances?: Allowances;
  allowanceLabels: string[];
  taxSettings?: TaxSettings;
  taxLabel?: string;
  useSameSalary?: boolean;
  status: JobPostingStatus;
  isUrgent?: boolean;
  totalApplicants?: number;
  postingType?: PostingType;
  ownerName?: string;
  contactPhone?: string;
  ownerId?: string;
  daysPerWeek?: number;
  startTime?: string;
  requiredRolesWithCount?: RoleWithCount[];
  tournamentConfig?: TournamentConfig;
  salaryRows: PostingSalaryRow[];
  fullSalaryRows?: PostingSalaryRow[];
  salaryOverflowCount: number;
  scheduleDisplay: PostingScheduleDisplay;
  salaryDisplay: PostingSalaryDisplay;
  roleAvailability: PostingRoleAvailability;
  applicationEligibility: PostingApplicationEligibility;
  displayContext?: PostingCardDisplayContext;
}

export interface PostingDetailViewModel {
  id: string;
  title: string;
  description?: string;
  workflow: PostingWorkflow;
  status: JobPostingStatus;
  postingType?: PostingType;
  isUrgent: boolean;
  locationLabel: string;
  /** 구조화 지역 표시 라벨(예: '강남구'). region slug 미설정 시 undefined. */
  regionLabel?: string;
  contactPhone?: string;
  workDate: string;
  timeSlot: string;
  dateRequirements: CardDateRequirement[];
  daysPerWeek?: number;
  startTime?: string;
  isStartTimeNegotiable?: boolean;
  requiredRolesWithCount?: RoleWithCount[];
  salaryRows: PostingSalaryRow[];
  defaultSalary?: SalaryInfo;
  useSameSalary?: boolean;
  allowances?: Allowances;
  allowanceLabels: string[];
  taxSettings?: TaxSettings;
  taxLabel?: string;
  questions: PreQuestion[];
  ownerName?: string;
  ownerId?: string;
  totalApplicants?: number;
  viewCount?: number;
  totalPositions: number;
  filledPositions: number;
  tournamentConfig?: TournamentConfig;
  scheduleDisplay: PostingScheduleDisplay;
  salaryDisplay: PostingSalaryDisplay;
  roleAvailability: PostingRoleAvailability;
  applicationEligibility: PostingApplicationEligibility;
}

export interface PostingManagementViewModel extends PostingDetailViewModel {
  confirmedApplicants: number;
  pendingApplicants: number;
  totalApplicants: number;
}

export interface PostingRuntimeSnapshot {
  title: string;
  location: string;
  detailedAddress?: string;
  roles: RoleRequirement[];
  defaultSalary?: SalaryInfo;
  allowances?: Allowances;
  taxSettings?: TaxSettings;
  useSameSalary?: boolean;
  dateRequirements: CardDateRequirement[];
  questions: PreQuestion[];
  requiredRolesWithCount?: RoleWithCount[];
  daysPerWeek?: number;
  startTime?: string;
  isStartTimeNegotiable?: boolean;
  workDate: string;
  timeSlot: string;
}

/**
 * Legacy compatibility alias. The list surface should migrate to
 * PostingCardViewModel over time.
 */
export type JobPostingCard = PostingCardViewModel;

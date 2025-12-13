/**
 * UNIQN Mobile - 구인공고 관련 타입 정의
 *
 * @version 1.0.0
 */

import { Timestamp } from 'firebase/firestore';
import { FirebaseDocument, Location, StaffRole } from './common';

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
 */
export interface JobPosting extends FirebaseDocument {
  // 기본 정보
  title: string;
  description?: string;
  status: JobPostingStatus;

  // 장소 정보
  location: Location;
  detailedAddress?: string;
  contactPhone?: string;

  // 일정 정보
  workDate: string; // YYYY-MM-DD
  timeSlot: string; // "18:00 - 02:00" or "18:00~02:00"
  startTime?: Timestamp;
  endTime?: Timestamp;

  // 모집 정보
  roles: RoleRequirement[];
  totalPositions: number;
  filledPositions: number;

  // 급여 정보
  salary: SalaryInfo;
  allowances?: Allowances;
  taxSettings?: TaxSettings;

  // 소유자 정보
  ownerId: string;
  ownerName?: string;

  // 통계
  viewCount?: number;
  applicationCount?: number;

  // 메타데이터
  tags?: string[];
  isUrgent?: boolean;
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

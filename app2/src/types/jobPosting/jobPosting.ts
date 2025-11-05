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
}

/**
 * Job Posting 기본 인터페이스
 */
export interface JobPosting {
  id: string;
  title: string;
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
  recruitmentType?: 'application' | 'fixed';
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
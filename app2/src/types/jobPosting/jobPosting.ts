import { Timestamp } from 'firebase/firestore';
import { 
  TimeSlot, 
  DateSpecificRequirement, 
  ConfirmedStaff, 
  PreQuestion, 
  Benefits 
} from './base';

/**
 * 공고 작성/수정 폼 데이터 타입
 */
export interface JobPostingFormData {
  title: string;
  type: string;
  description: string;
  location: string;
  detailedAddress?: string;
  district?: string;       // 시/군/구
  startDate: string;
  endDate: string;
  status: 'open' | 'closed';
  dateSpecificRequirements: DateSpecificRequirement[];
  preQuestions?: PreQuestion[];
  requiredRoles?: string[];
  salaryType?: 'hourly' | 'daily' | 'monthly' | 'other'; // 급여 유형
  salaryAmount?: string;    // 급여 금액
  benefits?: Benefits;       // 복리후생 정보
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
  startDate: Timestamp | string;
  endDate: Timestamp | string;
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
  salaryType?: 'hourly' | 'daily' | 'monthly' | 'other';
  salaryAmount?: string;
  
  // 복리후생 정보
  benefits?: Benefits;
  
  // 자동 관리 기능 플래그
  autoManageStatus?: boolean; // 자동 상태 관리 활성화 여부
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
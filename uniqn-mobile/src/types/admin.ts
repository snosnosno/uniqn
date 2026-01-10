/**
 * UNIQN Mobile - Admin 관련 타입 정의
 *
 * @description 관리자 기능에서 사용하는 타입들
 * @version 1.0.0
 */

import type { UserRole } from './common';

// ============================================================================
// User Types (Admin View)
// ============================================================================

/**
 * 관리자가 보는 사용자 기본 정보
 */
export interface AdminUser {
  id: string;
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  photoURL?: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  isActive: boolean;
  isVerified: boolean;
}

/**
 * 사용자 상세 프로필 (관리자용 확장)
 */
export interface AdminUserProfile extends AdminUser {
  // 기본 정보
  nickname?: string;
  nationality?: string;
  age?: number;

  // 경력 정보
  experience?: string;
  specialties?: string[];

  // 금융 정보
  bankName?: string;
  bankAccount?: string;

  // 관리자 메모
  adminNotes?: string;
  history?: string;

  // 통계
  totalApplications?: number;
  completedJobs?: number;
  cancelledJobs?: number;
  averageRating?: number;

  // 패널티 정보
  penalties?: AdminPenalty[];
  penaltyCount?: number;
}

/**
 * 패널티 정보
 */
export interface AdminPenalty {
  id: string;
  userId: string;
  type: PenaltyType;
  reason: string;
  startDate: Date;
  endDate?: Date;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
}

/**
 * 패널티 타입
 */
export type PenaltyType = 'warning' | 'suspension' | 'ban';

/**
 * 패널티 타입 레이블
 */
export const PENALTY_TYPE_LABELS: Record<PenaltyType, string> = {
  warning: '경고',
  suspension: '정지',
  ban: '영구 정지',
};

// ============================================================================
// User Search & Filter
// ============================================================================

/**
 * 사용자 검색 필터
 */
export interface AdminUserFilters {
  search?: string;
  role?: UserRole | 'all';
  isActive?: boolean;
  isVerified?: boolean;
  sortBy?: AdminUserSortField;
  sortOrder?: 'asc' | 'desc';
}

/**
 * 정렬 가능 필드
 */
export type AdminUserSortField =
  | 'name'
  | 'email'
  | 'role'
  | 'createdAt'
  | 'lastLoginAt';

/**
 * 정렬 필드 레이블
 */
export const ADMIN_USER_SORT_LABELS: Record<AdminUserSortField, string> = {
  name: '이름',
  email: '이메일',
  role: '역할',
  createdAt: '가입일',
  lastLoginAt: '최근 로그인',
};

// ============================================================================
// User Update
// ============================================================================

/**
 * 사용자 역할 변경 요청
 */
export interface UpdateUserRoleInput {
  userId: string;
  newRole: UserRole;
  reason?: string;
}

/**
 * 사용자 정보 수정 요청
 */
export interface UpdateUserInput {
  userId: string;
  updates: Partial<{
    name: string;
    phone: string;
    role: UserRole;
    isActive: boolean;
    adminNotes: string;
  }>;
}

/**
 * 패널티 부여 요청
 */
export interface CreatePenaltyInput {
  userId: string;
  type: PenaltyType;
  reason: string;
  duration?: number; // 일 단위 (null = 영구)
}

// ============================================================================
// Constants
// ============================================================================

/**
 * 역할 레이블
 */
export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: '관리자',
  employer: '구인자',
  staff: '스태프',
};

/**
 * 역할 배지 색상
 */
export const USER_ROLE_BADGE_VARIANT: Record<
  UserRole,
  'default' | 'primary' | 'success' | 'warning' | 'error'
> = {
  admin: 'error',
  employer: 'primary',
  staff: 'success',
};

/**
 * 국가 목록
 */
export const COUNTRIES = [
  { code: 'KR', name: '대한민국', flag: '🇰🇷' },
  { code: 'US', name: '미국', flag: '🇺🇸' },
  { code: 'JP', name: '일본', flag: '🇯🇵' },
  { code: 'CN', name: '중국', flag: '🇨🇳' },
  { code: 'GB', name: '영국', flag: '🇬🇧' },
  { code: 'DE', name: '독일', flag: '🇩🇪' },
  { code: 'FR', name: '프랑스', flag: '🇫🇷' },
  { code: 'CA', name: '캐나다', flag: '🇨🇦' },
  { code: 'AU', name: '호주', flag: '🇦🇺' },
  { code: 'TH', name: '태국', flag: '🇹🇭' },
  { code: 'VN', name: '베트남', flag: '🇻🇳' },
  { code: 'PH', name: '필리핀', flag: '🇵🇭' },
  { code: 'MY', name: '말레이시아', flag: '🇲🇾' },
  { code: 'SG', name: '싱가포르', flag: '🇸🇬' },
] as const;

/**
 * 국가 코드로 국가 정보 찾기
 */
export function getCountryByCode(code: string) {
  return COUNTRIES.find((c) => c.code === code);
}

// ============================================================================
// Dashboard Types
// ============================================================================

/**
 * 대시보드 통계
 */
export interface DashboardStats {
  /** 총 사용자 수 */
  totalUsers: number;
  /** 오늘 신규 가입자 수 */
  newUsersToday: number;
  /** 활성 공고 수 */
  activeJobPostings: number;
  /** 오늘 지원 수 */
  applicationsToday: number;
  /** 미처리 신고 수 */
  pendingReports: number;
  /** 역할별 사용자 수 */
  usersByRole: {
    admin: number;
    employer: number;
    staff: number;
  };
  /** 최근 가입자 목록 (최대 5명) */
  recentUsers: AdminUser[];
  /** 데이터 조회 시점 */
  fetchedAt: Date;
}

/**
 * 페이지네이션된 사용자 목록
 */
export interface PaginatedUsers {
  /** 사용자 목록 */
  users: AdminUser[];
  /** 전체 개수 */
  total: number;
  /** 현재 페이지 (1부터 시작) */
  page: number;
  /** 페이지당 개수 */
  pageSize: number;
  /** 전체 페이지 수 */
  totalPages: number;
  /** 다음 페이지 존재 여부 */
  hasNextPage: boolean;
  /** 이전 페이지 존재 여부 */
  hasPrevPage: boolean;
}

/**
 * 시스템 메트릭스
 */
export interface SystemMetrics {
  /** 일별 활성 사용자 (최근 7일) */
  dailyActiveUsers: { date: string; count: number }[];
  /** 일별 신규 가입자 (최근 7일) */
  dailySignups: { date: string; count: number }[];
  /** 일별 지원 수 (최근 7일) */
  dailyApplications: { date: string; count: number }[];
  /** 시스템 상태 */
  systemStatus: 'healthy' | 'degraded' | 'down';
  /** 조회 시점 */
  fetchedAt: Date;
}

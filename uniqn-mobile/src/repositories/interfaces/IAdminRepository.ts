/**
 * UNIQN Mobile - Admin Repository Interface
 *
 * @description 관리자(Admin) 관련 데이터 접근 추상화
 * @version 1.0.0
 *
 * 이 인터페이스의 목적:
 * 1. Firebase 직접 의존 제거 → 테스트 용이성
 * 2. 관리자 쿼리 캡슐화 → 데이터 접근 일관성
 * 3. 향후 백엔드 교체 가능성 확보
 */

import type { AdminUser, AdminUserFilters, PaginatedUsers } from '@/types/admin';
import type { UserRole } from '@/types/common';

// ============================================================================
// Types
// ============================================================================

/**
 * 대시보드 카운트 결과
 */
export interface DashboardCounts {
  totalUsers: number;
  newUsersToday: number;
  activeJobPostings: number;
  applicationsToday: number;
  pendingReports: number;
  adminCount: number;
  employerCount: number;
  staffCount: number;
}

/**
 * 일별 카운트 데이터
 */
export interface DailyCount {
  date: string;
  count: number;
}

/**
 * 시스템 메트릭스 원시 데이터
 */
export interface SystemMetricsData {
  dailySignups: DailyCount[];
  dailyApplications: DailyCount[];
  isHealthy: boolean;
}

// ============================================================================
// Interface
// ============================================================================

/**
 * Admin Repository 인터페이스
 *
 * 구현체:
 * - FirebaseAdminRepository (프로덕션)
 * - MockAdminRepository (테스트)
 */
export interface IAdminRepository {
  // ==========================================================================
  // 대시보드 (Dashboard)
  // ==========================================================================

  /**
   * 대시보드 카운트 조회
   *
   * @description 여러 컬렉션의 문서 수를 집계합니다.
   * - users: 전체, 오늘 가입, 역할별
   * - jobPostings: 활성 공고
   * - applications: 오늘 지원
   * - reports: 미처리 신고
   *
   * @returns 대시보드 카운트
   */
  getDashboardCounts(): Promise<DashboardCounts>;

  /**
   * 최근 가입 사용자 조회
   *
   * @param limitCount - 조회할 최대 수 (기본 5)
   * @returns 최근 가입 사용자 목록
   */
  getRecentUsers(limitCount?: number): Promise<AdminUser[]>;

  // ==========================================================================
  // 사용자 관리 (User Management)
  // ==========================================================================

  /**
   * 사용자 목록 조회 (페이지네이션)
   *
   * @param filters - 검색/필터 조건
   * @param page - 페이지 번호 (1부터 시작)
   * @param pageSize - 페이지 크기
   * @returns 페이지네이션된 사용자 목록
   */
  getUsers(filters?: AdminUserFilters, page?: number, pageSize?: number): Promise<PaginatedUsers>;

  /**
   * ID로 사용자 조회
   *
   * @param userId - 사용자 ID
   * @returns 사용자 정보 또는 null
   */
  getUserById(userId: string): Promise<AdminUser | null>;

  /**
   * 사용자 역할 변경
   *
   * @param userId - 사용자 ID
   * @param newRole - 새 역할
   * @returns 이전 역할
   * @throws BusinessError - 사용자 없음
   */
  updateUserRole(userId: string, newRole: UserRole): Promise<string | undefined>;

  /**
   * 사용자 활성 상태 변경
   *
   * @param userId - 사용자 ID
   * @param isActive - 활성 여부
   * @throws BusinessError - 사용자 없음
   */
  setUserActive(userId: string, isActive: boolean): Promise<void>;

  // ==========================================================================
  // 시스템 메트릭스 (System Metrics)
  // ==========================================================================

  /**
   * 시스템 메트릭스 조회
   *
   * @description 최근 7일간의 가입자/지원 수 추이 및 시스템 상태
   * @returns 시스템 메트릭스 원시 데이터
   */
  getSystemMetrics(): Promise<SystemMetricsData>;
}

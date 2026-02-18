/**
 * UNIQN Mobile - Admin Service
 *
 * @description 관리자 대시보드 및 사용자 관리 서비스
 * @version 2.0.0
 *
 * Repository 패턴 적용:
 * - Firebase 직접 호출 제거
 * - adminRepository를 통한 데이터 접근
 */

import { logger } from '@/utils/logger';
import { BusinessError, ERROR_CODES } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { adminRepository } from '@/repositories';
import type {
  AdminUser,
  AdminUserFilters,
  DashboardStats,
  PaginatedUsers,
  SystemMetrics,
} from '@/types/admin';
import type { UserRole } from '@/types/role';

// ============================================================================
// Dashboard Stats
// ============================================================================

export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    logger.info('대시보드 통계 조회 시작');

    const [counts, recentUsers] = await Promise.all([
      adminRepository.getDashboardCounts(),
      adminRepository.getRecentUsers(5),
    ]);

    const stats: DashboardStats = {
      totalUsers: counts.totalUsers,
      newUsersToday: counts.newUsersToday,
      activeJobPostings: counts.activeJobPostings,
      applicationsToday: counts.applicationsToday,
      pendingReports: counts.pendingReports,
      usersByRole: {
        admin: counts.adminCount,
        employer: counts.employerCount,
        staff: counts.staffCount,
      },
      recentUsers,
      fetchedAt: new Date(),
    };

    logger.info('대시보드 통계 조회 완료', { totalUsers: stats.totalUsers });
    return stats;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '대시보드 통계 조회',
      component: 'adminService',
    });
  }
}

// ============================================================================
// User Management
// ============================================================================

export async function getUsers(
  filters: AdminUserFilters = {},
  page: number = 1,
  pageSize: number = 20
): Promise<PaginatedUsers> {
  try {
    logger.info('사용자 목록 조회', { filters, page, pageSize });

    const result = await adminRepository.getUsers(filters, page, pageSize);

    logger.info('사용자 목록 조회 완료', {
      total: result.total,
      returned: result.users.length,
    });
    return result;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '사용자 목록 조회',
      component: 'adminService',
      context: { filters, page, pageSize },
    });
  }
}

export async function getUserById(userId: string): Promise<AdminUser> {
  try {
    logger.info('사용자 조회', { userId });

    const user = await adminRepository.getUserById(userId);

    if (!user) {
      throw new BusinessError(ERROR_CODES.AUTH_USER_NOT_FOUND, {
        userMessage: '사용자를 찾을 수 없습니다',
        metadata: { userId },
      });
    }

    logger.info('사용자 조회 완료', { userId, userName: user.name });
    return user;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '사용자 조회',
      component: 'adminService',
      context: { userId },
    });
  }
}

export async function updateUserRole(
  userId: string,
  newRole: UserRole,
  reason?: string
): Promise<void> {
  try {
    logger.info('사용자 역할 변경', { userId, newRole, reason });

    const previousRole = await adminRepository.updateUserRole(userId, newRole);

    logger.info('사용자 역할 변경 완료', {
      userId,
      previousRole,
      newRole,
      reason,
    });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '사용자 역할 변경',
      component: 'adminService',
      context: { userId, newRole },
    });
  }
}

export async function setUserActive(
  userId: string,
  isActive: boolean,
  reason?: string
): Promise<void> {
  try {
    logger.info('사용자 상태 변경', { userId, isActive, reason });

    await adminRepository.setUserActive(userId, isActive);

    logger.info('사용자 상태 변경 완료', { userId, isActive, reason });
  } catch (error) {
    throw handleServiceError(error, {
      operation: '사용자 상태 변경',
      component: 'adminService',
      context: { userId, isActive },
    });
  }
}

// ============================================================================
// System Metrics
// ============================================================================

export async function getSystemMetrics(): Promise<SystemMetrics> {
  try {
    logger.info('시스템 메트릭스 조회 시작');

    const metricsData = await adminRepository.getSystemMetrics();

    // DAU 데이터는 현재 미구현 - 날짜만 채워서 반환
    const dailyActiveUsers = metricsData.dailySignups.map((entry) => ({
      date: entry.date,
      count: 0,
    }));

    const systemStatus: 'healthy' | 'degraded' | 'down' = metricsData.isHealthy
      ? 'healthy'
      : 'degraded';

    const metrics: SystemMetrics = {
      dailyActiveUsers,
      dailySignups: metricsData.dailySignups,
      dailyApplications: metricsData.dailyApplications,
      systemStatus,
      fetchedAt: new Date(),
    };

    logger.info('시스템 메트릭스 조회 완료', {
      daysCount: 7,
      systemStatus,
    });
    return metrics;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '시스템 메트릭스 조회',
      component: 'adminService',
    });
  }
}

// ============================================================================
// Service Export
// ============================================================================

export const adminService = {
  getDashboardStats,
  getUsers,
  getUserById,
  updateUserRole,
  setUserActive,
  getSystemMetrics,
};

export default adminService;

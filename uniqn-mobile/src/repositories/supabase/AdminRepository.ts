/**
 * UNIQN Mobile - Supabase Admin Repository
 *
 * @description Supabase PostgREST 기반 Admin Repository 구현
 * @version 1.0.0
 *
 * 책임:
 * 1. 대시보드 집계 쿼리
 * 2. 사용자 관리 (역할 변경, 활성 상태 변경)
 * 3. 시스템 메트릭스 조회
 */

import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { BusinessError, ERROR_CODES, toError, isAppError } from '@/errors';
import { handleSupabaseError, runRpc } from '@/utils/supabase';
import type {
  IAdminRepository,
  DashboardCounts,
  SystemMetricsData,
  DailyCount,
} from '../interfaces';
import type { AdminUser, AdminUserFilters, PaginatedUsers } from '@/types/admin';
import type { UserRole } from '@/types/role';

// ============================================================================
// Constants
// ============================================================================

const TABLES = {
  USERS: 'users',
  JOB_POSTINGS: 'job_postings',
  APPLICATIONS: 'applications',
  REPORTS: 'reports',
} as const;
const USER_COLUMNS =
  'id,name,email,role,phone,photo_url,photo_url_blurhash,created_at,updated_at,is_active,phone_verified' as const;

// ============================================================================
// Helpers
// ============================================================================

function rowToAdminUser(row: Record<string, unknown>): AdminUser {
  return {
    id: row.id as string,
    uid: (row.id as string) ?? '',
    name: (row.name as string) ?? '',
    email: (row.email as string) ?? '',
    role: ((row.role as string) ?? 'staff') as UserRole,
    phone: row.phone as string | undefined,
    photoURL: row.photo_url as string | undefined,
    photoURLBlurhash: (row.photo_url_blurhash as string | null | undefined) ?? null,
    createdAt: row.created_at ? new Date(row.created_at as string) : new Date(),
    updatedAt: row.updated_at ? new Date(row.updated_at as string) : new Date(),
    isActive: row.is_active !== false,
    isVerified: row.phone_verified === true,
  };
}

function getTodayRange(): { start: string; end: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return {
    start: today.toISOString(),
    end: tomorrow.toISOString(),
  };
}

// ============================================================================
// Repository Implementation
// ============================================================================

export class SupabaseAdminRepository implements IAdminRepository {
  // ==========================================================================
  // 대시보드 (Dashboard)
  // ==========================================================================

  async getDashboardCounts(): Promise<DashboardCounts> {
    try {
      logger.info('대시보드 카운트 조회');
      const { start, end } = getTodayRange();

      const [
        totalUsersResult,
        newUsersTodayResult,
        activeJobsResult,
        applicationsTodayResult,
        pendingReportsResult,
        adminCountResult,
        employerCountResult,
        staffCountResult,
      ] = await Promise.all([
        supabase.from(TABLES.USERS).select('id', { count: 'exact', head: true }),
        supabase
          .from(TABLES.USERS)
          .select('id', { count: 'exact', head: true })
          .gte('created_at', start)
          .lt('created_at', end),
        supabase
          .from(TABLES.JOB_POSTINGS)
          .select('id', { count: 'exact', head: true })
          .eq('status', 'active'),
        supabase
          .from(TABLES.APPLICATIONS)
          .select('id', { count: 'exact', head: true })
          .gte('created_at', start)
          .lt('created_at', end),
        supabase
          .from(TABLES.REPORTS)
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending'),
        supabase
          .from(TABLES.USERS)
          .select('id', { count: 'exact', head: true })
          .eq('role', 'admin'),
        supabase
          .from(TABLES.USERS)
          .select('id', { count: 'exact', head: true })
          .eq('role', 'employer'),
        supabase
          .from(TABLES.USERS)
          .select('id', { count: 'exact', head: true })
          .eq('role', 'staff'),
      ]);

      const counts: DashboardCounts = {
        totalUsers: totalUsersResult.count ?? 0,
        newUsersToday: newUsersTodayResult.count ?? 0,
        activeJobPostings: activeJobsResult.count ?? 0,
        applicationsToday: applicationsTodayResult.count ?? 0,
        pendingReports: pendingReportsResult.count ?? 0,
        adminCount: adminCountResult.count ?? 0,
        employerCount: employerCountResult.count ?? 0,
        staffCount: staffCountResult.count ?? 0,
      };

      logger.info('대시보드 카운트 조회 완료', { totalUsers: counts.totalUsers });
      return counts;
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('대시보드 카운트 조회 실패', toError(error));
      handleSupabaseError(error, { operation: '대시보드 카운트 조회', table: TABLES.USERS });
    }
  }

  async getRecentUsers(limitCount: number = 5): Promise<AdminUser[]> {
    try {
      logger.info('최근 가입 사용자 조회', { limitCount });

      const { data, error } = await supabase
        .from(TABLES.USERS)
        .select(USER_COLUMNS)
        .order('created_at', { ascending: false })
        .limit(limitCount);

      if (error) {
        handleSupabaseError(error, { operation: '최근 가입 사용자 조회', table: TABLES.USERS });
      }

      const users = ((data ?? []) as Record<string, unknown>[]).map(rowToAdminUser);

      logger.info('최근 가입 사용자 조회 완료', { count: users.length });
      return users;
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('최근 가입 사용자 조회 실패', toError(error));
      handleSupabaseError(error, { operation: '최근 가입 사용자 조회', table: TABLES.USERS });
    }
  }

  // ==========================================================================
  // 사용자 관리 (User Management)
  // ==========================================================================

  async getUsers(
    filters: AdminUserFilters = {},
    page: number = 1,
    pageSize: number = 20
  ): Promise<PaginatedUsers> {
    try {
      logger.info('사용자 목록 조회', { filters, page, pageSize });

      let query = supabase.from(TABLES.USERS).select(USER_COLUMNS, { count: 'exact' });

      if (filters.role && filters.role !== 'all') {
        query = query.eq('role', filters.role);
      }
      if (filters.isActive !== undefined) {
        query = query.eq('is_active', filters.isActive);
      }
      if (filters.isVerified !== undefined) {
        query = query.eq('phone_verified', filters.isVerified);
      }

      const sortField = filters.sortBy ?? 'created_at';
      const sortOrder = filters.sortOrder ?? 'desc';
      const snakeSortField = sortField.replace(/[A-Z]/g, (ch: string) => `_${ch.toLowerCase()}`);
      query = query.order(snakeSortField, { ascending: sortOrder === 'asc' });

      // 페이지네이션 (range)
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        handleSupabaseError(error, { operation: '사용자 목록 조회', table: TABLES.USERS });
      }

      let users = ((data ?? []) as Record<string, unknown>[]).map(rowToAdminUser);

      // 클라이언트 사이드 검색 필터
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        users = users.filter(
          (u) =>
            u.name.toLowerCase().includes(searchLower) ||
            u.email.toLowerCase().includes(searchLower)
        );
      }

      const total = count ?? 0;
      const totalPages = Math.ceil(total / pageSize);

      const result: PaginatedUsers = {
        users,
        total,
        page,
        pageSize,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      };

      logger.info('사용자 목록 조회 완료', { total, returned: users.length });
      return result;
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('사용자 목록 조회 실패', toError(error), { filters, page, pageSize });
      handleSupabaseError(error, { operation: '사용자 목록 조회', table: TABLES.USERS });
    }
  }

  async getUserById(userId: string): Promise<AdminUser | null> {
    try {
      logger.info('사용자 조회', { userId });

      const { data, error } = await supabase
        .from(TABLES.USERS)
        .select(USER_COLUMNS)
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        handleSupabaseError(error, { operation: '사용자 조회', table: TABLES.USERS });
      }

      if (!data) return null;

      const user = rowToAdminUser(data as Record<string, unknown>);
      logger.info('사용자 조회 완료', { userId, userName: user.name });
      return user;
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('사용자 조회 실패', toError(error), { userId });
      handleSupabaseError(error, { operation: '사용자 조회', table: TABLES.USERS });
    }
  }

  async updateUserRole(userId: string, newRole: UserRole): Promise<string | undefined> {
    try {
      logger.info('사용자 역할 변경', { userId, newRole });

      const result = await runRpc<{ previous_role: string | null }>('update_user_role', {
        p_user_id: userId,
        p_new_role: newRole,
      });

      const previousRole = result.previous_role ?? undefined;

      logger.info('사용자 역할 변경 완료', { userId, previousRole, newRole });
      return previousRole;
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('사용자 역할 변경 실패', toError(error), { userId, newRole });
      handleSupabaseError(error, { operation: '사용자 역할 변경', table: TABLES.USERS });
    }
  }

  async setUserActive(userId: string, isActive: boolean): Promise<void> {
    try {
      logger.info('사용자 상태 변경', { userId, isActive });

      const { data, error } = await supabase
        .from(TABLES.USERS)
        .update({
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .select('id');

      if (error) {
        handleSupabaseError(error, { operation: '사용자 상태 변경', table: TABLES.USERS });
      }

      if (!data || data.length === 0) {
        throw new BusinessError(ERROR_CODES.INFRA_NOT_FOUND, {
          userMessage: '사용자를 찾을 수 없습니다',
          metadata: { userId },
        });
      }

      logger.info('사용자 상태 변경 완료', { userId, isActive });
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('사용자 상태 변경 실패', toError(error), { userId, isActive });
      handleSupabaseError(error, { operation: '사용자 상태 변경', table: TABLES.USERS });
    }
  }

  // ==========================================================================
  // 시스템 메트릭스 (System Metrics)
  // ==========================================================================

  async getSystemMetrics(): Promise<SystemMetricsData> {
    try {
      logger.info('시스템 메트릭스 조회');
      const dates: string[] = [];
      const dateRanges: { start: string; end: string }[] = [];

      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        dates.push(date.toISOString().split('T')[0]);
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);
        dateRanges.push({ start: date.toISOString(), end: endDate.toISOString() });
      }

      const [signupsData, applicationsData] = await Promise.all([
        Promise.all(
          dateRanges.map(async ({ start, end }, i) => {
            const { count, error } = await supabase
              .from(TABLES.USERS)
              .select('id', { count: 'exact', head: true })
              .gte('created_at', start)
              .lte('created_at', end);

            if (error) {
              logger.warn('가입자 통계 조회 실패', { date: dates[i] });
              return { date: dates[i], count: 0 } as DailyCount;
            }

            return { date: dates[i], count: count ?? 0 } as DailyCount;
          })
        ),
        Promise.all(
          dateRanges.map(async ({ start, end }, i) => {
            const { count, error } = await supabase
              .from(TABLES.APPLICATIONS)
              .select('id', { count: 'exact', head: true })
              .gte('created_at', start)
              .lte('created_at', end);

            if (error) {
              logger.warn('지원 통계 조회 실패', { date: dates[i] });
              return { date: dates[i], count: 0 } as DailyCount;
            }

            return { date: dates[i], count: count ?? 0 } as DailyCount;
          })
        ),
      ]);

      // 시스템 상태 체크 (간단 조회로 확인)
      let isHealthy = true;
      try {
        const { error } = await supabase.from(TABLES.USERS).select('id').limit(1);
        if (error) isHealthy = false;
      } catch {
        isHealthy = false;
      }

      const metrics: SystemMetricsData = {
        dailySignups: signupsData,
        dailyApplications: applicationsData,
        isHealthy,
      };

      logger.info('시스템 메트릭스 조회 완료', { daysCount: 7, isHealthy });
      return metrics;
    } catch (error) {
      if (isAppError(error)) throw error;
      logger.error('시스템 메트릭스 조회 실패', toError(error));
      handleSupabaseError(error, { operation: '시스템 메트릭스 조회', table: TABLES.USERS });
    }
  }
}

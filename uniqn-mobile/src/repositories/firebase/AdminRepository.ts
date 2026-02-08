/**
 * UNIQN Mobile - Firebase Admin Repository
 *
 * @description Firebase Firestore 기반 Admin Repository 구현
 * @version 1.0.0
 *
 * 책임:
 * 1. Firebase 쿼리 실행 (users, jobPostings, applications, reports)
 * 2. 문서 파싱 및 타입 변환
 * 3. 관리자 전용 집계/통계 쿼리 캡슐화
 *
 * 비즈니스 로직:
 * - 대시보드 표시 → adminService
 * - 사용자 관리 → adminService
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getCountFromServer,
  serverTimestamp,
  Timestamp,
  type QueryConstraint,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { BusinessError, ERROR_CODES, toError, isAppError } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { TimeNormalizer, type TimeInput } from '@/shared/time';
import type {
  IAdminRepository,
  DashboardCounts,
  SystemMetricsData,
  DailyCount,
} from '../interfaces';
import type {
  AdminUser,
  AdminUserFilters,
  PaginatedUsers,
} from '@/types/admin';
import type { UserRole } from '@/types/common';

// ============================================================================
// Constants
// ============================================================================

const USERS_COLLECTION = 'users';
const JOB_POSTINGS_COLLECTION = 'jobPostings';
const APPLICATIONS_COLLECTION = 'applications';
const REPORTS_COLLECTION = 'reports';

// ============================================================================
// Helpers
// ============================================================================

function toDate(value: TimeInput): Date {
  return TimeNormalizer.parseTime(value) ?? new Date();
}

function getTodayStart(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function docToAdminUser(docSnap: DocumentSnapshot): AdminUser | null {
  const data = docSnap.data();
  if (!data) return null;
  return {
    id: docSnap.id,
    uid: data.uid || docSnap.id,
    name: data.name || '',
    email: data.email || '',
    role: data.role || 'staff',
    phone: data.phone,
    photoURL: data.photoURL,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
    lastLoginAt: data.lastLoginAt ? toDate(data.lastLoginAt) : undefined,
    isActive: data.isActive !== false,
    isVerified: data.identityVerified === true,
  };
}

// ============================================================================
// Repository Implementation
// ============================================================================

/**
 * Firebase Admin Repository
 */
export class FirebaseAdminRepository implements IAdminRepository {
  // ==========================================================================
  // 대시보드 (Dashboard)
  // ==========================================================================

  async getDashboardCounts(): Promise<DashboardCounts> {
    try {
      logger.info('대시보드 카운트 조회');
      const db = getFirebaseDb();
      const todayStart = getTodayStart();

      const [
        totalUsersSnap,
        newUsersTodaySnap,
        activeJobsSnap,
        applicationsTodaySnap,
        pendingReportsSnap,
        adminCountSnap,
        employerCountSnap,
        staffCountSnap,
      ] = await Promise.all([
        getCountFromServer(collection(db, USERS_COLLECTION)),
        getCountFromServer(
          query(
            collection(db, USERS_COLLECTION),
            where('createdAt', '>=', Timestamp.fromDate(todayStart))
          )
        ),
        getCountFromServer(
          query(
            collection(db, JOB_POSTINGS_COLLECTION),
            where('status', '==', 'active')
          )
        ),
        getCountFromServer(
          query(
            collection(db, APPLICATIONS_COLLECTION),
            where('createdAt', '>=', Timestamp.fromDate(todayStart))
          )
        ),
        getCountFromServer(
          query(
            collection(db, REPORTS_COLLECTION),
            where('status', '==', 'pending')
          )
        ),
        getCountFromServer(
          query(
            collection(db, USERS_COLLECTION),
            where('role', '==', 'admin')
          )
        ),
        getCountFromServer(
          query(
            collection(db, USERS_COLLECTION),
            where('role', '==', 'employer')
          )
        ),
        getCountFromServer(
          query(
            collection(db, USERS_COLLECTION),
            where('role', '==', 'staff')
          )
        ),
      ]);

      const counts: DashboardCounts = {
        totalUsers: totalUsersSnap.data().count,
        newUsersToday: newUsersTodaySnap.data().count,
        activeJobPostings: activeJobsSnap.data().count,
        applicationsToday: applicationsTodaySnap.data().count,
        pendingReports: pendingReportsSnap.data().count,
        adminCount: adminCountSnap.data().count,
        employerCount: employerCountSnap.data().count,
        staffCount: staffCountSnap.data().count,
      };

      logger.info('대시보드 카운트 조회 완료', {
        totalUsers: counts.totalUsers,
      });

      return counts;
    } catch (error) {
      logger.error('대시보드 카운트 조회 실패', toError(error));
      throw handleServiceError(error, {
        operation: '대시보드 카운트 조회',
        component: 'AdminRepository',
      });
    }
  }

  async getRecentUsers(limitCount: number = 5): Promise<AdminUser[]> {
    try {
      logger.info('최근 가입 사용자 조회', { limitCount });
      const db = getFirebaseDb();

      const recentUsersSnap = await getDocs(
        query(
          collection(db, USERS_COLLECTION),
          orderBy('createdAt', 'desc'),
          limit(limitCount)
        )
      );

      const recentUsers: AdminUser[] = [];
      recentUsersSnap.docs.forEach((d) => {
        const user = docToAdminUser(d);
        if (user) recentUsers.push(user);
      });

      logger.info('최근 가입 사용자 조회 완료', {
        count: recentUsers.length,
      });

      return recentUsers;
    } catch (error) {
      logger.error('최근 가입 사용자 조회 실패', toError(error));
      throw handleServiceError(error, {
        operation: '최근 가입 사용자 조회',
        component: 'AdminRepository',
      });
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
      const db = getFirebaseDb();
      const constraints: QueryConstraint[] = [];

      if (filters.role && filters.role !== 'all') {
        constraints.push(where('role', '==', filters.role));
      }
      if (filters.isActive !== undefined) {
        constraints.push(where('isActive', '==', filters.isActive));
      }
      if (filters.isVerified !== undefined) {
        constraints.push(where('identityVerified', '==', filters.isVerified));
      }

      const sortField = filters.sortBy || 'createdAt';
      const sortOrder = filters.sortOrder || 'desc';
      constraints.push(orderBy(sortField, sortOrder));

      const totalSnap = await getCountFromServer(
        query(collection(db, USERS_COLLECTION), ...constraints)
      );
      const total = totalSnap.data().count;
      const totalPages = Math.ceil(total / pageSize);
      const offset = (page - 1) * pageSize;

      let dataQuery = query(
        collection(db, USERS_COLLECTION),
        ...constraints,
        limit(pageSize)
      );

      if (offset > 0) {
        const prevSnap = await getDocs(
          query(collection(db, USERS_COLLECTION), ...constraints, limit(offset))
        );
        const lastDoc = prevSnap.docs[prevSnap.docs.length - 1];
        if (lastDoc) {
          dataQuery = query(
            collection(db, USERS_COLLECTION),
            ...constraints,
            startAfter(lastDoc),
            limit(pageSize)
          );
        }
      }

      const usersSnap = await getDocs(dataQuery);
      const users: AdminUser[] = [];
      usersSnap.docs.forEach((d) => {
        const user = docToAdminUser(d);
        if (user) users.push(user);
      });

      // 클라이언트 사이드 검색 필터
      let filteredUsers = users;
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredUsers = users.filter(
          (u) =>
            u.name.toLowerCase().includes(searchLower) ||
            u.email.toLowerCase().includes(searchLower)
        );
      }

      const result: PaginatedUsers = {
        users: filteredUsers,
        total,
        page,
        pageSize,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      };

      logger.info('사용자 목록 조회 완료', {
        total,
        returned: filteredUsers.length,
      });

      return result;
    } catch (error) {
      logger.error('사용자 목록 조회 실패', toError(error), {
        filters,
        page,
        pageSize,
      });
      throw handleServiceError(error, {
        operation: '사용자 목록 조회',
        component: 'AdminRepository',
        context: { filters, page, pageSize },
      });
    }
  }

  async getUserById(userId: string): Promise<AdminUser | null> {
    try {
      logger.info('사용자 조회', { userId });
      const db = getFirebaseDb();
      const userDoc = await getDoc(doc(db, USERS_COLLECTION, userId));

      if (!userDoc.exists()) {
        return null;
      }

      const user = docToAdminUser(userDoc);
      if (!user) {
        return null;
      }

      logger.info('사용자 조회 완료', { userId, userName: user.name });
      return user;
    } catch (error) {
      logger.error('사용자 조회 실패', toError(error), { userId });
      throw handleServiceError(error, {
        operation: '사용자 조회',
        component: 'AdminRepository',
        context: { userId },
      });
    }
  }

  async updateUserRole(
    userId: string,
    newRole: UserRole
  ): Promise<string | undefined> {
    try {
      logger.info('사용자 역할 변경', { userId, newRole });
      const db = getFirebaseDb();
      const userDoc = await getDoc(doc(db, USERS_COLLECTION, userId));

      if (!userDoc.exists()) {
        throw new BusinessError(ERROR_CODES.AUTH_USER_NOT_FOUND, {
          userMessage: '사용자를 찾을 수 없습니다',
          metadata: { userId },
        });
      }

      const currentRole = userDoc.data()?.role as string | undefined;

      await updateDoc(doc(db, USERS_COLLECTION, userId), {
        role: newRole,
        updatedAt: serverTimestamp(),
      });

      logger.info('사용자 역할 변경 완료', {
        userId,
        previousRole: currentRole,
        newRole,
      });

      return currentRole;
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }
      logger.error('사용자 역할 변경 실패', toError(error), {
        userId,
        newRole,
      });
      throw handleServiceError(error, {
        operation: '사용자 역할 변경',
        component: 'AdminRepository',
        context: { userId, newRole },
      });
    }
  }

  async setUserActive(userId: string, isActive: boolean): Promise<void> {
    try {
      logger.info('사용자 상태 변경', { userId, isActive });
      const db = getFirebaseDb();
      const userDoc = await getDoc(doc(db, USERS_COLLECTION, userId));

      if (!userDoc.exists()) {
        throw new BusinessError(ERROR_CODES.AUTH_USER_NOT_FOUND, {
          userMessage: '사용자를 찾을 수 없습니다',
          metadata: { userId },
        });
      }

      await updateDoc(doc(db, USERS_COLLECTION, userId), {
        isActive,
        updatedAt: serverTimestamp(),
      });

      logger.info('사용자 상태 변경 완료', { userId, isActive });
    } catch (error) {
      if (isAppError(error)) {
        throw error;
      }
      logger.error('사용자 상태 변경 실패', toError(error), {
        userId,
        isActive,
      });
      throw handleServiceError(error, {
        operation: '사용자 상태 변경',
        component: 'AdminRepository',
        context: { userId, isActive },
      });
    }
  }

  // ==========================================================================
  // 시스템 메트릭스 (System Metrics)
  // ==========================================================================

  async getSystemMetrics(): Promise<SystemMetricsData> {
    try {
      logger.info('시스템 메트릭스 조회');
      const db = getFirebaseDb();
      const dates: string[] = [];
      const dateRanges: { start: Date; end: Date }[] = [];

      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        dates.push(date.toISOString().split('T')[0]);
        const endDate = new Date(date);
        endDate.setHours(23, 59, 59, 999);
        dateRanges.push({ start: date, end: endDate });
      }

      const [signupsData, applicationsData] = await Promise.all([
        Promise.all(
          dateRanges.map(async ({ start, end }, i) => {
            const snap = await getCountFromServer(
              query(
                collection(db, USERS_COLLECTION),
                where('createdAt', '>=', Timestamp.fromDate(start)),
                where('createdAt', '<=', Timestamp.fromDate(end))
              )
            );
            return { date: dates[i], count: snap.data().count } as DailyCount;
          })
        ),
        Promise.all(
          dateRanges.map(async ({ start, end }, i) => {
            const snap = await getCountFromServer(
              query(
                collection(db, APPLICATIONS_COLLECTION),
                where('createdAt', '>=', Timestamp.fromDate(start)),
                where('createdAt', '<=', Timestamp.fromDate(end))
              )
            );
            return { date: dates[i], count: snap.data().count } as DailyCount;
          })
        ),
      ]);

      // 시스템 상태 체크
      let isHealthy = true;
      try {
        await getDoc(doc(db, '_health', 'check'));
      } catch {
        isHealthy = false;
      }

      const metrics: SystemMetricsData = {
        dailySignups: signupsData,
        dailyApplications: applicationsData,
        isHealthy,
      };

      logger.info('시스템 메트릭스 조회 완료', {
        daysCount: 7,
        isHealthy,
      });

      return metrics;
    } catch (error) {
      logger.error('시스템 메트릭스 조회 실패', toError(error));
      throw handleServiceError(error, {
        operation: '시스템 메트릭스 조회',
        component: 'AdminRepository',
      });
    }
  }
}

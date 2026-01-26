/**
 * UNIQN Mobile - Admin Service
 *
 * @description 관리자 대시보드 및 사용자 관리 서비스
 * @version 1.0.0
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
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { logger } from "@/utils/logger";
import { BusinessError, ERROR_CODES, mapFirebaseError } from "@/errors";
import type {
  AdminUser,
  AdminUserFilters,
  DashboardStats,
  PaginatedUsers,
  SystemMetrics,
} from "@/types/admin";
import type { UserRole } from "@/types/common";

// ============================================================================
// Helper Functions
// ============================================================================

function toDate(timestamp: Timestamp | Date | undefined): Date {
  if (!timestamp) return new Date();
  if (timestamp instanceof Date) return timestamp;
  return timestamp.toDate();
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
    name: data.name || "",
    email: data.email || "",
    role: data.role || "staff",
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
// Dashboard Stats
// ============================================================================

export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    logger.info("대시보드 통계 조회 시작");
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
      recentUsersSnap,
    ] = await Promise.all([
      getCountFromServer(collection(db, "users")),
      getCountFromServer(
        query(collection(db, "users"), where("createdAt", ">=", Timestamp.fromDate(todayStart)))
      ),
      getCountFromServer(
        query(collection(db, "jobPostings"), where("status", "==", "active"))
      ),
      getCountFromServer(
        query(collection(db, "applications"), where("createdAt", ">=", Timestamp.fromDate(todayStart)))
      ),
      getCountFromServer(
        query(collection(db, "reports"), where("status", "==", "pending"))
      ),
      getCountFromServer(
        query(collection(db, "users"), where("role", "==", "admin"))
      ),
      getCountFromServer(
        query(collection(db, "users"), where("role", "==", "employer"))
      ),
      getCountFromServer(
        query(collection(db, "users"), where("role", "==", "staff"))
      ),
      getDocs(
        query(collection(db, "users"), orderBy("createdAt", "desc"), limit(5))
      ),
    ]);

    const recentUsers: AdminUser[] = [];
    recentUsersSnap.docs.forEach((d) => {
      const user = docToAdminUser(d);
      if (user) recentUsers.push(user);
    });

    const stats: DashboardStats = {
      totalUsers: totalUsersSnap.data().count,
      newUsersToday: newUsersTodaySnap.data().count,
      activeJobPostings: activeJobsSnap.data().count,
      applicationsToday: applicationsTodaySnap.data().count,
      pendingReports: pendingReportsSnap.data().count,
      usersByRole: {
        admin: adminCountSnap.data().count,
        employer: employerCountSnap.data().count,
        staff: staffCountSnap.data().count,
      },
      recentUsers,
      fetchedAt: new Date(),
    };

    logger.info("대시보드 통계 조회 완료", { totalUsers: stats.totalUsers });
    return stats;
  } catch (error) {
    logger.error("대시보드 통계 조회 실패", error as Error);
    if (error instanceof BusinessError) throw error;
    throw mapFirebaseError(error);
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
    logger.info("사용자 목록 조회", { filters, page, pageSize });
    const db = getFirebaseDb();
    const constraints: QueryConstraint[] = [];

    if (filters.role && filters.role !== "all") {
      constraints.push(where("role", "==", filters.role));
    }
    if (filters.isActive !== undefined) {
      constraints.push(where("isActive", "==", filters.isActive));
    }
    if (filters.isVerified !== undefined) {
      constraints.push(where("identityVerified", "==", filters.isVerified));
    }

    const sortField = filters.sortBy || "createdAt";
    const sortOrder = filters.sortOrder || "desc";
    constraints.push(orderBy(sortField, sortOrder));

    const totalSnap = await getCountFromServer(query(collection(db, "users"), ...constraints));
    const total = totalSnap.data().count;
    const totalPages = Math.ceil(total / pageSize);
    const offset = (page - 1) * pageSize;

    let dataQuery = query(collection(db, "users"), ...constraints, limit(pageSize));

    if (offset > 0) {
      const prevSnap = await getDocs(query(collection(db, "users"), ...constraints, limit(offset)));
      const lastDoc = prevSnap.docs[prevSnap.docs.length - 1];
      if (lastDoc) {
        dataQuery = query(collection(db, "users"), ...constraints, startAfter(lastDoc), limit(pageSize));
      }
    }

    const usersSnap = await getDocs(dataQuery);
    const users: AdminUser[] = [];
    usersSnap.docs.forEach((d) => {
      const user = docToAdminUser(d);
      if (user) users.push(user);
    });

    let filteredUsers = users;
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filteredUsers = users.filter(
        (u) => u.name.toLowerCase().includes(searchLower) || u.email.toLowerCase().includes(searchLower)
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

    logger.info("사용자 목록 조회 완료", { total, returned: filteredUsers.length });
    return result;
  } catch (error) {
    logger.error("사용자 목록 조회 실패", error as Error);
    if (error instanceof BusinessError) throw error;
    throw mapFirebaseError(error);
  }
}

export async function getUserById(userId: string): Promise<AdminUser> {
  try {
    logger.info("사용자 조회", { userId });
    const db = getFirebaseDb();
    const userDoc = await getDoc(doc(db, "users", userId));

    if (!userDoc.exists()) {
      throw new BusinessError(ERROR_CODES.AUTH_USER_NOT_FOUND, {
        userMessage: "사용자를 찾을 수 없습니다",
        metadata: { userId },
      });
    }

    const user = docToAdminUser(userDoc);
    if (!user) {
      throw new BusinessError(ERROR_CODES.AUTH_USER_NOT_FOUND, {
        userMessage: "사용자 정보를 변환할 수 없습니다",
        metadata: { userId },
      });
    }

    logger.info("사용자 조회 완료", { userId, userName: user.name });
    return user;
  } catch (error) {
    logger.error("사용자 조회 실패", error as Error, { userId });
    if (error instanceof BusinessError) throw error;
    throw mapFirebaseError(error);
  }
}

export async function updateUserRole(
  userId: string,
  newRole: UserRole,
  reason?: string
): Promise<void> {
  try {
    logger.info("사용자 역할 변경", { userId, newRole, reason });
    const db = getFirebaseDb();
    const userDoc = await getDoc(doc(db, "users", userId));

    if (!userDoc.exists()) {
      throw new BusinessError(ERROR_CODES.AUTH_USER_NOT_FOUND, {
        userMessage: "사용자를 찾을 수 없습니다",
        metadata: { userId },
      });
    }

    const currentRole = userDoc.data()?.role;
    await updateDoc(doc(db, "users", userId), {
      role: newRole,
      updatedAt: serverTimestamp(),
    });

    logger.info("사용자 역할 변경 완료", { userId, previousRole: currentRole, newRole, reason });
  } catch (error) {
    logger.error("사용자 역할 변경 실패", error as Error, { userId, newRole });
    if (error instanceof BusinessError) throw error;
    throw mapFirebaseError(error);
  }
}

export async function setUserActive(
  userId: string,
  isActive: boolean,
  reason?: string
): Promise<void> {
  try {
    logger.info("사용자 상태 변경", { userId, isActive, reason });
    const db = getFirebaseDb();
    const userDoc = await getDoc(doc(db, "users", userId));

    if (!userDoc.exists()) {
      throw new BusinessError(ERROR_CODES.AUTH_USER_NOT_FOUND, {
        userMessage: "사용자를 찾을 수 없습니다",
        metadata: { userId },
      });
    }

    await updateDoc(doc(db, "users", userId), {
      isActive,
      updatedAt: serverTimestamp(),
    });

    logger.info("사용자 상태 변경 완료", { userId, isActive, reason });
  } catch (error) {
    logger.error("사용자 상태 변경 실패", error as Error, { userId, isActive });
    if (error instanceof BusinessError) throw error;
    throw mapFirebaseError(error);
  }
}

// ============================================================================
// System Metrics
// ============================================================================

export async function getSystemMetrics(): Promise<SystemMetrics> {
  try {
    logger.info("시스템 메트릭스 조회 시작");
    const db = getFirebaseDb();
    const dates: string[] = [];
    const dateRanges: { start: Date; end: Date }[] = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      dates.push(date.toISOString().split("T")[0]);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      dateRanges.push({ start: date, end: endDate });
    }

    const [signupsData, applicationsData] = await Promise.all([
      Promise.all(
        dateRanges.map(async ({ start, end }, i) => {
          const snap = await getCountFromServer(
            query(
              collection(db, "users"),
              where("createdAt", ">=", Timestamp.fromDate(start)),
              where("createdAt", "<=", Timestamp.fromDate(end))
            )
          );
          return { date: dates[i], count: snap.data().count };
        })
      ),
      Promise.all(
        dateRanges.map(async ({ start, end }, i) => {
          const snap = await getCountFromServer(
            query(
              collection(db, "applications"),
              where("createdAt", ">=", Timestamp.fromDate(start)),
              where("createdAt", "<=", Timestamp.fromDate(end))
            )
          );
          return { date: dates[i], count: snap.data().count };
        })
      ),
    ]);

    const dailyActiveUsers = dates.map((date) => ({ date, count: 0 }));

    let systemStatus: "healthy" | "degraded" | "down" = "healthy";
    try {
      await getDoc(doc(db, "_health", "check"));
    } catch {
      systemStatus = "degraded";
    }

    const metrics: SystemMetrics = {
      dailyActiveUsers,
      dailySignups: signupsData,
      dailyApplications: applicationsData,
      systemStatus,
      fetchedAt: new Date(),
    };

    logger.info("시스템 메트릭스 조회 완료", { daysCount: 7, systemStatus });
    return metrics;
  } catch (error) {
    logger.error("시스템 메트릭스 조회 실패", error as Error);
    if (error instanceof BusinessError) throw error;
    throw mapFirebaseError(error);
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

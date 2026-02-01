/**
 * UNIQN Mobile - Firebase WorkLog Repository
 *
 * @description Firebase Firestore 기반 WorkLog Repository 구현
 * @version 1.0.0
 *
 * 책임:
 * 1. Firebase 쿼리 실행
 * 2. 실시간 구독 관리
 * 3. 문서 파싱 및 타입 변환
 *
 * 비즈니스 로직:
 * - 출퇴근 처리 → workLogService
 * - 정산 처리 → settlementService
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { toError } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { parseWorkLogDocument } from '@/schemas';
import { QueryBuilder } from '@/utils/firestore/queryBuilder';
import { getTodayString } from '@/utils/date';
import { TimeNormalizer } from '@/shared/time';
import type {
  IWorkLogRepository,
  WorkLogStats,
  MonthlyPayrollSummary,
  WorkLogFilterOptions,
} from '../interfaces';
import type { WorkLog, PayrollStatus } from '@/types';

// ============================================================================
// Constants
// ============================================================================

const COLLECTION_NAME = 'workLogs';
const DEFAULT_PAGE_SIZE = 50;

// ============================================================================
// Repository Implementation
// ============================================================================

/**
 * Firebase WorkLog Repository
 */
export class FirebaseWorkLogRepository implements IWorkLogRepository {
  // ==========================================================================
  // 조회 (Read)
  // ==========================================================================

  async getById(workLogId: string): Promise<WorkLog | null> {
    try {
      logger.info('근무 기록 상세 조회', { workLogId });

      const docRef = doc(getFirebaseDb(), COLLECTION_NAME, workLogId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      const workLog = parseWorkLogDocument({
        id: docSnap.id,
        ...docSnap.data(),
      });

      if (!workLog) {
        logger.warn('근무 기록 데이터 파싱 실패', { workLogId });
        return null;
      }

      return workLog;
    } catch (error) {
      logger.error('근무 기록 상세 조회 실패', toError(error), { workLogId });
      throw handleServiceError(error, {
        operation: '근무 기록 상세 조회',
        component: 'WorkLogRepository',
        context: { workLogId },
      });
    }
  }

  async getByStaffId(staffId: string, pageSize: number = DEFAULT_PAGE_SIZE): Promise<WorkLog[]> {
    try {
      logger.info('스태프별 근무 기록 조회', { staffId, pageSize });

      const workLogsRef = collection(getFirebaseDb(), COLLECTION_NAME);

      const q = new QueryBuilder(workLogsRef)
        .whereEqual('staffId', staffId)
        .orderByDesc('date')
        .limit(pageSize)
        .build();

      const snapshot = await getDocs(q);

      const items: WorkLog[] = [];

      for (const docSnapshot of snapshot.docs) {
        const workLog = parseWorkLogDocument({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        });

        if (workLog) {
          items.push(workLog);
        }
      }

      logger.info('스태프별 근무 기록 조회 완료', {
        staffId,
        count: items.length,
      });

      return items;
    } catch (error) {
      logger.error('스태프별 근무 기록 조회 실패', toError(error), { staffId });
      throw handleServiceError(error, {
        operation: '스태프별 근무 기록 조회',
        component: 'WorkLogRepository',
        context: { staffId },
      });
    }
  }

  async getByStaffIdWithFilters(
    staffId: string,
    options?: WorkLogFilterOptions
  ): Promise<WorkLog[]> {
    try {
      logger.info('필터를 포함한 스태프별 근무 기록 조회', { staffId, options });

      const workLogsRef = collection(getFirebaseDb(), COLLECTION_NAME);

      const queryBuilder = new QueryBuilder(workLogsRef).whereEqual('staffId', staffId);

      // 날짜 범위 필터
      if (options?.dateRange) {
        queryBuilder
          .where('date', '>=', options.dateRange.start)
          .where('date', '<=', options.dateRange.end);
      }

      // 상태 필터
      if (options?.status) {
        queryBuilder.whereEqual('status', options.status);
      }

      const q = queryBuilder
        .orderByDesc('date')
        .limit(options?.pageSize ?? DEFAULT_PAGE_SIZE)
        .build();

      const snapshot = await getDocs(q);

      const items: WorkLog[] = [];

      for (const docSnapshot of snapshot.docs) {
        const workLog = parseWorkLogDocument({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        });

        if (workLog) {
          items.push(workLog);
        }
      }

      logger.info('필터를 포함한 스태프별 근무 기록 조회 완료', {
        staffId,
        count: items.length,
      });

      return items;
    } catch (error) {
      logger.error('필터를 포함한 스태프별 근무 기록 조회 실패', toError(error), { staffId });
      throw handleServiceError(error, {
        operation: '필터를 포함한 스태프별 근무 기록 조회',
        component: 'WorkLogRepository',
        context: { staffId, ...options },
      });
    }
  }

  async getByDate(staffId: string, date: string): Promise<WorkLog[]> {
    try {
      logger.info('날짜별 근무 기록 조회', { staffId, date });

      const workLogsRef = collection(getFirebaseDb(), COLLECTION_NAME);

      const q = new QueryBuilder(workLogsRef)
        .whereEqual('staffId', staffId)
        .whereEqual('date', date)
        .orderByDesc('checkInTime')
        .build();

      const snapshot = await getDocs(q);

      const items: WorkLog[] = [];

      for (const docSnapshot of snapshot.docs) {
        const workLog = parseWorkLogDocument({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        });

        if (workLog) {
          items.push(workLog);
        }
      }

      logger.info('날짜별 근무 기록 조회 완료', {
        staffId,
        date,
        count: items.length,
      });

      return items;
    } catch (error) {
      logger.error('날짜별 근무 기록 조회 실패', toError(error), {
        staffId,
        date,
      });
      throw handleServiceError(error, {
        operation: '날짜별 근무 기록 조회',
        component: 'WorkLogRepository',
        context: { staffId, date },
      });
    }
  }

  async getByJobPostingId(jobPostingId: string): Promise<WorkLog[]> {
    try {
      logger.info('공고별 근무 기록 조회', { jobPostingId });

      const workLogsRef = collection(getFirebaseDb(), COLLECTION_NAME);

      const q = new QueryBuilder(workLogsRef)
        .whereEqual('jobPostingId', jobPostingId)
        .orderByDesc('date')
        .build();

      const snapshot = await getDocs(q);

      const items: WorkLog[] = [];

      for (const docSnapshot of snapshot.docs) {
        const workLog = parseWorkLogDocument({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        });

        if (workLog) {
          items.push(workLog);
        }
      }

      logger.info('공고별 근무 기록 조회 완료', {
        jobPostingId,
        count: items.length,
      });

      return items;
    } catch (error) {
      logger.error('공고별 근무 기록 조회 실패', toError(error), {
        jobPostingId,
      });
      throw handleServiceError(error, {
        operation: '공고별 근무 기록 조회',
        component: 'WorkLogRepository',
        context: { jobPostingId },
      });
    }
  }

  async getTodayCheckedIn(staffId: string): Promise<WorkLog | null> {
    try {
      const today = getTodayString();

      logger.info('오늘 출근 기록 조회', { staffId, today });

      const workLogsRef = collection(getFirebaseDb(), COLLECTION_NAME);

      const q = query(
        workLogsRef,
        where('staffId', '==', staffId),
        where('date', '==', today),
        where('status', '==', 'checked_in'),
        limit(1)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        return null;
      }

      const docSnapshot = snapshot.docs[0];
      const workLog = parseWorkLogDocument({
        id: docSnapshot.id,
        ...docSnapshot.data(),
      });

      return workLog;
    } catch (error) {
      logger.error('오늘 출근 기록 조회 실패', toError(error), { staffId });
      throw handleServiceError(error, {
        operation: '오늘 출근 기록 조회',
        component: 'WorkLogRepository',
        context: { staffId },
      });
    }
  }

  async getStats(staffId: string): Promise<WorkLogStats> {
    try {
      logger.info('근무 기록 통계 조회', { staffId });

      const workLogs = await this.getByStaffId(staffId, 1000);

      const stats: WorkLogStats = {
        totalWorkLogs: workLogs.length,
        completedCount: 0,
        totalHoursWorked: 0,
        averageHoursPerDay: 0,
        pendingPayroll: 0,
        completedPayroll: 0,
      };

      for (const workLog of workLogs) {
        // 완료된 근무
        if (workLog.status === 'completed') {
          stats.completedCount++;
        }

        // 근무 시간 계산 (체크인/체크아웃에서 - TimeNormalizer 사용)
        if (workLog.checkInTime && workLog.checkOutTime) {
          const checkInDate = TimeNormalizer.parseTime(workLog.checkInTime);
          const checkOutDate = TimeNormalizer.parseTime(workLog.checkOutTime);
          if (checkInDate && checkOutDate) {
            const durationMs = checkOutDate.getTime() - checkInDate.getTime();
            const durationHours = durationMs / (1000 * 60 * 60);
            if (durationHours > 0) {
              stats.totalHoursWorked += durationHours;
            }
          }
        }

        // 정산 상태
        const amount = workLog.payrollAmount ?? 0;
        if (workLog.payrollStatus === 'completed') {
          stats.completedPayroll += amount;
        } else {
          stats.pendingPayroll += amount;
        }
      }

      // 평균 계산
      if (stats.completedCount > 0) {
        stats.averageHoursPerDay = stats.totalHoursWorked / stats.completedCount;
      }

      logger.info('근무 기록 통계 조회 완료', { staffId, stats });

      return stats;
    } catch (error) {
      logger.error('근무 기록 통계 조회 실패', toError(error), { staffId });
      throw handleServiceError(error, {
        operation: '근무 기록 통계 조회',
        component: 'WorkLogRepository',
        context: { staffId },
      });
    }
  }

  async getMonthlyPayroll(
    staffId: string,
    year: number,
    month: number
  ): Promise<MonthlyPayrollSummary> {
    try {
      const monthStr = `${year}-${String(month).padStart(2, '0')}`;

      logger.info('월별 정산 요약 조회', { staffId, monthStr });

      const startDate = `${monthStr}-01`;
      const endDate = `${monthStr}-31`;

      const workLogsRef = collection(getFirebaseDb(), COLLECTION_NAME);

      const q = query(
        workLogsRef,
        where('staffId', '==', staffId),
        where('date', '>=', startDate),
        where('date', '<=', endDate),
        orderBy('date', 'asc')
      );

      const snapshot = await getDocs(q);

      const workLogs: WorkLog[] = [];
      const summary: MonthlyPayrollSummary = {
        month: monthStr,
        totalAmount: 0,
        pendingAmount: 0,
        completedAmount: 0,
        workLogCount: 0,
        workLogs: [],
      };

      for (const docSnapshot of snapshot.docs) {
        const workLog = parseWorkLogDocument({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        });

        if (!workLog) continue;

        workLogs.push(workLog);
        summary.workLogCount++;
        const amount = workLog.payrollAmount ?? 0;
        summary.totalAmount += amount;

        if (workLog.payrollStatus === 'completed') {
          summary.completedAmount += amount;
        } else {
          summary.pendingAmount += amount;
        }
      }

      summary.workLogs = workLogs;

      logger.info('월별 정산 요약 조회 완료', {
        staffId,
        summary: { ...summary, workLogs: undefined },
      });

      return summary;
    } catch (error) {
      logger.error('월별 정산 요약 조회 실패', toError(error), {
        staffId,
        year,
        month,
      });
      throw handleServiceError(error, {
        operation: '월별 정산 요약 조회',
        component: 'WorkLogRepository',
        context: { staffId, year, month },
      });
    }
  }

  async getByDateRange(staffId: string, startDate: string, endDate: string): Promise<WorkLog[]> {
    try {
      logger.info('날짜 범위 근무 기록 조회', { staffId, startDate, endDate });

      const workLogsRef = collection(getFirebaseDb(), COLLECTION_NAME);

      const q = query(
        workLogsRef,
        where('staffId', '==', staffId),
        where('date', '>=', startDate),
        where('date', '<=', endDate),
        orderBy('date', 'asc')
      );

      const snapshot = await getDocs(q);
      const items: WorkLog[] = [];

      for (const docSnapshot of snapshot.docs) {
        const workLog = parseWorkLogDocument({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        });

        if (workLog) {
          items.push(workLog);
        }
      }

      logger.info('날짜 범위 근무 기록 조회 완료', {
        staffId,
        startDate,
        endDate,
        count: items.length,
      });

      return items;
    } catch (error) {
      logger.error('날짜 범위 근무 기록 조회 실패', toError(error), {
        staffId,
        startDate,
        endDate,
      });
      throw handleServiceError(error, {
        operation: '날짜 범위 근무 기록 조회',
        component: 'WorkLogRepository',
        context: { staffId, startDate, endDate },
      });
    }
  }

  async findByJobPostingStaffDate(
    jobPostingId: string,
    staffId: string,
    date: string
  ): Promise<WorkLog | null> {
    try {
      logger.info('공고-스태프-날짜 근무 기록 조회', { jobPostingId, staffId, date });

      const workLogsRef = collection(getFirebaseDb(), COLLECTION_NAME);

      const q = query(
        workLogsRef,
        where('jobPostingId', '==', jobPostingId),
        where('staffId', '==', staffId),
        where('date', '==', date),
        limit(1)
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        logger.info('공고-스태프-날짜 근무 기록 없음', { jobPostingId, staffId, date });
        return null;
      }

      const docSnapshot = snapshot.docs[0];
      const workLog = parseWorkLogDocument({
        id: docSnapshot.id,
        ...docSnapshot.data(),
      });

      logger.info('공고-스태프-날짜 근무 기록 조회 완료', {
        jobPostingId,
        staffId,
        date,
        found: !!workLog,
      });

      return workLog;
    } catch (error) {
      logger.error('공고-스태프-날짜 근무 기록 조회 실패', toError(error), {
        jobPostingId,
        staffId,
        date,
      });
      throw handleServiceError(error, {
        operation: '공고-스태프-날짜 근무 기록 조회',
        component: 'WorkLogRepository',
        context: { jobPostingId, staffId, date },
      });
    }
  }

  // ==========================================================================
  // 실시간 구독 (Realtime)
  // ==========================================================================

  subscribeByDate(
    staffId: string,
    date: string,
    onData: (workLogs: WorkLog[]) => void,
    onError: (error: Error) => void
  ): Unsubscribe {
    logger.info('날짜별 근무 기록 구독 시작', { staffId, date });

    const workLogsRef = collection(getFirebaseDb(), COLLECTION_NAME);

    const q = query(
      workLogsRef,
      where('staffId', '==', staffId),
      where('date', '==', date),
      orderBy('checkInTime', 'desc')
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const items: WorkLog[] = [];

        for (const docSnapshot of snapshot.docs) {
          const workLog = parseWorkLogDocument({
            id: docSnapshot.id,
            ...docSnapshot.data(),
          });

          if (workLog) {
            items.push(workLog);
          }
        }

        logger.debug('날짜별 근무 기록 업데이트', {
          staffId,
          date,
          count: items.length,
        });

        onData(items);
      },
      (error) => {
        logger.error('날짜별 근무 기록 구독 에러', toError(error), {
          staffId,
          date,
        });
        onError(error);
      }
    );
  }

  subscribeByStaffId(
    staffId: string,
    onData: (workLogs: WorkLog[]) => void,
    onError: (error: Error) => void
  ): Unsubscribe {
    logger.info('스태프별 근무 기록 실시간 구독 시작', { staffId });

    const workLogsRef = collection(getFirebaseDb(), COLLECTION_NAME);

    const q = query(
      workLogsRef,
      where('staffId', '==', staffId),
      orderBy('date', 'desc'),
      limit(DEFAULT_PAGE_SIZE)
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const items: WorkLog[] = [];

        for (const docSnapshot of snapshot.docs) {
          const workLog = parseWorkLogDocument({
            id: docSnapshot.id,
            ...docSnapshot.data(),
          });

          if (workLog) {
            items.push(workLog);
          }
        }

        logger.debug('스태프별 근무 기록 업데이트', {
          staffId,
          count: items.length,
        });

        onData(items);
      },
      (error) => {
        logger.error('스태프별 근무 기록 구독 에러', toError(error), { staffId });
        onError(error);
      }
    );
  }

  // ==========================================================================
  // 변경 (Write)
  // ==========================================================================

  async updatePayrollStatus(workLogId: string, status: PayrollStatus): Promise<void> {
    try {
      logger.info('정산 상태 변경', { workLogId, status });

      const docRef = doc(getFirebaseDb(), COLLECTION_NAME, workLogId);

      await updateDoc(docRef, {
        payrollStatus: status,
        ...(status === 'completed' && { payrollDate: serverTimestamp() }),
        updatedAt: serverTimestamp(),
      });

      logger.info('정산 상태 변경 완료', { workLogId, status });
    } catch (error) {
      logger.error('정산 상태 변경 실패', toError(error), {
        workLogId,
        status,
      });
      throw handleServiceError(error, {
        operation: '정산 상태 변경',
        component: 'WorkLogRepository',
        context: { workLogId, status },
      });
    }
  }
}

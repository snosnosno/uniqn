/**
 * UNIQN Mobile - WorkLog Repository Queries
 *
 * @description 근무기록 읽기 연산 (10개 메서드)
 */

import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { toError } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { parseWorkLogDocument } from '@/schemas';
import { QueryBuilder } from '@/utils/firestore/queryBuilder';
import { getTodayString } from '@/utils/date';
import { TimeNormalizer } from '@/shared/time';
import type { WorkLogStats, MonthlyPayrollSummary, WorkLogFilterOptions } from '../../interfaces';
import type { WorkLog } from '@/types';
import { COLLECTIONS, FIELDS, STATUS } from '@/constants';
import { DEFAULT_PAGE_SIZE, MAX_STATS_PAGE_SIZE } from './constants';

// ============================================================================
// Read Operations
// ============================================================================

export async function getById(workLogId: string): Promise<WorkLog | null> {
  try {
    logger.info('근무 기록 상세 조회', { workLogId });

    const docRef = doc(getFirebaseDb(), COLLECTIONS.WORK_LOGS, workLogId);
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

export async function getByStaffId(
  staffId: string,
  pageSize: number = DEFAULT_PAGE_SIZE
): Promise<WorkLog[]> {
  try {
    logger.info('스태프별 근무 기록 조회', { staffId, pageSize });

    const workLogsRef = collection(getFirebaseDb(), COLLECTIONS.WORK_LOGS);

    const q = new QueryBuilder(workLogsRef)
      .whereEqual(FIELDS.WORK_LOG.staffId, staffId)
      .orderByDesc(FIELDS.WORK_LOG.date)
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

export async function getByStaffIdWithFilters(
  staffId: string,
  options?: WorkLogFilterOptions
): Promise<WorkLog[]> {
  try {
    logger.info('필터를 포함한 스태프별 근무 기록 조회', { staffId, options });

    const workLogsRef = collection(getFirebaseDb(), COLLECTIONS.WORK_LOGS);

    const queryBuilder = new QueryBuilder(workLogsRef).whereEqual(FIELDS.WORK_LOG.staffId, staffId);

    // 날짜 범위 필터
    if (options?.dateRange) {
      queryBuilder
        .where(FIELDS.WORK_LOG.date, '>=', options.dateRange.start)
        .where(FIELDS.WORK_LOG.date, '<=', options.dateRange.end);
    }

    // 상태 필터
    if (options?.status) {
      queryBuilder.whereEqual(FIELDS.WORK_LOG.status, options.status);
    }

    const q = queryBuilder
      .orderByDesc(FIELDS.WORK_LOG.date)
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

export async function getByDate(staffId: string, date: string): Promise<WorkLog[]> {
  try {
    logger.info('날짜별 근무 기록 조회', { staffId, date });

    const workLogsRef = collection(getFirebaseDb(), COLLECTIONS.WORK_LOGS);

    const q = new QueryBuilder(workLogsRef)
      .whereEqual(FIELDS.WORK_LOG.staffId, staffId)
      .whereEqual(FIELDS.WORK_LOG.date, date)
      .orderByDesc(FIELDS.WORK_LOG.checkInTime)
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

export async function getByJobPostingId(jobPostingId: string): Promise<WorkLog[]> {
  try {
    logger.info('공고별 근무 기록 조회', { jobPostingId });

    const workLogsRef = collection(getFirebaseDb(), COLLECTIONS.WORK_LOGS);

    const q = new QueryBuilder(workLogsRef)
      .whereEqual(FIELDS.WORK_LOG.jobPostingId, jobPostingId)
      .orderByDesc(FIELDS.WORK_LOG.date)
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

export async function getTodayCheckedIn(staffId: string): Promise<WorkLog | null> {
  try {
    const today = getTodayString();

    logger.info('오늘 출근 기록 조회', { staffId, today });

    const workLogsRef = collection(getFirebaseDb(), COLLECTIONS.WORK_LOGS);

    const q = new QueryBuilder(workLogsRef)
      .whereEqual(FIELDS.WORK_LOG.staffId, staffId)
      .whereEqual(FIELDS.WORK_LOG.date, today)
      .whereEqual(FIELDS.WORK_LOG.status, STATUS.WORK_LOG.CHECKED_IN)
      .limit(1)
      .build();

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

export async function getStats(staffId: string): Promise<WorkLogStats> {
  try {
    logger.info('근무 기록 통계 조회', { staffId });

    const workLogs = await getByStaffId(staffId, MAX_STATS_PAGE_SIZE);

    if (workLogs.length >= MAX_STATS_PAGE_SIZE) {
      logger.warn('통계 조회 건수 한도 도달, 결과가 불완전할 수 있음', {
        staffId,
        limit: MAX_STATS_PAGE_SIZE,
      });
    }

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
      if (workLog.status === STATUS.WORK_LOG.COMPLETED) {
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
      if (workLog.payrollStatus === STATUS.PAYROLL.COMPLETED) {
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

export async function getMonthlyPayroll(
  staffId: string,
  year: number,
  month: number
): Promise<MonthlyPayrollSummary> {
  try {
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;

    logger.info('월별 정산 요약 조회', { staffId, monthStr });

    const startDate = `${monthStr}-01`;
    const lastDay = new Date(year, month, 0).getDate(); // 해당 월의 실제 말일
    const endDate = `${monthStr}-${String(lastDay).padStart(2, '0')}`;

    const workLogsRef = collection(getFirebaseDb(), COLLECTIONS.WORK_LOGS);

    const q = new QueryBuilder(workLogsRef)
      .whereEqual(FIELDS.WORK_LOG.staffId, staffId)
      .where(FIELDS.WORK_LOG.date, '>=', startDate)
      .where(FIELDS.WORK_LOG.date, '<=', endDate)
      .orderByAsc(FIELDS.WORK_LOG.date)
      .build();

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

      if (workLog.payrollStatus === STATUS.PAYROLL.COMPLETED) {
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

export async function getByDateRange(
  staffId: string,
  startDate: string,
  endDate: string
): Promise<WorkLog[]> {
  try {
    logger.info('날짜 범위 근무 기록 조회', { staffId, startDate, endDate });

    const workLogsRef = collection(getFirebaseDb(), COLLECTIONS.WORK_LOGS);

    const q = new QueryBuilder(workLogsRef)
      .whereEqual(FIELDS.WORK_LOG.staffId, staffId)
      .where(FIELDS.WORK_LOG.date, '>=', startDate)
      .where(FIELDS.WORK_LOG.date, '<=', endDate)
      .orderByAsc(FIELDS.WORK_LOG.date)
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

export async function findByJobPostingStaffDate(
  jobPostingId: string,
  staffId: string,
  date: string
): Promise<WorkLog | null> {
  try {
    logger.info('공고-스태프-날짜 근무 기록 조회', { jobPostingId, staffId, date });

    const workLogsRef = collection(getFirebaseDb(), COLLECTIONS.WORK_LOGS);

    const q = new QueryBuilder(workLogsRef)
      .whereEqual(FIELDS.WORK_LOG.jobPostingId, jobPostingId)
      .whereEqual(FIELDS.WORK_LOG.staffId, staffId)
      .whereEqual(FIELDS.WORK_LOG.date, date)
      .limit(1)
      .build();

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

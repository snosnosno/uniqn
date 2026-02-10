/**
 * UNIQN Mobile - 정산 조회 서비스
 *
 * @description 근무 기록 조회, 정산 요약 조회
 * @version 1.1.0
 *
 * @changelog
 * - 1.1.0: Repository 패턴 적용 (Firebase 직접 호출 제거)
 */

import { logger } from '@/utils/logger';
import { BusinessError, PermissionError, ERROR_CODES } from '@/errors';
import { handleServiceError } from '@/errors/serviceErrorHandler';
import { SettlementCalculator } from '@/domains/settlement';
import {
  getEffectiveSalaryInfoFromRoles,
  getEffectiveAllowances,
  getEffectiveTaxSettings,
} from '@/utils/settlement';
import { jobPostingRepository, workLogRepository } from '@/repositories';
import { STATUS } from '@/constants';
import type { WorkLog } from '@/types';
import {
  type WorkLogWithOverrides,
  type SettlementWorkLog,
  type SettlementFilters,
  type JobPostingSettlementSummary,
} from './types';

// ============================================================================
// Query Functions
// ============================================================================

/**
 * 공고별 근무 기록 조회 (구인자용)
 *
 * @description 특정 공고에 확정된 지원자들의 근무 기록 조회
 */
export async function getWorkLogsByJobPosting(
  jobPostingId: string,
  ownerId: string,
  filters?: Omit<SettlementFilters, 'jobPostingId'>
): Promise<SettlementWorkLog[]> {
  try {
    logger.info('공고별 근무 기록 조회', { jobPostingId, ownerId, filters });

    // 1. 공고 소유권 확인 (Repository 사용)
    const jobPosting = await jobPostingRepository.getById(jobPostingId);

    if (!jobPosting) {
      throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
        userMessage: '존재하지 않는 공고입니다',
      });
    }

    if (jobPosting.ownerId !== ownerId) {
      throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
        userMessage: '본인의 공고만 조회할 수 있습니다',
      });
    }

    // 2. 근무 기록 조회 (Repository 사용)
    const parsedWorkLogs = await workLogRepository.getByJobPostingId(jobPostingId);

    let workLogs: SettlementWorkLog[] = parsedWorkLogs.map((wl) => ({
      ...wl,
      jobPostingTitle: jobPosting.title,
    }));

    // 3. 필터 적용
    if (filters?.dateRange) {
      workLogs = workLogs.filter(
        (wl) => wl.date >= filters.dateRange!.start && wl.date <= filters.dateRange!.end
      );
    }

    if (filters?.payrollStatus) {
      workLogs = workLogs.filter((wl) => wl.payrollStatus === filters.payrollStatus);
    }

    if (filters?.role) {
      // 커스텀 역할 지원: role이 'other'이면 customRole로 매칭
      workLogs = workLogs.filter((wl) => {
        const wlWithCustomRole = wl as SettlementWorkLog & { customRole?: string };
        // 표준 역할 매칭
        if (wl.role === filters.role) return true;
        // 커스텀 역할 매칭: wl.role이 'other'이고 customRole이 filters.role과 일치
        if (wl.role === 'other' && wlWithCustomRole.customRole === filters.role) return true;
        return false;
      });
    }

    // 4. 근무 시간 및 예상 정산액 계산 (Phase 6 - SettlementCalculator 사용)
    workLogs = workLogs.map((wl) => {
      const wlWithOverrides = wl as WorkLogWithOverrides;
      const salaryInfo = getEffectiveSalaryInfoFromRoles(
        wlWithOverrides,
        jobPosting.roles,
        jobPosting.defaultSalary
      );
      const allowances = getEffectiveAllowances(wlWithOverrides, jobPosting.allowances);
      const taxSettings = getEffectiveTaxSettings(wlWithOverrides, jobPosting.taxSettings);

      const result = SettlementCalculator.calculate({
        startTime: wl.checkInTime,
        endTime: wl.checkOutTime,
        salaryInfo,
        allowances,
        taxSettings,
      });

      return {
        ...wl,
        hoursWorked: result.hoursWorked,
        calculatedAmount: result.afterTaxPay,
      };
    });

    logger.info('공고별 근무 기록 조회 완료', {
      jobPostingId,
      count: workLogs.length,
    });

    return workLogs;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '공고별 근무 기록 조회',
      component: 'settlementService',
      context: { jobPostingId, ownerId },
    });
  }
}

/**
 * 공고별 정산 요약 조회
 *
 * @description 특정 공고의 전체 정산 현황 요약
 */
export async function getJobPostingSettlementSummary(
  jobPostingId: string,
  ownerId: string
): Promise<JobPostingSettlementSummary> {
  try {
    logger.info('공고별 정산 요약 조회', { jobPostingId, ownerId });

    // 1. 공고 조회 및 소유권 확인 (Repository 사용)
    const jobPosting = await jobPostingRepository.getById(jobPostingId);

    if (!jobPosting) {
      throw new BusinessError(ERROR_CODES.FIREBASE_DOCUMENT_NOT_FOUND, {
        userMessage: '존재하지 않는 공고입니다',
      });
    }

    if (jobPosting.ownerId !== ownerId) {
      throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
        userMessage: '본인의 공고만 조회할 수 있습니다',
      });
    }

    // 2. 근무 기록 조회 (Repository 사용)
    const workLogs = await workLogRepository.getByJobPostingId(jobPostingId);

    // 3. 통계 계산
    let completedWorkLogs = 0;
    let pendingSettlement = 0;
    let completedSettlement = 0;
    let totalPendingAmount = 0;
    let totalCompletedAmount = 0;
    const workLogsByRole: Record<
      string,
      {
        count: number;
        pendingAmount: number;
        completedAmount: number;
      }
    > = {};

    workLogs.forEach((workLog) => {
      // 커스텀 역할 지원: role이 'other'이면 customRole을 키로 사용
      const workLogWithCustomRole = workLog as WorkLog & { customRole?: string };
      const effectiveRole =
        workLog.role === 'other' && workLogWithCustomRole.customRole
          ? workLogWithCustomRole.customRole
          : workLog.role;

      // 역할별 초기화
      if (!workLogsByRole[effectiveRole]) {
        workLogsByRole[effectiveRole] = {
          count: 0,
          pendingAmount: 0,
          completedAmount: 0,
        };
      }

      workLogsByRole[effectiveRole].count++;

      // 완료된 근무 기록
      if (workLog.status === STATUS.WORK_LOG.CHECKED_OUT || workLog.status === STATUS.WORK_LOG.COMPLETED) {
        completedWorkLogs++;

        // 정산 상태별 분류
        const amount = workLog.payrollAmount || 0;

        if (workLog.payrollStatus === STATUS.PAYROLL.COMPLETED) {
          completedSettlement++;
          totalCompletedAmount += amount;
          workLogsByRole[effectiveRole].completedAmount += amount;
        } else {
          pendingSettlement++;
          // 미정산인 경우 예상 금액 계산 (Phase 6 - SettlementCalculator 사용)
          const workLogWithOverrides = workLog as WorkLogWithOverrides;
          const salaryInfo = getEffectiveSalaryInfoFromRoles(
            workLogWithOverrides,
            jobPosting.roles,
            jobPosting.defaultSalary
          );
          const allowances = getEffectiveAllowances(workLogWithOverrides, jobPosting.allowances);
          const taxSettings = getEffectiveTaxSettings(workLogWithOverrides, jobPosting.taxSettings);

          const settlementResult = SettlementCalculator.calculate({
            startTime: workLog.checkInTime,
            endTime: workLog.checkOutTime,
            salaryInfo,
            allowances,
            taxSettings,
          });
          const estimatedAmount = settlementResult.afterTaxPay;

          totalPendingAmount += amount > 0 ? amount : estimatedAmount;
          workLogsByRole[effectiveRole].pendingAmount += amount > 0 ? amount : estimatedAmount;
        }
      }
    });

    const summary: JobPostingSettlementSummary = {
      jobPostingId,
      jobPostingTitle: jobPosting.title,
      totalWorkLogs: workLogs.length,
      completedWorkLogs,
      pendingSettlement,
      completedSettlement,
      totalPendingAmount,
      totalCompletedAmount,
      workLogsByRole,
    };

    logger.info('공고별 정산 요약 조회 완료', {
      jobPostingId: summary.jobPostingId,
      totalWorkLogs: summary.totalWorkLogs,
      pendingSettlement: summary.pendingSettlement,
      completedSettlement: summary.completedSettlement,
    });

    return summary;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '공고별 정산 요약 조회',
      component: 'settlementService',
      context: { jobPostingId, ownerId },
    });
  }
}

/**
 * 내 전체 정산 요약 조회 (구인자용)
 *
 * @description 구인자의 모든 공고에 대한 정산 현황 요약
 */
export async function getMySettlementSummary(
  ownerId: string,
  dateRange?: { start: string; end: string }
): Promise<{
  totalJobPostings: number;
  totalWorkLogs: number;
  totalPendingAmount: number;
  totalCompletedAmount: number;
  summariesByJobPosting: JobPostingSettlementSummary[];
}> {
  try {
    logger.info('전체 정산 요약 조회', { ownerId, dateRange });

    // 1. 내 공고 조회 (Repository 사용)
    const jobPostings = await jobPostingRepository.getByOwnerId(ownerId);

    // 2. 각 공고별 정산 요약 조회
    const summaries: JobPostingSettlementSummary[] = [];
    let totalWorkLogs = 0;
    let totalPendingAmount = 0;
    let totalCompletedAmount = 0;

    for (const jobPosting of jobPostings) {
      const summary = await getJobPostingSettlementSummary(jobPosting.id!, ownerId);
      summaries.push(summary);

      totalWorkLogs += summary.totalWorkLogs;
      totalPendingAmount += summary.totalPendingAmount;
      totalCompletedAmount += summary.totalCompletedAmount;
    }

    const result = {
      totalJobPostings: jobPostings.length,
      totalWorkLogs,
      totalPendingAmount,
      totalCompletedAmount,
      summariesByJobPosting: summaries,
    };

    logger.info('전체 정산 요약 조회 완료', {
      totalJobPostings: result.totalJobPostings,
      totalWorkLogs: result.totalWorkLogs,
    });

    return result;
  } catch (error) {
    throw handleServiceError(error, {
      operation: '전체 정산 요약 조회',
      component: 'settlementService',
      context: { ownerId },
    });
  }
}

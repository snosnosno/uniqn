/**
 * UNIQN Mobile - 정산 관리 서비스 (구인자용)
 *
 * @description 근무 기록 조회, 시간 수정, 정산 처리 서비스
 * @version 1.1.0
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { mapFirebaseError } from '@/errors';
import {
  type SalaryInfo as UtilitySalaryInfo,
  calculateHoursWorked as utilCalculateHoursWorked,
  calculatePayByType as utilCalculatePayByType,
} from '@/utils/settlement';
import type {
  WorkLog,
  PayrollStatus,
  JobPosting,
} from '@/types';

// ============================================================================
// Constants
// ============================================================================

const WORK_LOGS_COLLECTION = 'workLogs';
const JOB_POSTINGS_COLLECTION = 'jobPostings';

// ============================================================================
// Types
// ============================================================================

/**
 * 정산 대상 근무 기록 (확장된 정보 포함)
 */
export interface SettlementWorkLog extends WorkLog {
  staffName?: string;
  jobPostingTitle?: string;
  calculatedAmount?: number;
  hoursWorked?: number;
}

/**
 * 정산 계산 입력
 */
export interface CalculateSettlementInput {
  workLogId: string;
  deductions?: number; // 공제액
}

/**
 * 정산 계산 결과
 */
export interface SettlementCalculation {
  workLogId: string;
  salaryType: 'hourly' | 'daily' | 'monthly' | 'other';
  hoursWorked: number;
  grossPay: number;
  deductions: number;
  netPay: number;
}

/**
 * 개별 정산 입력
 */
export interface SettleWorkLogInput {
  workLogId: string;
  amount: number;
  notes?: string;
}

/**
 * 일괄 정산 입력
 */
export interface BulkSettlementInput {
  workLogIds: string[];
  settlementDate?: Date;
  notes?: string;
}

/**
 * 정산 결과
 */
export interface SettlementResult {
  success: boolean;
  workLogId: string;
  amount: number;
  message: string;
}

/**
 * 일괄 정산 결과
 */
export interface BulkSettlementResult {
  totalCount: number;
  successCount: number;
  failedCount: number;
  totalAmount: number;
  results: SettlementResult[];
}

/**
 * 공고별 정산 요약
 */
export interface JobPostingSettlementSummary {
  jobPostingId: string;
  jobPostingTitle: string;
  totalWorkLogs: number;
  completedWorkLogs: number;
  pendingSettlement: number;
  completedSettlement: number;
  totalPendingAmount: number;
  totalCompletedAmount: number;
  workLogsByRole: Record<string, {
    count: number;
    pendingAmount: number;
    completedAmount: number;
  }>;
}

/**
 * 시간 수정 입력
 */
export interface UpdateWorkTimeInput {
  workLogId: string;
  /** 출근 시간 (null = 미정) */
  checkInTime?: Date | null;
  /** 퇴근 시간 (null = 미정) */
  checkOutTime?: Date | null;
  notes?: string;
  reason?: string; // 수정 사유
}

/**
 * 정산 필터
 */
export interface SettlementFilters {
  jobPostingId?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  payrollStatus?: PayrollStatus;
  role?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 근무 시간 계산 (시간 단위) - 유틸리티 래퍼
 */
function calculateHoursWorked(
  startTime: Timestamp | string | Date | null | undefined,
  endTime: Timestamp | string | Date | null | undefined
): number {
  // Timestamp를 Date로 변환
  const start = startTime instanceof Timestamp ? startTime.toDate() : startTime;
  const end = endTime instanceof Timestamp ? endTime.toDate() : endTime;
  return utilCalculateHoursWorked(start, end);
}

/**
 * 날짜 문자열을 YYYY-MM-DD 형식으로 변환 (향후 날짜 필터링 시 활용)
 * export for future use - suppresses unused warning
 */
export function formatSettlementDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ============================================================================
// Settlement Service
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

    // 1. 공고 소유권 확인
    const jobRef = doc(getFirebaseDb(), JOB_POSTINGS_COLLECTION, jobPostingId);
    const jobDoc = await getDoc(jobRef);

    if (!jobDoc.exists()) {
      throw new Error('존재하지 않는 공고입니다');
    }

    const jobPosting = jobDoc.data() as JobPosting;

    if (jobPosting.ownerId !== ownerId) {
      throw new Error('본인의 공고만 조회할 수 있습니다');
    }

    // 2. 근무 기록 쿼리 생성
    const workLogsRef = collection(getFirebaseDb(), WORK_LOGS_COLLECTION);
    const q = query(
      workLogsRef,
      where('eventId', '==', jobPostingId),
      orderBy('date', 'desc')
    );

    const snapshot = await getDocs(q);
    let workLogs: SettlementWorkLog[] = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
      jobPostingTitle: jobPosting.title,
    })) as SettlementWorkLog[];

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

    // 4. 근무 시간 및 예상 정산액 계산
    workLogs = workLogs.map((wl) => {
      const hoursWorked = calculateHoursWorked(wl.actualStartTime, wl.actualEndTime);

      // 급여 타입별 계산 (커스텀 역할 지원)
      const wlWithCustomRole = wl as SettlementWorkLog & { customRole?: string };
      const salaryInfo = getRoleSalaryInfo(jobPosting, wl.role, wlWithCustomRole.customRole);
      const calculatedAmount = calculatePayByType(salaryInfo, hoursWorked);

      return {
        ...wl,
        hoursWorked: Math.round(hoursWorked * 100) / 100,
        calculatedAmount,
      };
    });

    logger.info('공고별 근무 기록 조회 완료', {
      jobPostingId,
      count: workLogs.length,
    });

    return workLogs;
  } catch (error) {
    logger.error('공고별 근무 기록 조회 실패', error as Error, { jobPostingId });
    throw error instanceof Error ? error : mapFirebaseError(error);
  }
}

/**
 * 역할별 급여 정보 조회 헬퍼
 * @param jobPosting - 공고 정보
 * @param role - 역할 코드
 * @param customRole - 커스텀 역할명 (role이 'other'일 때)
 * @returns 급여 타입과 금액
 */
function getRoleSalaryInfo(jobPosting: JobPosting, role: string, customRole?: string): UtilitySalaryInfo {
  // 역할별 급여 확인
  if (jobPosting.roleSalaries) {
    // 커스텀 역할이면 customRole을 키로 사용
    const effectiveRole = role === 'other' && customRole ? customRole : role;
    const roleSalary = jobPosting.roleSalaries[effectiveRole];
    if (roleSalary && roleSalary.type !== 'other') {
      return {
        type: roleSalary.type,
        amount: roleSalary.amount,
      };
    }
  }

  // 기본 급여 fallback
  return {
    type: jobPosting.salary.type as UtilitySalaryInfo['type'],
    amount: jobPosting.salary.amount,
  };
}

/**
 * 급여 타입별 정산 금액 계산 - 유틸리티 래퍼
 */
function calculatePayByType(salaryInfo: UtilitySalaryInfo, hoursWorked: number): number {
  return utilCalculatePayByType(salaryInfo, hoursWorked);
}

/**
 * 정산 금액 계산
 *
 * @description 급여 타입별 정산 금액 계산
 * - 시급: 근무시간 × 시급
 * - 일급: 일급 전액 (출근 시)
 * - 월급: 월급 ÷ 22일 (일할 계산)
 */
export async function calculateSettlement(
  input: CalculateSettlementInput,
  ownerId: string
): Promise<SettlementCalculation> {
  try {
    logger.info('정산 금액 계산', { workLogId: input.workLogId, ownerId });

    // 1. 근무 기록 조회
    const workLogRef = doc(getFirebaseDb(), WORK_LOGS_COLLECTION, input.workLogId);
    const workLogDoc = await getDoc(workLogRef);

    if (!workLogDoc.exists()) {
      throw new Error('근무 기록을 찾을 수 없습니다');
    }

    const workLog = workLogDoc.data() as WorkLog & { customRole?: string };

    // 2. 공고 조회 및 소유권 확인
    const jobRef = doc(getFirebaseDb(), JOB_POSTINGS_COLLECTION, workLog.eventId);
    const jobDoc = await getDoc(jobRef);

    if (!jobDoc.exists()) {
      throw new Error('공고를 찾을 수 없습니다');
    }

    const jobPosting = jobDoc.data() as JobPosting;

    if (jobPosting.ownerId !== ownerId) {
      throw new Error('본인의 공고에 대한 정산만 계산할 수 있습니다');
    }

    // 3. 근무 시간 계산
    const hoursWorked = calculateHoursWorked(workLog.actualStartTime, workLog.actualEndTime);

    // 4. 급여 정보 조회 (커스텀 역할 지원)
    const salaryInfo = getRoleSalaryInfo(jobPosting, workLog.role, workLog.customRole);

    // 5. 타입별 금액 계산
    const grossPay = calculatePayByType(salaryInfo, hoursWorked);
    const deductions = input.deductions ?? 0;
    const netPay = grossPay - deductions;

    const result: SettlementCalculation = {
      workLogId: input.workLogId,
      salaryType: salaryInfo.type,
      hoursWorked: Math.round(hoursWorked * 100) / 100,
      grossPay,
      deductions,
      netPay,
    };

    logger.info('정산 금액 계산 완료', { workLogId: input.workLogId, netPay, salaryType: salaryInfo.type });

    return result;
  } catch (error) {
    logger.error('정산 금액 계산 실패', error as Error, { workLogId: input.workLogId });
    throw error instanceof Error ? error : mapFirebaseError(error);
  }
}

/**
 * 근무 시간 수정 (구인자용)
 *
 * @description 출퇴근 시간 수정 (사유 기록 필수)
 */
export async function updateWorkTime(
  input: UpdateWorkTimeInput,
  ownerId: string
): Promise<void> {
  try {
    logger.info('근무 시간 수정 시작', { input, ownerId });

    await runTransaction(getFirebaseDb(), async (transaction) => {
      // 1. 근무 기록 조회
      const workLogRef = doc(getFirebaseDb(), WORK_LOGS_COLLECTION, input.workLogId);
      const workLogDoc = await transaction.get(workLogRef);

      if (!workLogDoc.exists()) {
        throw new Error('근무 기록을 찾을 수 없습니다');
      }

      const workLog = workLogDoc.data() as WorkLog;

      // 2. 공고 조회 및 소유권 확인
      const jobRef = doc(getFirebaseDb(), JOB_POSTINGS_COLLECTION, workLog.eventId);
      const jobDoc = await transaction.get(jobRef);

      if (!jobDoc.exists()) {
        throw new Error('공고를 찾을 수 없습니다');
      }

      const jobPosting = jobDoc.data() as JobPosting;

      if (jobPosting.ownerId !== ownerId) {
        throw new Error('본인의 공고에 대한 근무 기록만 수정할 수 있습니다');
      }

      // 3. 이미 정산 완료된 경우 수정 불가
      if (workLog.payrollStatus === 'completed') {
        throw new Error('이미 정산 완료된 근무 기록은 수정할 수 없습니다');
      }

      // 4. 수정 데이터 준비 (checkInTime/checkOutTime 사용, null = 미정)
      const workLogWithCheck = workLog as WorkLog & { checkInTime?: unknown; checkOutTime?: unknown };
      const updateData: Record<string, unknown> = {
        updatedAt: serverTimestamp(),
      };

      // checkInTime 설정 (undefined면 건드리지 않음, null이면 미정으로 저장)
      if (input.checkInTime !== undefined) {
        updateData.checkInTime = input.checkInTime ? Timestamp.fromDate(input.checkInTime) : null;
        // 레거시 호환
        if (input.checkInTime) {
          updateData.actualStartTime = Timestamp.fromDate(input.checkInTime);
        }
      }

      // checkOutTime 설정
      if (input.checkOutTime !== undefined) {
        updateData.checkOutTime = input.checkOutTime ? Timestamp.fromDate(input.checkOutTime) : null;
        // 레거시 호환
        if (input.checkOutTime) {
          updateData.actualEndTime = Timestamp.fromDate(input.checkOutTime);
        }
      }

      if (input.notes !== undefined) {
        updateData.notes = input.notes;
      }

      // 수정 이력 기록 (기존 시간 우선: checkInTime/checkOutTime)
      const prevCheckIn = workLogWithCheck.checkInTime ?? workLog.actualStartTime;
      const prevCheckOut = workLogWithCheck.checkOutTime ?? workLog.actualEndTime;

      const modificationLog = {
        modifiedAt: new Date().toISOString(),
        modifiedBy: ownerId,
        reason: input.reason || '시간 수정',
        previousStartTime: prevCheckIn ?? null,
        previousEndTime: prevCheckOut ?? null,
        newStartTime: input.checkInTime !== undefined
          ? (input.checkInTime ? Timestamp.fromDate(input.checkInTime) : null)
          : undefined,
        newEndTime: input.checkOutTime !== undefined
          ? (input.checkOutTime ? Timestamp.fromDate(input.checkOutTime) : null)
          : undefined,
      };

      updateData.modificationHistory = [
        ...(workLog.modificationHistory || []),
        modificationLog,
      ];

      transaction.update(workLogRef, updateData);
    });

    logger.info('근무 시간 수정 완료', { workLogId: input.workLogId });
  } catch (error) {
    logger.error('근무 시간 수정 실패', error as Error, { input });
    throw error instanceof Error ? error : mapFirebaseError(error);
  }
}

/**
 * 개별 정산 처리
 *
 * @description 단일 근무 기록 정산 완료 처리
 */
export async function settleWorkLog(
  input: SettleWorkLogInput,
  ownerId: string
): Promise<SettlementResult> {
  try {
    logger.info('개별 정산 처리 시작', { input, ownerId });

    await runTransaction(getFirebaseDb(), async (transaction) => {
      // 1. 근무 기록 조회
      const workLogRef = doc(getFirebaseDb(), WORK_LOGS_COLLECTION, input.workLogId);
      const workLogDoc = await transaction.get(workLogRef);

      if (!workLogDoc.exists()) {
        throw new Error('근무 기록을 찾을 수 없습니다');
      }

      const workLog = workLogDoc.data() as WorkLog;

      // 2. 공고 조회 및 소유권 확인
      const jobRef = doc(getFirebaseDb(), JOB_POSTINGS_COLLECTION, workLog.eventId);
      const jobDoc = await transaction.get(jobRef);

      if (!jobDoc.exists()) {
        throw new Error('공고를 찾을 수 없습니다');
      }

      const jobPosting = jobDoc.data() as JobPosting;

      if (jobPosting.ownerId !== ownerId) {
        throw new Error('본인의 공고에 대한 정산만 처리할 수 있습니다');
      }

      // 3. 출퇴근 완료 여부 확인
      if (workLog.status !== 'checked_out' && workLog.status !== 'completed') {
        throw new Error('출퇴근이 완료된 근무 기록만 정산할 수 있습니다');
      }

      // 4. 중복 정산 방지
      if (workLog.payrollStatus === 'completed') {
        throw new Error('이미 정산 완료된 근무 기록입니다');
      }

      // 5. 정산 처리
      const updateData: Record<string, unknown> = {
        payrollStatus: 'completed',
        payrollAmount: input.amount,
        payrollDate: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // notes가 있을 때만 포함 (undefined는 Firebase에서 허용되지 않음)
      if (input.notes !== undefined) {
        updateData.payrollNotes = input.notes;
      }

      transaction.update(workLogRef, updateData);
    });

    logger.info('개별 정산 처리 완료', { workLogId: input.workLogId, amount: input.amount });

    return {
      success: true,
      workLogId: input.workLogId,
      amount: input.amount,
      message: '정산이 완료되었습니다',
    };
  } catch (error) {
    logger.error('개별 정산 처리 실패', error as Error, { input });

    return {
      success: false,
      workLogId: input.workLogId,
      amount: 0,
      message: error instanceof Error ? error.message : '정산 처리에 실패했습니다',
    };
  }
}

/**
 * 일괄 정산 처리
 *
 * @description 여러 근무 기록 한번에 정산 완료 처리
 */
export async function bulkSettlement(
  input: BulkSettlementInput,
  ownerId: string
): Promise<BulkSettlementResult> {
  try {
    logger.info('일괄 정산 처리 시작', { count: input.workLogIds.length, ownerId });

    const results: SettlementResult[] = [];
    let successCount = 0;
    let failedCount = 0;
    let totalAmount = 0;

    // Firestore 배치 제한: 500개
    const batchSize = 500;
    const batches: string[][] = [];

    for (let i = 0; i < input.workLogIds.length; i += batchSize) {
      batches.push(input.workLogIds.slice(i, i + batchSize));
    }

    for (const batchIds of batches) {
      await runTransaction(getFirebaseDb(), async (transaction) => {
        // 1. 모든 근무 기록 조회
        const workLogDocs = await Promise.all(
          batchIds.map(async (id) => {
            const ref = doc(getFirebaseDb(), WORK_LOGS_COLLECTION, id);
            const docSnap = await transaction.get(ref);
            return { id, ref, doc: docSnap };
          })
        );

        // 2. 공고별로 그룹화하여 소유권 확인
        const jobPostingIds = new Set<string>();
        workLogDocs.forEach((wl) => {
          if (wl.doc.exists()) {
            const data = wl.doc.data() as WorkLog;
            jobPostingIds.add(data.eventId);
          }
        });

        const jobPostings = new Map<string, JobPosting>();
        for (const jobId of jobPostingIds) {
          const jobRef = doc(getFirebaseDb(), JOB_POSTINGS_COLLECTION, jobId);
          const jobDoc = await transaction.get(jobRef);
          if (jobDoc.exists()) {
            jobPostings.set(jobId, jobDoc.data() as JobPosting);
          }
        }

        // 3. 각 근무 기록 처리
        for (const { id, ref, doc: workLogDoc } of workLogDocs) {
          if (!workLogDoc.exists()) {
            results.push({
              success: false,
              workLogId: id,
              amount: 0,
              message: '근무 기록을 찾을 수 없습니다',
            });
            failedCount++;
            continue;
          }

          const workLog = workLogDoc.data() as WorkLog & { customRole?: string };
          const jobPosting = jobPostings.get(workLog.eventId);

          // 소유권 확인
          if (!jobPosting || jobPosting.ownerId !== ownerId) {
            results.push({
              success: false,
              workLogId: id,
              amount: 0,
              message: '본인의 공고가 아닙니다',
            });
            failedCount++;
            continue;
          }

          // 상태 확인
          if (workLog.status !== 'checked_out' && workLog.status !== 'completed') {
            results.push({
              success: false,
              workLogId: id,
              amount: 0,
              message: '출퇴근이 완료되지 않았습니다',
            });
            failedCount++;
            continue;
          }

          // 이미 정산 완료
          if (workLog.payrollStatus === 'completed') {
            results.push({
              success: false,
              workLogId: id,
              amount: 0,
              message: '이미 정산 완료되었습니다',
            });
            failedCount++;
            continue;
          }

          // 정산 금액 계산 (급여 타입별, 커스텀 역할 지원)
          const hoursWorked = calculateHoursWorked(workLog.actualStartTime, workLog.actualEndTime);
          const salaryInfo = getRoleSalaryInfo(jobPosting, workLog.role, workLog.customRole);
          const amount = calculatePayByType(salaryInfo, hoursWorked);

          // 정산 처리
          const updateData: Record<string, unknown> = {
            payrollStatus: 'completed',
            payrollAmount: amount,
            payrollDate: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };

          if (input.notes !== undefined) {
            updateData.payrollNotes = input.notes;
          }

          transaction.update(ref, updateData);

          results.push({
            success: true,
            workLogId: id,
            amount,
            message: '정산 완료',
          });
          successCount++;
          totalAmount += amount;
        }
      });
    }

    const result: BulkSettlementResult = {
      totalCount: input.workLogIds.length,
      successCount,
      failedCount,
      totalAmount,
      results,
    };

    logger.info('일괄 정산 처리 완료', {
      totalCount: result.totalCount,
      successCount: result.successCount,
      failedCount: result.failedCount,
      totalAmount: result.totalAmount,
    });

    return result;
  } catch (error) {
    logger.error('일괄 정산 처리 실패', error as Error, { workLogCount: input.workLogIds.length });
    throw error instanceof Error ? error : mapFirebaseError(error);
  }
}

/**
 * 정산 상태 변경
 *
 * @description 정산 상태만 변경 (금액 변경 없음)
 */
export async function updateSettlementStatus(
  workLogId: string,
  status: PayrollStatus,
  ownerId: string
): Promise<void> {
  try {
    logger.info('정산 상태 변경', { workLogId, status, ownerId });

    await runTransaction(getFirebaseDb(), async (transaction) => {
      // 1. 근무 기록 조회
      const workLogRef = doc(getFirebaseDb(), WORK_LOGS_COLLECTION, workLogId);
      const workLogDoc = await transaction.get(workLogRef);

      if (!workLogDoc.exists()) {
        throw new Error('근무 기록을 찾을 수 없습니다');
      }

      const workLog = workLogDoc.data() as WorkLog;

      // 2. 공고 조회 및 소유권 확인
      const jobRef = doc(getFirebaseDb(), JOB_POSTINGS_COLLECTION, workLog.eventId);
      const jobDoc = await transaction.get(jobRef);

      if (!jobDoc.exists()) {
        throw new Error('공고를 찾을 수 없습니다');
      }

      const jobPosting = jobDoc.data() as JobPosting;

      if (jobPosting.ownerId !== ownerId) {
        throw new Error('본인의 공고에 대한 정산만 처리할 수 있습니다');
      }

      // 3. 상태 업데이트
      const updateData: Record<string, unknown> = {
        payrollStatus: status,
        updatedAt: serverTimestamp(),
      };

      if (status === 'completed') {
        updateData.payrollDate = serverTimestamp();
      }

      transaction.update(workLogRef, updateData);
    });

    logger.info('정산 상태 변경 완료', { workLogId, status });
  } catch (error) {
    logger.error('정산 상태 변경 실패', error as Error, { workLogId, status });
    throw error instanceof Error ? error : mapFirebaseError(error);
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

    // 1. 공고 조회 및 소유권 확인
    const jobRef = doc(getFirebaseDb(), JOB_POSTINGS_COLLECTION, jobPostingId);
    const jobDoc = await getDoc(jobRef);

    if (!jobDoc.exists()) {
      throw new Error('존재하지 않는 공고입니다');
    }

    const jobPosting = jobDoc.data() as JobPosting;

    if (jobPosting.ownerId !== ownerId) {
      throw new Error('본인의 공고만 조회할 수 있습니다');
    }

    // 2. 근무 기록 조회
    const workLogsRef = collection(getFirebaseDb(), WORK_LOGS_COLLECTION);
    const q = query(
      workLogsRef,
      where('eventId', '==', jobPostingId)
    );

    const snapshot = await getDocs(q);
    const workLogs: WorkLog[] = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as WorkLog[];

    // 3. 통계 계산
    let completedWorkLogs = 0;
    let pendingSettlement = 0;
    let completedSettlement = 0;
    let totalPendingAmount = 0;
    let totalCompletedAmount = 0;
    const workLogsByRole: Record<string, {
      count: number;
      pendingAmount: number;
      completedAmount: number;
    }> = {};

    workLogs.forEach((workLog) => {
      // 커스텀 역할 지원: role이 'other'이면 customRole을 키로 사용
      const workLogWithCustomRole = workLog as WorkLog & { customRole?: string };
      const effectiveRole = workLog.role === 'other' && workLogWithCustomRole.customRole
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
      if (workLog.status === 'checked_out' || workLog.status === 'completed') {
        completedWorkLogs++;

        // 정산 상태별 분류
        const amount = workLog.payrollAmount || 0;

        if (workLog.payrollStatus === 'completed') {
          completedSettlement++;
          totalCompletedAmount += amount;
          workLogsByRole[effectiveRole].completedAmount += amount;
        } else {
          pendingSettlement++;
          // 미정산인 경우 예상 금액 계산 (급여 타입별, 커스텀 역할 지원)
          const hoursWorked = calculateHoursWorked(workLog.actualStartTime, workLog.actualEndTime);
          const salaryInfo = getRoleSalaryInfo(jobPosting, workLog.role, workLogWithCustomRole.customRole);
          const estimatedAmount = calculatePayByType(salaryInfo, hoursWorked);

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
    logger.error('공고별 정산 요약 조회 실패', error as Error, { jobPostingId });
    throw error instanceof Error ? error : mapFirebaseError(error);
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

    // 1. 내 공고 조회
    const jobsRef = collection(getFirebaseDb(), JOB_POSTINGS_COLLECTION);
    const jobsQuery = query(
      jobsRef,
      where('ownerId', '==', ownerId)
    );

    const jobsSnapshot = await getDocs(jobsQuery);
    const jobPostings = jobsSnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as JobPosting[];

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
    logger.error('전체 정산 요약 조회 실패', error as Error, { ownerId });
    throw mapFirebaseError(error);
  }
}

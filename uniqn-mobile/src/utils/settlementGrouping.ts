/**
 * UNIQN Mobile - 정산 그룹핑 유틸리티
 *
 * 같은 스태프(staffId)의 여러 WorkLog를 하나의 카드로 통합
 *
 * @version 1.0.0
 */

import { getRoleDisplayName } from '@/types/unified';
import type { WorkLog } from '@/types/schedule';
import { STATUS } from '@/constants';
import type {
  GroupedSettlement,
  DateSettlementStatus,
  GroupSettlementOptions,
} from '@/types/settlement';
import {
  getRoleSalaryFromRoles,
  getEffectiveAllowances,
  getEffectiveTaxSettings,
  type SalaryInfo,
  type Allowances,
  type TaxSettings,
} from './settlement';
import { SettlementCalculator } from '@/domains/settlement';
import { isConsecutiveDates, formatSingleDate } from './scheduleGrouping';

// ============================================================================
// Re-export date formatting functions from scheduleGrouping
// ============================================================================

export {
  isConsecutiveDates,
  formatSingleDate,
  formatDateDisplay,
  formatRolesDisplay,
} from './scheduleGrouping';

// ============================================================================
// 정산 완료 동결값 판정 (SSOT)
// ============================================================================

/**
 * 정산 완료 건이 동결된 표시액(payrollAmount)을 진실원으로 써야 하는지 판정한다.
 *
 * 완료 시점에 확정·지급된 금액은 이후 공고 급여 설정이 바뀌어도 소급 변경되면
 * 안 되므로 동결값을 우선한다. 동결값이 없는 레거시 완료 행만 재계산으로 fallback.
 *
 * ⚠️ `Number.isFinite`로 판정한다 — **동결값 0도 존중**한다(노쇼 등 정산 0원 완료
 * 건). `amount > 0` 가드로 판정하면 0원 완료 건이 재계산 fallback으로 새어나가
 * ScheduleCard 표시액과 정산 목록(settlementGrouping)이 어긋난다. 두 소비처가
 * 반드시 이 헬퍼를 공유해야 계약이 일치한다.
 */
export function shouldUseFrozenPayrollAmount(
  isCompleted: boolean,
  payrollAmount: number | null | undefined
): payrollAmount is number {
  return isCompleted && Number.isFinite(payrollAmount);
}

// ============================================================================
// Types
// ============================================================================

/** 그룹핑에 필요한 컨텍스트 정보 */
export interface SettlementGroupingContext {
  /** 역할 배열 (salary 포함) */
  roles?: { role?: string; name?: string; customRole?: string; salary?: SalaryInfo }[];
  /** 기본 급여 */
  defaultSalary?: SalaryInfo;
  /** 수당 정보 */
  allowances?: Allowances;
  /** 세금 설정 */
  taxSettings?: TaxSettings;
}

function splitDatesByAvailability(dates: string[]): { dated: string[]; undated: string[] } {
  return {
    dated: dates.filter((date) => typeof date === 'string' && date.trim().length > 0).sort(),
    undated: dates.filter((date) => !date || date.trim().length === 0),
  };
}

function compareSettlementDates(a: string, b: string): number {
  const hasDateA = !!a;
  const hasDateB = !!b;

  if (hasDateA && hasDateB) {
    return a.localeCompare(b);
  }
  if (hasDateA) {
    return -1;
  }
  if (hasDateB) {
    return 1;
  }
  return 0;
}

function compareSettlementGroupStartDesc(a: GroupedSettlement, b: GroupedSettlement): number {
  const startA = a.dateRange.start;
  const startB = b.dateRange.start;

  if (startA && startB) {
    return startB.localeCompare(startA);
  }
  if (startA) {
    return -1;
  }
  if (startB) {
    return 1;
  }
  return 0;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * WorkLog에서 스태프 프로필 정보 추출
 */
function extractStaffProfile(workLog: WorkLog): GroupedSettlement['staffProfile'] {
  return {
    name: workLog.staffName,
    nickname: workLog.staffNickname,
    photoURL: workLog.staffPhotoURL,
    photoURLBlurhash: workLog.staffPhotoURLBlurhash,
  };
}

/**
 * WorkLog에서 DateSettlementStatus 생성
 */
function createDateSettlementStatus(
  workLog: WorkLog,
  context: SettlementGroupingContext
): DateSettlementStatus {
  // 급여/수당/세금 정보 결정 (개별 오버라이드 우선)
  const salaryInfo =
    workLog.customSalaryInfo ||
    getRoleSalaryFromRoles(context.roles, workLog.role, workLog.customRole, context.defaultSalary);
  const allowances = getEffectiveAllowances(workLog, context.allowances);
  const taxSettings = getEffectiveTaxSettings(workLog, context.taxSettings);

  // 정산 금액 계산 (SettlementCalculator 단일 소스 사용)
  const settlementResult = SettlementCalculator.calculate({
    startTime: workLog.checkInTime,
    endTime: workLog.checkOutTime,
    salaryInfo,
    allowances,
    taxSettings,
  });

  const payrollStatus = workLog.payrollStatus || STATUS.PAYROLL.PENDING;

  // 정산 완료 건은 완료 시점에 동결된 금액(payrollAmount)을 진실원으로 사용한다.
  // 구인자가 완료 후 공고 급여 설정을 바꿔도 이미 확정·지급된 표시액이 소급 변경되지 않도록 방어.
  // 동결값이 없는 레거시 완료 행은 재계산으로 안전하게 fallback한다.
  const isCompleted = payrollStatus === STATUS.PAYROLL.COMPLETED;
  const amount = shouldUseFrozenPayrollAmount(isCompleted, workLog.payrollAmount)
    ? workLog.payrollAmount
    : settlementResult.afterTaxPay;

  // 출퇴근 완료 여부 확인
  const hasValidTimes = !!(workLog.checkInTime && workLog.checkOutTime);

  return {
    date: workLog.date,
    formattedDate: formatSingleDate(workLog.date),
    payrollStatus,
    amount,
    workLogId: workLog.id,
    role: workLog.role,
    customRole: workLog.customRole,
    hasValidTimes,
  };
}

/**
 * WorkLog 배열에서 GroupedSettlement 생성
 */
function createGroupedSettlement(
  staffId: string,
  workLogs: WorkLog[],
  context: SettlementGroupingContext
): GroupedSettlement {
  if (workLogs.length === 0) {
    throw new Error('Cannot create grouped settlement from empty array');
  }

  // 첫 번째 WorkLog에서 공통 정보 추출
  const firstWorkLog = workLogs[0];

  // 날짜 수집 및 정렬
  const uniqueDates = [...new Set(workLogs.map((wl) => wl.date))];
  const { dated: datedDates, undated: undatedDates } = splitDatesByAvailability(uniqueDates);
  const dates = [...datedDates, ...undatedDates];

  // 역할 수집 (Map 기반으로 role-customRole 1:1 매핑 유지)
  const roleMap = new Map<string, string | undefined>();
  for (const workLog of workLogs) {
    if (!roleMap.has(workLog.role)) {
      roleMap.set(workLog.role, workLog.customRole);
    }
  }
  const roles = Array.from(roleMap.keys());
  const alignedCustomRoles = roles.map((role) => roleMap.get(role));

  // 날짜별 정산 상태 생성
  const dateStatuses: DateSettlementStatus[] = workLogs
    .map((wl) => createDateSettlementStatus(wl, context))
    .sort((a, b) => compareSettlementDates(a.date, b.date));

  // 정산 요약 계산
  let totalAmount = 0;
  let pendingAmount = 0;
  let completedAmount = 0;
  let pendingCount = 0;
  let completedCount = 0;
  let settlableCount = 0;

  for (const status of dateStatuses) {
    totalAmount += status.amount;

    if (status.payrollStatus === STATUS.PAYROLL.COMPLETED) {
      completedCount++;
      completedAmount += status.amount;
    } else {
      pendingCount++;
      pendingAmount += status.amount;

      // 정산 가능: 출퇴근 완료 + 미정산
      if (status.hasValidTimes) {
        settlableCount++;
      }
    }
  }

  // 대표 정산 상태 결정
  let overallStatus: GroupedSettlement['overallStatus'];
  if (completedCount === 0) {
    overallStatus = 'all_pending';
  } else if (pendingCount === 0) {
    overallStatus = 'all_completed';
  } else {
    overallStatus = 'partial';
  }

  return {
    id: `grouped_settlement_${staffId}`,
    staffId,
    jobPostingId: firstWorkLog.jobPostingId,
    staffProfile: extractStaffProfile(firstWorkLog),
    dateRange: {
      start: datedDates[0] ?? '',
      end: datedDates[datedDates.length - 1] ?? '',
      dates,
      totalDays: dates.length,
      isConsecutive: datedDates.length > 0 ? isConsecutiveDates(datedDates) : false,
    },
    roles,
    customRoles: alignedCustomRoles.some((v) => v !== undefined) ? alignedCustomRoles : undefined,
    dateStatuses,
    originalWorkLogs: workLogs,
    summary: {
      totalCount: workLogs.length,
      pendingCount,
      completedCount,
      totalAmount,
      pendingAmount,
      completedAmount,
      settlableCount,
    },
    overallStatus,
  };
}

// ============================================================================
// Main Functions
// ============================================================================

/**
 * 정산 WorkLog를 스태프별로 그룹화
 *
 * 같은 staffId의 WorkLog들을 GroupedSettlement로 통합
 *
 * @param workLogs - WorkLog 배열
 * @param context - 그룹핑 컨텍스트 (roles, defaultSalary, allowances, taxSettings)
 * @param options - 그룹핑 옵션
 * @returns GroupedSettlement 배열 (항상 그룹화된 형태)
 *
 * @example
 * const workLogs = [...]; // 스태프 A의 3일 근무 기록
 * const grouped = groupSettlementsByStaff(workLogs, context);
 * // → [GroupedSettlement] (1개의 통합 카드)
 */
export function groupSettlementsByStaff(
  workLogs: WorkLog[],
  context: SettlementGroupingContext,
  options: GroupSettlementOptions = {}
): GroupedSettlement[] {
  const { enabled = true } = options;

  // 그룹핑 비활성화 시에도 단일 WorkLog를 개별 그룹으로 변환해 반환 형태는 동일
  if (!enabled) {
    // 단순히 각 WorkLog를 개별 GroupedSettlement로 변환
    const staffMap = new Map<string, WorkLog[]>();

    for (const workLog of workLogs) {
      const staffId = workLog.staffId;
      if (!staffMap.has(staffId)) {
        staffMap.set(staffId, []);
      }
      staffMap.get(staffId)!.push(workLog);
    }

    return Array.from(staffMap.entries()).map(([staffId, logs]) =>
      createGroupedSettlement(staffId, logs, context)
    );
  }

  // 스태프별 그룹 맵 생성
  const staffMap = new Map<string, WorkLog[]>();

  for (const workLog of workLogs) {
    const staffId = workLog.staffId;

    if (!staffMap.has(staffId)) {
      staffMap.set(staffId, []);
    }
    staffMap.get(staffId)!.push(workLog);
  }

  // 결과 배열 생성
  const result: GroupedSettlement[] = [];

  for (const [staffId, logs] of staffMap) {
    result.push(createGroupedSettlement(staffId, logs, context));
  }

  // 날짜순 정렬 (최신순)
  result.sort(compareSettlementGroupStartDesc);

  return result;
}

/**
 * 그룹에서 정산 가능한 WorkLog ID 배열 반환
 *
 * 정산 가능 조건:
 * 1. 출퇴근 완료 (hasValidTimes = true)
 * 2. 미정산 상태 (payrollStatus !== 'completed')
 *
 * @param group - GroupedSettlement
 * @returns 정산 가능한 WorkLog ID 배열
 */
export function getSettlableWorkLogIds(group: GroupedSettlement): string[] {
  return group.dateStatuses
    .filter((status) => status.hasValidTimes && status.payrollStatus !== STATUS.PAYROLL.COMPLETED)
    .map((status) => status.workLogId);
}

/**
 * 그룹 목록의 전체 통계 계산
 *
 * @param groups - GroupedSettlement 배열
 * @returns 전체 통계
 */
export function calculateGroupedSettlementStats(groups: GroupedSettlement[]): {
  totalGroups: number;
  totalWorkLogs: number;
  totalPendingCount: number;
  totalCompletedCount: number;
  totalAmount: number;
  totalPendingAmount: number;
  totalCompletedAmount: number;
  totalSettlableCount: number;
} {
  let totalWorkLogs = 0;
  let totalPendingCount = 0;
  let totalCompletedCount = 0;
  let totalAmount = 0;
  let totalPendingAmount = 0;
  let totalCompletedAmount = 0;
  let totalSettlableCount = 0;

  for (const group of groups) {
    totalWorkLogs += group.summary.totalCount;
    totalPendingCount += group.summary.pendingCount;
    totalCompletedCount += group.summary.completedCount;
    totalAmount += group.summary.totalAmount;
    totalPendingAmount += group.summary.pendingAmount;
    totalCompletedAmount += group.summary.completedAmount;
    totalSettlableCount += group.summary.settlableCount;
  }

  return {
    totalGroups: groups.length,
    totalWorkLogs,
    totalPendingCount,
    totalCompletedCount,
    totalAmount,
    totalPendingAmount,
    totalCompletedAmount,
    totalSettlableCount,
  };
}

/**
 * 역할별 표시명 포맷팅
 *
 * @param group - GroupedSettlement
 * @returns 포맷된 역할 문자열
 *
 * @example
 * formatGroupRolesDisplay(group) // "딜러" 또는 "딜러 외 1개 역할"
 */
export function formatGroupRolesDisplay(group: GroupedSettlement): string {
  const uniqueRoles = new Set(group.roles);

  if (uniqueRoles.size === 0) return '';

  const roleNames = group.roles.map((role, index) => {
    const customRole = group.customRoles?.[index];
    return getRoleDisplayName(role, customRole);
  });

  // 중복 제거
  const uniqueNames = [...new Set(roleNames)];

  if (uniqueNames.length === 1) {
    return uniqueNames[0];
  }

  return `${uniqueNames[0]} 외 ${uniqueNames.length - 1}개 역할`;
}

/**
 * UNIQN Mobile - 정산 그룹핑 유틸리티
 *
 * 같은 스태프(staffId)의 여러 WorkLog를 하나의 카드로 통합
 *
 * @version 1.0.0
 */

import { getRoleDisplayName } from '@/types/unified';
import type { WorkLog, PayrollStatus } from '@/types/schedule';
import type {
  GroupedSettlement,
  DateSettlementStatus,
  GroupSettlementOptions,
} from '@/types/settlement';
import {
  calculateSettlementFromWorkLogWithTax,
  type SalaryInfo,
  type Allowances,
  type TaxSettings,
} from './settlement';
import {
  isConsecutiveDates,
  formatSingleDate,
} from './scheduleGrouping';

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
  };
}

/**
 * WorkLog에서 DateSettlementStatus 생성
 */
function createDateSettlementStatus(
  workLog: WorkLog,
  context: SettlementGroupingContext
): DateSettlementStatus {
  // 정산 금액 계산
  const settlementResult = calculateSettlementFromWorkLogWithTax(
    {
      actualStartTime: workLog.actualStartTime,
      actualEndTime: workLog.actualEndTime,
      role: workLog.role,
      customRole: workLog.customRole,
      customSalaryInfo: workLog.customSalaryInfo,
      customAllowances: workLog.customAllowances,
      customTaxSettings: workLog.customTaxSettings,
    },
    context.roles,
    context.defaultSalary,
    context.allowances,
    context.taxSettings
  );

  // 출퇴근 완료 여부 확인
  const hasValidTimes = !!(workLog.actualStartTime && workLog.actualEndTime);

  return {
    date: workLog.date,
    formattedDate: formatSingleDate(workLog.date),
    payrollStatus: workLog.payrollStatus || 'pending',
    amount: settlementResult.afterTaxPay,
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
  const dates = [...new Set(workLogs.map((wl) => wl.date))].sort();

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
    .sort((a, b) => a.date.localeCompare(b.date));

  // 정산 요약 계산
  let totalAmount = 0;
  let pendingAmount = 0;
  let completedAmount = 0;
  let pendingCount = 0;
  let completedCount = 0;
  let settlableCount = 0;

  for (const status of dateStatuses) {
    totalAmount += status.amount;

    if (status.payrollStatus === 'completed') {
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
    eventId: firstWorkLog.eventId,
    staffProfile: extractStaffProfile(firstWorkLog),
    dateRange: {
      start: dates[0],
      end: dates[dates.length - 1],
      dates,
      totalDays: dates.length,
      isConsecutive: isConsecutiveDates(dates),
    },
    roles,
    customRoles: alignedCustomRoles.some((v) => v !== undefined)
      ? alignedCustomRoles
      : undefined,
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
  const { enabled = true, minGroupSize = 1 } = options;

  // 그룹핑 비활성화 시에도 minGroupSize=1이면 단일 WorkLog도 그룹화
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
    if (logs.length >= minGroupSize) {
      // 그룹 크기 충족: GroupedSettlement 생성
      result.push(createGroupedSettlement(staffId, logs, context));
    } else {
      // 그룹 크기 미달이어도 minGroupSize=1이면 그룹화
      // (이 경우 minGroupSize > 1 설정 시에만 이 분기 도달)
      result.push(createGroupedSettlement(staffId, logs, context));
    }
  }

  // 날짜순 정렬 (최신순)
  result.sort((a, b) => {
    return b.dateRange.start.localeCompare(a.dateRange.start);
  });

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
    .filter((status) => status.hasValidTimes && status.payrollStatus !== 'completed')
    .map((status) => status.workLogId);
}

/**
 * 그룹에서 정산 가능한 WorkLog 배열 반환
 *
 * @param group - GroupedSettlement
 * @returns 정산 가능한 WorkLog 배열
 */
export function getSettlableWorkLogs(group: GroupedSettlement): WorkLog[] {
  const settlableIds = new Set(getSettlableWorkLogIds(group));
  return group.originalWorkLogs.filter((wl) => settlableIds.has(wl.id));
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
 * 필터링된 그룹 목록 반환
 *
 * @param groups - GroupedSettlement 배열
 * @param payrollStatus - 정산 상태 필터 (선택)
 * @returns 필터링된 GroupedSettlement 배열
 */
export function filterGroupedSettlements(
  groups: GroupedSettlement[],
  payrollStatus?: PayrollStatus
): GroupedSettlement[] {
  if (!payrollStatus) {
    return groups;
  }

  return groups.filter((group) => {
    if (payrollStatus === 'pending') {
      return group.overallStatus === 'all_pending' || group.overallStatus === 'partial';
    }
    if (payrollStatus === 'completed') {
      return group.overallStatus === 'all_completed';
    }
    return true;
  });
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

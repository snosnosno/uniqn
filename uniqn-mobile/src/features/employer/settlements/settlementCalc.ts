/**
 * UNIQN Mobile - 정산 계산 유틸리티 (순수 함수)
 * 스태프/정산 관리 화면(StaffSettlementsScreen)에서 추출.
 *
 * @description 역할/급여 타입 + 근무 기록 금액 계산 + salaryConfig/rolesForList/availableRoles 파생 헬퍼
 */

import { getRoleSalaryFromRoles, calculateSettlementFromWorkLog } from '@/domains/settlement';
import { PAYROLL_STATUS_VALUES, WORK_LOG_STATUS_VALUES } from '@/constants/statusValues';
import type { PostingSettlementContext } from '@/domains/job-posting';
import type { SalaryInfo, TaxSettings } from '@/utils/settlement';
import type { WorkLog, Allowances } from '@/types';

// ============================================================================
// Types
// ============================================================================

/** 역할 + 급여 정보 (SettlementList에 전달) */
export interface RoleWithSalary {
  role?: string;
  name?: string;
  customRole?: string;
  count?: number;
  filled?: number;
  salary?: SalaryInfo;
}

export interface SalaryConfig {
  defaultSalary?: SalaryInfo;
  roles?: RoleWithSalary[];
  allowances?: Allowances;
  taxSettings?: TaxSettings;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * 근무 기록 금액 계산 (통합 유틸리티 사용)
 * - 시급: 근무시간 × 시급
 * - 일급/월급: 전액
 * - 수당, 세금 포함
 */
export function calculateWorkLogAmount(
  workLog: WorkLog & { customRole?: string },
  roles: RoleWithSalary[],
  defaultSalary?: SalaryInfo,
  allowances?: Allowances,
  taxSettings?: TaxSettings
): number {
  // 역할에 따른 급여 정보 결정 (커스텀 역할 지원)
  const salaryInfo = getRoleSalaryFromRoles(roles, workLog.role, workLog.customRole, defaultSalary);

  // 통합 유틸리티로 정산 금액 계산 (수당, 세금 포함)
  // taxSettings 미전달 시 확인 모달이 세전 금액을 표시해 저장값(세후)과 어긋난다
  const { taxAmount, afterTaxPay, totalPay } = calculateSettlementFromWorkLog(
    workLog,
    salaryInfo,
    allowances,
    taxSettings
  );

  // 세금이 있으면 세후 금액, 없으면 세전 금액 반환
  return taxAmount > 0 ? afterTaxPay : totalPay;
}

/**
 * 급여 설정 파생 (v2.0 - 역할별 급여, 수당 포함)
 * useMemo 콜백 본문으로 사용 — postingSettlement -> SalaryConfig
 */
export function deriveSalaryConfig(
  postingSettlement: PostingSettlementContext | undefined
): SalaryConfig {
  return {
    defaultSalary: postingSettlement?.defaultSalary,
    roles:
      postingSettlement?.roles?.map((r) => ({
        role: r.role,
        customRole: r.customRole,
        count: r.count,
        filled: r.filled,
        salary: r.salary,
      })) || [],
    allowances: postingSettlement?.allowances,
    taxSettings: postingSettlement?.taxSettings,
  };
}

/**
 * SettlementList용 역할 목록 (급여 포함)
 */
export function deriveRolesForList(roles: RoleWithSalary[] | undefined): RoleWithSalary[] {
  return roles || [];
}

// `deriveAvailableRoles`(RoleChangeModal 용 역할 키 목록)는 그 모달과 함께 사라졌다.
// 통합 편집 시트의 역할 칩은 공고(`JobPosting`)에서 직접 목록을 뽑으므로 중간 변환이 없다.

/**
 * 정산 대기 건수 — **이미 끝난** 근무 중 지급이 안 된 건의 수.
 *
 * 🚨 종전에는 `payrollStatus !== completed` 한 조건뿐이었다. 그런데 `work_logs` 행은
 *    **확정 시점**에 미래 날짜까지 한꺼번에 만들어진다(`confirm_application`,
 *    20260804140000:178-190 이 `status='scheduled'` 로 INSERT). 그래서 아무도 일하기 전에
 *    허브가 "정산할 근무가 12건 남았어요 · 정산하러 가기" 라고 말했다. 취소·노쇼도 같이
 *    셌다. 정산할 수 없는 근무를 정산 대기로 세면 사장은 그 화면을 열고 아무것도 못 한다.
 *
 * @param today `YYYY-MM-DD`. 시계를 함수 안에서 읽지 않는다 — 순수 함수로 두어야
 *   테스트가 실행 시각에 흔들리지 않는다.
 *
 * @description 정산 화면(`settlements.tsx`)이 탭 배지와 당일 운영 스트립에 쓰던 계산을
 *   순수 함수로 끌어냈다. 화면 안 인라인 로직으로 두었더니 진실원이 "함수"가 아니라
 *   "한 화면 안의 한 줄"이 되어, 같은 숫자가 필요한 공고 상세 허브는 재사용하지 못하고
 *   `pendingSettlementCount={0}` 을 하드코딩하고 있었다 — 정산 대기가 쌓여도 허브에서는
 *   영원히 0건으로 보인다.
 */
export function selectPendingSettlementCount(workLogs: readonly WorkLog[], today: string): number {
  return workLogs.filter(
    (log) =>
      log.payrollStatus !== PAYROLL_STATUS_VALUES.COMPLETED &&
      log.status !== WORK_LOG_STATUS_VALUES.CANCELLED &&
      log.status !== WORK_LOG_STATUS_VALUES.NO_SHOW &&
      Boolean(log.date) &&
      log.date <= today
  ).length;
}

/**
 * UNIQN Mobile - 정산 계산 유틸리티 (순수 함수)
 * 스태프/정산 관리 화면(StaffSettlementsScreen)에서 추출.
 *
 * @description 역할/급여 타입 + 근무 기록 금액 계산 + salaryConfig/rolesForList/availableRoles 파생 헬퍼
 */

import { getRoleSalaryFromRoles, calculateSettlementFromWorkLog } from '@/domains/settlement';
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

/**
 * RoleChangeModal용 역할 키 목록
 */
export function deriveAvailableRoles(rolesForList: RoleWithSalary[]): string[] {
  return rolesForList
    .map((r) => {
      const roleStr = (r.role || r.name) as string;
      if (roleStr === 'other' && r.customRole) {
        return r.customRole;
      }
      return roleStr;
    })
    .filter(Boolean) as string[];
}

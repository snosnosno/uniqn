/**
 * UNIQN Mobile - 통합 역할 타입
 *
 * @description 모든 공고 타입에서 사용하는 단일 역할 표현
 * @version 1.1.0
 */

import type { StaffRole } from '../role';
import { ROLE_LABELS } from '@/constants';

// ============================================================================
// Types
// ============================================================================

/**
 * 통합 역할 정보 타입
 *
 * @description 모든 공고 타입(regular, fixed, tournament, urgent)에서
 * 역할 정보를 일관되게 표현하기 위한 단일 타입
 */
export interface RoleInfo {
  /** 역할 식별자 (dealer, floor, serving, manager, staff, other 등) */
  roleId: StaffRole | 'floor' | 'staff' | 'other' | string;

  /** 표시용 역할명 (딜러, 플로어, 매니저 등) */
  displayName: string;

  /** 커스텀 역할명 (roleId === 'other'일 때만 사용) */
  customName?: string;

  /** 필요 인원 */
  requiredCount: number;

  /** 충원된 인원 */
  filledCount: number;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * 역할 ID에서 표시명 생성
 *
 * @param roleId - 역할 ID
 * @param customName - 커스텀 역할명 (roleId === 'other'일 때)
 * @returns 표시용 역할명
 */
export function getRoleDisplayName(roleId: string, customName?: string): string {
  if (roleId === 'other' && customName) {
    return customName;
  }
  return ROLE_LABELS[roleId] ?? roleId;
}

/**
 * RoleInfo 생성 헬퍼
 *
 * @param roleId - 역할 ID
 * @param requiredCount - 필요 인원
 * @param filledCount - 충원된 인원 (기본값: 0)
 * @param customName - 커스텀 역할명
 * @returns RoleInfo 객체
 *
 * @example
 * const dealerRole = createRoleInfo('dealer', 3, 1);
 * // { roleId: 'dealer', displayName: '딜러', requiredCount: 3, filledCount: 1 }
 *
 * const customRole = createRoleInfo('other', 2, 0, '조명 담당');
 * // { roleId: 'other', displayName: '조명 담당', customName: '조명 담당', requiredCount: 2, filledCount: 0 }
 */
export function createRoleInfo(
  roleId: string,
  requiredCount: number,
  filledCount: number = 0,
  customName?: string
): RoleInfo {
  return {
    roleId,
    displayName: getRoleDisplayName(roleId, customName),
    customName: roleId === 'other' ? customName : undefined,
    requiredCount,
    filledCount,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 역할 마감 여부 확인
 *
 * @param role - RoleInfo 객체
 * @returns 마감 여부 (filledCount >= requiredCount)
 */
export function isRoleFilled(role: RoleInfo): boolean {
  return role.requiredCount > 0 && role.filledCount >= role.requiredCount;
}

/**
 * 남은 인원 계산
 *
 * @param role - RoleInfo 객체
 * @returns 남은 인원 (0 이상)
 */
export function getRemainingCount(role: RoleInfo): number {
  return Math.max(0, role.requiredCount - role.filledCount);
}

/**
 * 역할 배열에서 특정 역할 찾기
 *
 * @param roles - RoleInfo 배열
 * @param roleId - 찾을 역할 ID
 * @returns 찾은 RoleInfo 또는 undefined
 */
export function findRoleById(roles: RoleInfo[], roleId: string): RoleInfo | undefined {
  return roles.find((r) => r.roleId === roleId);
}

/**
 * 마감되지 않은 역할만 필터링
 *
 * @param roles - RoleInfo 배열
 * @returns 지원 가능한 역할 배열
 */
export function filterAvailableRoles(roles: RoleInfo[]): RoleInfo[] {
  return roles.filter((r) => !isRoleFilled(r));
}

/**
 * 전체 필요 인원 합계
 *
 * @param roles - RoleInfo 배열
 * @returns 필요 인원 합계
 */
export function getTotalRequiredCount(roles: RoleInfo[]): number {
  return roles.reduce((sum, r) => sum + r.requiredCount, 0);
}

/**
 * 전체 충원 인원 합계
 *
 * @param roles - RoleInfo 배열
 * @returns 충원 인원 합계
 */
export function getTotalFilledCount(roles: RoleInfo[]): number {
  return roles.reduce((sum, r) => sum + r.filledCount, 0);
}

/**
 * 모든 역할이 마감되었는지 확인
 *
 * @param roles - RoleInfo 배열
 * @returns 전체 마감 여부
 */
export function isAllRolesFilled(roles: RoleInfo[]): boolean {
  const total = getTotalRequiredCount(roles);
  const filled = getTotalFilledCount(roles);
  return total > 0 && filled >= total;
}

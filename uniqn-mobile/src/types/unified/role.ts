/**
 * UNIQN Mobile - 통합 역할 타입
 *
 * @description 모든 공고 타입에서 사용하는 단일 역할 표현
 * @version 1.0.0
 */

import type { StaffRole } from '../common';

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
  /** 역할 식별자 (dealer, floor, manager, chiprunner, other 등) */
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
// Constants
// ============================================================================

/**
 * 역할 ID → 표시명 매핑
 *
 * @description 모든 역할 표시명의 단일 소스 (Single Source of Truth)
 * - 영문 키와 한글 키 모두 지원 (역호환성)
 * - 새 역할 추가 시 이 매핑만 수정하면 전체 앱에 반영
 */
export const ROLE_DISPLAY_NAMES: Record<string, string> = {
  // 영문 키 (기본)
  dealer: '딜러',
  floor: '플로어',
  serving: '서빙',
  manager: '매니저',
  staff: '직원',
  chiprunner: '칩러너',
  supervisor: '슈퍼바이저',
  admin: '관리자',
  other: '기타',
  // 한글 키 (역호환성 - 기존 데이터 지원)
  '딜러': '딜러',
  '플로어': '플로어',
  '서빙': '서빙',
  '매니저': '매니저',
  '직원': '직원',
  '칩러너': '칩러너',
  '슈퍼바이저': '슈퍼바이저',
  '관리자': '관리자',
  '어드민': '관리자',
  '기타': '기타',
};

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
export function getRoleDisplayName(
  roleId: string,
  customName?: string
): string {
  if (roleId === 'other' && customName) {
    return customName;
  }
  return ROLE_DISPLAY_NAMES[roleId] ?? roleId;
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
export function findRoleById(
  roles: RoleInfo[],
  roleId: string
): RoleInfo | undefined {
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

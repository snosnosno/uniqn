/**
 * RoleResolver - 역할 처리 통합 클래스
 *
 * @description Phase 4 - 역할 처리 통합
 * 사용자 역할(UserRole)과 직무 역할(StaffRole) 처리 통합
 *
 * 주요 기능:
 * 1. 사용자 역할 정규화 및 권한 검증
 * 2. 직무 역할 정규화 및 표시명 변환
 * 3. 다양한 역할 필드 형식 통합 처리
 */

import { ROLE_LABELS, STAFF_ROLES } from '@/constants';
import { PermissionError, ERROR_CODES } from '@/errors';
import type { UserRole } from '@/types';
import type {
  ResolvedRole,
  StaffRoleInput,
  AssignmentRoleInput,
} from './types';
import {
  USER_ROLE_HIERARCHY,
  USER_ROLE_DISPLAY_NAMES,
  VALID_USER_ROLES,
} from './types';

// ============================================================================
// RoleResolver Class
// ============================================================================

export class RoleResolver {
  // ==========================================================================
  // 사용자 역할 (UserRole) 관련
  // ==========================================================================

  /**
   * 문자열 역할을 UserRole로 정규화
   *
   * @description 대소문자 무관, 하위 호환성 지원 (manager → employer)
   *
   * @param role - 입력된 역할 문자열
   * @returns UserRole 값 또는 null (유효하지 않은 경우)
   *
   * @example
   * RoleResolver.normalizeUserRole('ADMIN') // 'admin'
   * RoleResolver.normalizeUserRole('Manager') // 'employer'
   * RoleResolver.normalizeUserRole('invalid') // null
   */
  static normalizeUserRole(role: string | null | undefined): UserRole | null {
    if (!role) return null;

    const normalized = role.toLowerCase().trim();
    if (!normalized) return null;

    switch (normalized) {
      case 'admin':
        return 'admin';
      case 'employer':
        return 'employer';
      case 'manager':
        // 하위 호환성: 기존 'manager' → 'employer' 매핑
        return 'employer';
      case 'staff':
        return 'staff';
      default:
        return null;
    }
  }

  /**
   * 권한 계층 검사
   *
   * @description 사용자 역할이 필요한 역할 이상인지 확인
   *
   * @param userRole - 사용자 역할 (UserRole 또는 문자열)
   * @param requiredRole - 필요한 최소 역할
   * @returns 권한 여부
   *
   * @example
   * RoleResolver.hasPermission('admin', 'employer') // true
   * RoleResolver.hasPermission('staff', 'admin') // false
   */
  static hasPermission(
    userRole: UserRole | string | null | undefined,
    requiredRole: UserRole
  ): boolean {
    if (!userRole) return false;

    // 문자열인 경우 정규화
    const normalized =
      typeof userRole === 'string' ? this.normalizeUserRole(userRole) : userRole;

    if (!normalized) return false;

    const userLevel = USER_ROLE_HIERARCHY[normalized] ?? 0;
    const requiredLevel = USER_ROLE_HIERARCHY[requiredRole] ?? 0;

    return userLevel >= requiredLevel;
  }

  /**
   * admin 권한 필수 확인
   *
   * @description admin이 아니면 PermissionError 발생
   *
   * @param userRole - 사용자 역할
   * @throws {PermissionError} admin이 아닌 경우
   *
   * @example
   * RoleResolver.requireAdmin('admin') // OK
   * RoleResolver.requireAdmin('staff') // throws PermissionError
   */
  static requireAdmin(userRole: UserRole | string | null | undefined): void {
    if (!this.hasPermission(userRole, 'admin')) {
      throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
        userMessage: '관리자 권한이 필요합니다',
      });
    }
  }

  /**
   * 특정 역할 이상 권한 필수 확인
   *
   * @description 지정된 역할 이상이 아니면 PermissionError 발생
   *
   * @param userRole - 사용자 역할
   * @param requiredRole - 필요한 최소 역할
   * @throws {PermissionError} 권한 부족한 경우
   *
   * @example
   * RoleResolver.requireRole('employer', 'staff') // OK
   * RoleResolver.requireRole('staff', 'employer') // throws PermissionError
   */
  static requireRole(
    userRole: UserRole | string | null | undefined,
    requiredRole: UserRole
  ): void {
    if (!this.hasPermission(userRole, requiredRole)) {
      const roleName = USER_ROLE_DISPLAY_NAMES[requiredRole] ?? requiredRole;
      throw new PermissionError(ERROR_CODES.FIREBASE_PERMISSION_DENIED, {
        userMessage: `${roleName} 이상 권한이 필요합니다`,
      });
    }
  }

  /**
   * 사용자 역할 표시명 반환
   *
   * @param role - UserRole 또는 null
   * @returns 표시명 (관리자, 구인자, 스태프) 또는 빈 문자열
   */
  static getUserRoleDisplayName(role: UserRole | null | undefined): string {
    if (!role) return '';
    return USER_ROLE_DISPLAY_NAMES[role] ?? '';
  }

  /**
   * 유효한 UserRole인지 검사
   *
   * @description 문자열 정규화 후 유효성 검사
   *
   * @param role - 검사할 역할
   * @returns 유효 여부
   */
  static isValidUserRole(role: string | null | undefined): boolean {
    const normalized = this.normalizeUserRole(role);
    return normalized !== null && VALID_USER_ROLES.includes(normalized);
  }

  // ==========================================================================
  // 역할 플래그 계산 (Phase 8 - 이원화 해결)
  // ==========================================================================

  /**
   * 역할 플래그 계산 (단일 소스)
   *
   * @description 권한 계산 이원화 문제 해결을 위한 단일 계산 메서드
   * authStore와 useAuth에서 이 메서드를 사용하여 일관된 값 보장
   *
   * @param role - UserRole 또는 null
   * @returns 역할 플래그 객체
   *
   * @example
   * const flags = RoleResolver.computeRoleFlags('employer');
   * // { isAdmin: false, isEmployer: true, isStaff: true }
   */
  static computeRoleFlags(role: UserRole | string | null | undefined): {
    isAdmin: boolean;
    isEmployer: boolean;
    isStaff: boolean;
  } {
    // 문자열인 경우 정규화
    const normalizedRole = typeof role === 'string' ? this.normalizeUserRole(role) : role;

    if (!normalizedRole) {
      return { isAdmin: false, isEmployer: false, isStaff: false };
    }

    const roleLevel = USER_ROLE_HIERARCHY[normalizedRole] ?? 0;

    return {
      isAdmin: normalizedRole === 'admin',
      isEmployer: roleLevel >= USER_ROLE_HIERARCHY.employer,
      isStaff: roleLevel >= USER_ROLE_HIERARCHY.staff,
    };
  }

  /**
   * 역할 레벨 반환
   *
   * @param role - UserRole 또는 null
   * @returns 역할 레벨 (숫자)
   */
  static getRoleLevel(role: UserRole | string | null | undefined): number {
    const normalizedRole = typeof role === 'string' ? this.normalizeUserRole(role) : role;
    if (!normalizedRole) return 0;
    return USER_ROLE_HIERARCHY[normalizedRole] ?? 0;
  }

  // ==========================================================================
  // 직무 역할 (StaffRole) 관련
  // ==========================================================================

  /**
   * 역할 키 또는 이름을 표시명으로 변환
   *
   * @description 영어 코드(dealer) 또는 한글명(딜러) 모두 처리
   * 커스텀 역할은 그대로 반환
   *
   * @param roleKeyOrName - 역할 키 또는 이름
   * @returns 표시용 역할명 (한글)
   *
   * @example
   * RoleResolver.toDisplayName('dealer') // '딜러'
   * RoleResolver.toDisplayName('딜러') // '딜러'
   * RoleResolver.toDisplayName('custom') // 'custom' (매핑 없으면 그대로)
   */
  static toDisplayName(roleKeyOrName: string): string {
    if (!roleKeyOrName) return '';

    // key로 찾기
    const byKey = STAFF_ROLES.find((r) => r.key === roleKeyOrName);
    if (byKey) return byKey.name;

    // name으로 찾기 (이미 한글인 경우)
    const byName = STAFF_ROLES.find((r) => r.name === roleKeyOrName);
    if (byName) return byName.name;

    // 찾지 못하면 원래 값 반환 (커스텀 역할)
    return roleKeyOrName;
  }

  /**
   * 역할 이름 또는 키를 영어 키로 변환
   *
   * @description 한글명(딜러) 또는 영어 코드(dealer) 모두 처리
   * 커스텀 역할은 그대로 반환
   *
   * @param roleKeyOrName - 역할 키 또는 이름
   * @returns 역할 키 (영어)
   *
   * @example
   * RoleResolver.toKey('딜러') // 'dealer'
   * RoleResolver.toKey('dealer') // 'dealer'
   * RoleResolver.toKey('커스텀역할') // '커스텀역할' (매핑 없으면 그대로)
   */
  static toKey(roleKeyOrName: string): string {
    if (!roleKeyOrName) return '';

    // 이미 key인 경우
    const byKey = STAFF_ROLES.find((r) => r.key === roleKeyOrName);
    if (byKey) return byKey.key;

    // name인 경우 key로 변환
    const byName = STAFF_ROLES.find((r) => r.name === roleKeyOrName);
    if (byName) return byName.key;

    // 찾지 못하면 원래 값 반환 (커스텀 역할)
    return roleKeyOrName;
  }

  /**
   * 직무 역할 표시명 반환
   *
   * @description 역할 ID를 한글 표시명으로 변환
   * - 'other' + customRole: customRole 반환
   * - 알 수 없는 역할: 그대로 반환
   *
   * @param roleId - 역할 ID (dealer, floor, other 등)
   * @param customRole - 커스텀 역할명 (roleId === 'other'일 때)
   * @returns 표시용 역할명
   *
   * @example
   * RoleResolver.getStaffRoleDisplayName('dealer') // '딜러'
   * RoleResolver.getStaffRoleDisplayName('other', '조명 담당') // '조명 담당'
   */
  static getStaffRoleDisplayName(roleId: string, customRole?: string | null): string {
    if (roleId === 'other' && customRole) {
      return customRole;
    }
    return ROLE_LABELS[roleId] ?? roleId;
  }

  /**
   * 여러 필드에서 직무 역할 추출 및 정규화
   *
   * @description 다양한 형태의 역할 필드를 ResolvedRole[]로 정규화
   * 우선순위: roleIds > roles > role
   *
   * @param input - 역할 필드들
   * @returns 정규화된 역할 배열
   *
   * @example
   * RoleResolver.resolveStaffRoles({ role: 'dealer' })
   * // [{ roleId: 'dealer', displayName: '딜러', isCustom: false }]
   *
   * RoleResolver.resolveStaffRoles({ roles: ['dealer', 'floor'] })
   * // [{ roleId: 'dealer', displayName: '딜러', isCustom: false }, ...]
   */
  static resolveStaffRoles(input: StaffRoleInput): ResolvedRole[] {
    const { role, roles, roleIds, customRole } = input;

    // 우선순위: roleIds > roles > role
    let rawRoles: string[] = [];

    if (roleIds && roleIds.length > 0) {
      rawRoles = roleIds;
    } else if (roles && roles.length > 0) {
      rawRoles = roles;
    } else if (role) {
      rawRoles = [role];
    }

    // 중복 제거
    const uniqueRoles = [...new Set(rawRoles.filter(Boolean))];

    return uniqueRoles.map((roleId) => ({
      roleId,
      displayName: this.getStaffRoleDisplayName(roleId, customRole),
      isCustom: roleId === 'other' && !!customRole,
    }));
  }

  /**
   * Assignment 객체에서 역할 추출
   *
   * @description Assignment 인터페이스의 역할 필드를 정규화
   *
   * @param assignment - Assignment 객체 (또는 유사 객체)
   * @returns 정규화된 역할 배열
   *
   * @example
   * RoleResolver.fromAssignment({ roleId: 'dealer' })
   * // [{ roleId: 'dealer', displayName: '딜러', isCustom: false }]
   */
  static fromAssignment(assignment: AssignmentRoleInput | null | undefined): ResolvedRole[] {
    if (!assignment) return [];

    const { roleId, roleIds, customRole } = assignment;

    // 우선순위: roleIds > roleId
    let rawRoles: string[] = [];

    if (roleIds && roleIds.length > 0) {
      rawRoles = roleIds;
    } else if (roleId) {
      rawRoles = [roleId];
    }

    // 중복 제거
    const uniqueRoles = [...new Set(rawRoles.filter(Boolean))];

    return uniqueRoles.map((id) => ({
      roleId: id,
      displayName: this.getStaffRoleDisplayName(id, customRole),
      isCustom: id === 'other' && !!customRole,
    }));
  }
}

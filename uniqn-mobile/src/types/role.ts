/**
 * UNIQN Mobile - Role 타입 통합 정의
 *
 * @description Phase 8 - 역할 타입 통합
 * 사용자 권한(UserRole)과 직무 역할(StaffRole)의 명확한 구분
 *
 * ## 역할 타입 구분
 *
 * 1. **UserRole** (사용자 권한): 앱 기능 접근 권한
 *    - admin: 관리자 (모든 기능)
 *    - employer: 구인자 (공고 관리, 지원자 관리)
 *    - staff: 스태프 (지원, 스케줄 확인)
 *
 * 2. **StaffRole** (직무 역할): 포커룸에서의 업무 역할
 *    - dealer: 딜러
 *    - floor: 플로어
 *    - serving: 서빙
 *    - manager: 매니저
 *    - staff: 직원
 *    - other: 기타 (customRole과 함께 사용)
 *
 * ## 사용 가이드
 *
 * ```typescript
 * // UserRole 사용 (권한 체크)
 * import type { UserRole } from '@/types/role';
 * if (userRole === 'employer') { ... }
 *
 * // StaffRole 사용 (직무 표시)
 * import type { StaffRole } from '@/types/role';
 * import { STAFF_ROLE_LABELS } from '@/types/role';
 * const label = STAFF_ROLE_LABELS[staffRole];
 *
 * // 권한 플래그 계산
 * import { RoleResolver } from '@/shared/role';
 * const flags = RoleResolver.computeRoleFlags(profile.role);
 * ```
 *
 * @version 2.1.0
 */

// ============================================================================
// UserRole (사용자 권한)
// ============================================================================

/**
 * 사용자 권한 역할
 *
 * @description 앱 기능 접근 권한을 결정하는 역할
 *
 * - admin: 관리자 (모든 기능)
 * - employer: 구인자 (공고 관리, 지원자 관리)
 * - staff: 스태프 (지원, 스케줄 확인)
 *
 * ⚠️ StaffRole(직무: dealer, manager 등)과 혼동 주의
 */
export type UserRole = 'admin' | 'employer' | 'staff';

/**
 * 사용자 역할 계층 (숫자가 높을수록 상위 권한)
 */
export const USER_ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 100,
  employer: 50,
  staff: 10,
};

/**
 * 사용자 역할 한글 표시명
 */
export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: '관리자',
  employer: '구인자',
  staff: '스태프',
};

/**
 * 유효한 사용자 역할 목록
 */
export const VALID_USER_ROLES: readonly UserRole[] = ['admin', 'employer', 'staff'] as const;

// ============================================================================
// StaffRole (직무 역할)
// ============================================================================

/**
 * 스태프 직무 역할
 *
 * @description 포커룸에서의 업무 역할
 *
 * - dealer: 딜러
 * - floor: 플로어
 * - serving: 서빙
 * - manager: 매니저
 * - staff: 직원 (일반 스태프)
 * - other: 기타 (customRole 필드와 함께 사용)
 *
 * @note v2.1.0 통합: chiprunner → floor, admin 제거 (UserRole과 혼동 방지)
 */
export type StaffRole = 'dealer' | 'floor' | 'serving' | 'manager' | 'staff' | 'other';

/**
 * 스태프 직무 역할 한글 표시명
 */
export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  dealer: '딜러',
  floor: '플로어',
  serving: '서빙',
  manager: '매니저',
  staff: '직원',
  other: '기타',
};

/**
 * 유효한 스태프 역할 목록
 *
 * @description 전체 앱에서 역할 검증에 사용하는 유일한 키 목록
 */
export const VALID_STAFF_ROLES = [
  'dealer',
  'floor',
  'serving',
  'manager',
  'staff',
  'other',
] as const;

// ============================================================================
// Role Flags (역할 플래그)
// ============================================================================

/**
 * 역할 플래그 인터페이스
 *
 * @description RoleResolver.computeRoleFlags()의 반환 타입
 */
export interface RoleFlags {
  /** admin 권한 여부 */
  isAdmin: boolean;
  /** employer 이상 권한 (admin, employer) */
  isEmployer: boolean;
  /** staff 이상 권한 (admin, employer, staff) */
  isStaff: boolean;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * UserRole 타입 가드
 *
 * @param value - 검사할 값
 * @returns UserRole 여부
 */
export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && VALID_USER_ROLES.includes(value as UserRole);
}

/**
 * StaffRole 타입 가드
 *
 * @param value - 검사할 값
 * @returns StaffRole 여부
 */
export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === 'string' && VALID_STAFF_ROLES.includes(value as StaffRole);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * UserRole 표시명 반환
 *
 * @param role - UserRole 또는 null
 * @returns 한글 표시명 또는 빈 문자열
 */
export function getUserRoleLabel(role: UserRole | null | undefined): string {
  if (!role) return '';
  return USER_ROLE_LABELS[role] ?? '';
}

/**
 * StaffRole 표시명 반환
 *
 * @param role - StaffRole 또는 null
 * @param customRole - 커스텀 역할명 (role === 'other'일 때)
 * @returns 한글 표시명
 */
export function getStaffRoleLabel(
  role: StaffRole | string | null | undefined,
  customRole?: string | null
): string {
  if (!role) return '';
  if (role === 'other' && customRole) return customRole;
  return STAFF_ROLE_LABELS[role as StaffRole] ?? role;
}

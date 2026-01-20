/**
 * 역할 관련 타입 정의
 *
 * @description Phase 4 - 역할 처리 통합
 * 사용자 역할(UserRole)과 직무 역할(StaffRole) 타입
 */

import type { UserRole } from '@/types';

// ============================================================================
// Resolved Role (직무 역할 정규화 결과)
// ============================================================================

/**
 * 정규화된 직무 역할 정보
 *
 * @description 여러 형태의 역할 필드(role, roles, roleIds, customRole)를
 * 단일 형식으로 정규화한 결과
 */
export interface ResolvedRole {
  /** 역할 ID (dealer, floor, manager, other 등) */
  roleId: string;
  /** 표시용 역할명 (딜러, 플로어, 매니저, 조명 담당 등) */
  displayName: string;
  /** 커스텀 역할 여부 (roleId === 'other' && customRole 있음) */
  isCustom: boolean;
}

// ============================================================================
// Input Types (역할 정규화 입력)
// ============================================================================

/**
 * 역할 정규화 입력 타입
 *
 * @description 다양한 형태의 역할 필드를 받아 정규화
 * - role: 단일 역할 (레거시)
 * - roles: 역할 배열 (문자열)
 * - roleIds: 역할 ID 배열
 * - customRole: 커스텀 역할명 (role === 'other'일 때)
 */
export interface StaffRoleInput {
  role?: string | null;
  roles?: string[] | null;
  roleIds?: string[] | null;
  customRole?: string | null;
}

/**
 * Assignment 역할 입력 타입
 *
 * @description Assignment 객체에서 역할 추출 시 사용
 */
export interface AssignmentRoleInput {
  roleId?: string | null;
  roleIds?: string[] | null;
  customRole?: string | null;
}

// ============================================================================
// User Role Constants
// ============================================================================

/**
 * 사용자 역할 계층
 *
 * @description 숫자가 높을수록 상위 권한
 * - admin: 최고 관리자 (모든 기능)
 * - employer: 구인자 (공고 관리, 지원자 관리)
 * - staff: 스태프 (지원, 스케줄 확인)
 */
export const USER_ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 100,
  employer: 50,
  staff: 10,
};

/**
 * 사용자 역할 표시명
 */
export const USER_ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  admin: '관리자',
  employer: '구인자',
  staff: '스태프',
};

/**
 * 유효한 사용자 역할 목록
 */
export const VALID_USER_ROLES: readonly UserRole[] = ['admin', 'employer', 'staff'] as const;

// ============================================================================
// Re-export for convenience
// ============================================================================

export type { UserRole };

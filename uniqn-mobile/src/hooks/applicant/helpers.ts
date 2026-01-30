/**
 * UNIQN Mobile - 지원자 관리 헬퍼 함수
 *
 * @description 지원자 필터링 및 데이터 처리 헬퍼
 * @version 1.0.0
 */

import type { Assignment } from '@/types/assignment';

// ============================================================================
// 역할 추출 헬퍼
// ============================================================================

/**
 * 지원자의 주요 역할 ID 추출 (타입 안전)
 *
 * @description
 * assignments 배열에서 첫 번째 assignment의 첫 번째 roleId를 추출합니다.
 * 빈 배열이나 undefined인 경우 'other'를 반환합니다.
 *
 * @param assignments - Assignment 배열 또는 undefined
 * @returns 주요 역할 ID 또는 'other'
 *
 * @example
 * // 정상 케이스
 * getPrimaryRoleId([{ roleIds: ['dealer'], ... }]) // 'dealer'
 *
 * // 빈 배열
 * getPrimaryRoleId([]) // 'other'
 *
 * // undefined
 * getPrimaryRoleId(undefined) // 'other'
 */
export function getPrimaryRoleId(assignments: Assignment[] | undefined): string {
  // 빈 배열이거나 undefined면 'other' 반환
  if (!assignments || assignments.length === 0) {
    return 'other';
  }

  const firstAssignment = assignments[0];
  if (!firstAssignment) {
    return 'other';
  }

  // roleIds가 없거나 빈 배열이면 'other' 반환
  if (!Array.isArray(firstAssignment.roleIds) || firstAssignment.roleIds.length === 0) {
    return 'other';
  }

  return firstAssignment.roleIds[0] ?? 'other';
}

/**
 * 지원자의 모든 역할 ID 추출
 *
 * @description
 * 모든 assignments의 roleIds를 평탄화하여 중복 제거된 배열로 반환합니다.
 *
 * @param assignments - Assignment 배열 또는 undefined
 * @returns 역할 ID 배열 (중복 제거)
 */
export function getAllRoleIds(assignments: Assignment[] | undefined): string[] {
  if (!assignments || assignments.length === 0) {
    return [];
  }

  const roleSet = new Set<string>();

  for (const assignment of assignments) {
    if (Array.isArray(assignment.roleIds)) {
      for (const roleId of assignment.roleIds) {
        roleSet.add(roleId);
      }
    }
  }

  return Array.from(roleSet);
}

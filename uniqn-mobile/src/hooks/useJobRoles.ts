/**
 * UNIQN Mobile - 공고 역할 Hook
 *
 * @description 공고 역할 정보를 정규화하여 제공
 * @version 1.0.0
 */

import { useMemo, useCallback } from 'react';
import type { JobPosting } from '@/types';
import {
  type RoleInfo,
  filterAvailableRoles as filterRoles,
  findRoleById as findRole,
  getTotalRequiredCount,
  getTotalFilledCount,
  isAllRolesFilled,
} from '@/types/unified';
import { normalizeJobRoles, getRolesForDateAndTime } from '@/utils/normalizers';

// ============================================================================
// Types
// ============================================================================

export interface UseJobRolesResult {
  /** 모든 역할 배열 */
  allRoles: RoleInfo[];

  /** 지원 가능한 역할 (마감되지 않은) */
  availableRoles: RoleInfo[];

  /** 역할 ID로 역할 찾기 */
  getRoleById: (roleId: string) => RoleInfo | undefined;

  /** 특정 날짜-시간대의 역할 목록 조회 */
  getRolesForSlot: (date: string, timeSlot: string) => RoleInfo[];

  /** 전체 필요 인원 */
  totalRequired: number;

  /** 전체 충원 인원 */
  totalFilled: number;

  /** 남은 인원 */
  remaining: number;

  /** 전체 마감 여부 */
  isAllFilled: boolean;

  /** 역할 수 */
  roleCount: number;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * 공고의 역할 정보를 정규화하여 제공하는 Hook
 *
 * @description 공고 타입에 관계없이 역할 정보를 RoleInfo 배열로 제공
 * 마감 필터링, 역할 검색 등 유틸리티 함수 포함
 *
 * @param job - JobPosting 객체 (null 가능)
 * @returns UseJobRolesResult
 *
 * @example
 * function RoleSelector({ job }) {
 *   const { availableRoles, getRoleById, isAllFilled } = useJobRoles(job);
 *
 *   if (isAllFilled) {
 *     return <Text>모든 역할이 마감되었습니다</Text>;
 *   }
 *
 *   return availableRoles.map(role => (
 *     <RoleOption key={role.roleId} role={role} />
 *   ));
 * }
 */
export function useJobRoles(job: JobPosting | null): UseJobRolesResult {
  // 모든 역할 추출
  const allRoles = useMemo(() => {
    if (!job) return [];
    return normalizeJobRoles(job);
  }, [job]);

  // 지원 가능한 역할 (마감되지 않은)
  const availableRoles = useMemo(() => {
    return filterRoles(allRoles);
  }, [allRoles]);

  // 역할 ID로 찾기
  const getRoleById = useCallback(
    (roleId: string) => findRole(allRoles, roleId),
    [allRoles]
  );

  // 특정 날짜-시간대의 역할 목록
  const getRolesForSlot = useCallback(
    (date: string, timeSlot: string) => {
      if (!job) return [];
      return getRolesForDateAndTime(job, date, timeSlot);
    },
    [job]
  );

  // 통계 계산
  const stats = useMemo(() => {
    const totalRequired = getTotalRequiredCount(allRoles);
    const totalFilled = getTotalFilledCount(allRoles);

    return {
      totalRequired,
      totalFilled,
      remaining: Math.max(0, totalRequired - totalFilled),
      isAllFilled: isAllRolesFilled(allRoles),
      roleCount: allRoles.length,
    };
  }, [allRoles]);

  return {
    allRoles,
    availableRoles,
    getRoleById,
    getRolesForSlot,
    ...stats,
  };
}

export default useJobRoles;

/**
 * UNIQN Mobile - 역할 정규화 함수
 *
 * @description 다양한 역할 타입을 RoleInfo로 정규화
 * @version 1.0.0
 */

import type { JobPosting } from '@/types';
import type { RoleRequirement as DateRoleRequirement } from '@/types/jobPosting/dateRequirement';
import { getDateString } from '@/types/jobPosting/dateRequirement';
import type { RoleWithCount } from '@/types/postingConfig';
import {
  type RoleInfo,
  createRoleInfo,
  filterAvailableRoles as filterRoles,
  findRoleById as findRole,
} from '@/types/unified';

// ============================================================================
// Type-specific Normalizers
// ============================================================================

/**
 * JobRoleStats/RoleRequirement (jobPosting.ts) -> RoleInfo
 *
 * @description 공고 통계용 역할 타입 변환
 */
export function normalizeJobRoleStats(role: {
  role: string;
  count: number;
  filled?: number;
}): RoleInfo {
  return createRoleInfo(role.role, role.count, role.filled ?? 0);
}

/**
 * RoleRequirement (dateRequirement.ts) -> RoleInfo
 *
 * @description 날짜별 요구사항의 역할 타입 변환
 * role/name, headcount/count 등 혼용된 필드 처리
 */
export function normalizeFormRoleRequirement(
  role: DateRoleRequirement
): RoleInfo {
  // 역할 ID 추출
  const roleId = role.role ?? 'other';

  // 필요 인원 추출
  const requiredCount = role.headcount ?? 0;

  // 충원 인원
  const filledCount = role.filled ?? 0;

  // 커스텀 역할명
  const customName = role.customRole;

  return createRoleInfo(String(roleId), requiredCount, filledCount, customName);
}

/**
 * RoleWithCount (postingConfig.ts) -> RoleInfo
 *
 * @description 고정공고용 역할 타입 변환
 */
export function normalizeRoleWithCount(role: RoleWithCount): RoleInfo {
  // 역할 ID 추출 (role > name 우선순위)
  const roleId = role.role ?? role.name ?? 'other';
  return createRoleInfo(roleId, role.count, role.filled ?? 0);
}

// ============================================================================
// Main Normalizer
// ============================================================================

/**
 * 공고에서 역할 목록 추출 (타입 불문)
 *
 * @description 공고 타입(regular, fixed, tournament, urgent)에 관계없이
 * 모든 역할을 RoleInfo 배열로 정규화
 *
 * @param job - JobPosting 객체
 * @returns RoleInfo 배열
 *
 * @example
 * const roles = normalizeJobRoles(job);
 * // [{ roleId: 'dealer', displayName: '딜러', requiredCount: 3, filledCount: 1 }, ...]
 */
export function normalizeJobRoles(job: JobPosting): RoleInfo[] {
  // 1. 고정공고: requiredRolesWithCount 사용
  if (job.postingType === 'fixed' && job.requiredRolesWithCount?.length) {
    return job.requiredRolesWithCount.map(normalizeRoleWithCount);
  }

  // 2. 날짜별 요구사항이 있는 경우: 모든 역할 수집 (중복 합산)
  if (job.dateSpecificRequirements?.length) {
    const roleMap = new Map<string, RoleInfo>();

    for (const dateReq of job.dateSpecificRequirements) {
      for (const slot of dateReq.timeSlots) {
        for (const role of slot.roles) {
          const normalized = normalizeFormRoleRequirement(role);
          const existing = roleMap.get(normalized.roleId);

          if (existing) {
            // 동일 역할 합산
            roleMap.set(normalized.roleId, {
              ...existing,
              requiredCount: existing.requiredCount + normalized.requiredCount,
              filledCount: existing.filledCount + normalized.filledCount,
            });
          } else {
            roleMap.set(normalized.roleId, normalized);
          }
        }
      }
    }

    return Array.from(roleMap.values());
  }

  // 3. 레거시: roles 필드 사용
  if (job.roles?.length) {
    return job.roles.map(normalizeJobRoleStats);
  }

  return [];
}

/**
 * 특정 날짜-시간대의 역할만 추출
 *
 * @param job - JobPosting 객체
 * @param date - 날짜 (YYYY-MM-DD)
 * @param timeSlot - 시간대 (HH:mm)
 * @returns RoleInfo 배열
 */
export function getRolesForDateAndTime(
  job: JobPosting,
  date: string,
  timeSlot: string
): RoleInfo[] {
  if (!job.dateSpecificRequirements?.length) {
    // 레거시: 모든 역할 반환
    return job.roles?.map(normalizeJobRoleStats) ?? [];
  }

  // 해당 날짜의 요구사항 찾기
  const dateReq = job.dateSpecificRequirements.find((req) => {
    // getDateString으로 다양한 형식 (string | Timestamp | { seconds }) 통합 처리
    const reqDate = getDateString(req.date);
    return reqDate === date;
  });

  if (!dateReq) return [];

  // 해당 시간대의 역할 찾기
  const slot = dateReq.timeSlots.find((ts) => {
    const slotTime = ts.startTime ?? '';
    return slotTime === timeSlot;
  });

  if (!slot) return [];

  return slot.roles.map(normalizeFormRoleRequirement);
}

// ============================================================================
// Re-export utility functions
// ============================================================================

export { filterRoles as filterAvailableRoles };
export { findRole as findRoleById };

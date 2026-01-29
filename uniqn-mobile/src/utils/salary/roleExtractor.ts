/**
 * UNIQN Mobile - 역할 추출 유틸리티
 *
 * @description 공고 폼 데이터에서 역할 정보를 추출하는 로직
 * @version 1.0.0
 */

import { RoleResolver } from '@/shared/role';
import type { SalaryInfo, FormRoleWithCount, PostingType } from '@/types';
import type { DateSpecificRequirement } from '@/types/jobPosting/dateRequirement';

// ============================================================================
// Types
// ============================================================================

/** 추출된 역할 정보 */
export interface ExtractedRole {
  /** 역할 키 (저장용) */
  key: string;
  /** 표시용 이름 */
  displayName: string;
  /** 인원수 */
  count: number;
  /** 커스텀 역할 여부 */
  isCustom: boolean;
  /** 기존 급여 정보 (있으면) */
  existingSalary?: SalaryInfo;
}

// ============================================================================
// Helper Functions
// ============================================================================

const getRoleDisplayName = RoleResolver.toDisplayName.bind(RoleResolver);
const getRoleKey = RoleResolver.toKey.bind(RoleResolver);

// ============================================================================
// Main Functions
// ============================================================================

/**
 * 공고 폼 데이터에서 역할 정보 추출
 *
 * @description
 * - fixed 타입: data.roles 직접 사용
 * - regular/urgent/tournament: dateSpecificRequirements에서 추출
 * - 같은 역할이 여러 날짜/타임슬롯에 있으면 인원 합산
 *
 * @param postingType - 공고 타입
 * @param roles - 기존 역할 배열 (fixed 타입용)
 * @param dateSpecificRequirements - 날짜별 요구사항 (다른 타입용)
 * @returns 추출된 역할 정보 배열
 *
 * @example
 * const roles = extractRolesFromPosting('regular', [], dateRequirements);
 * // => [{ key: 'dealer', displayName: '딜러', count: 5, isCustom: false }]
 */
export function extractRolesFromPosting(
  postingType: PostingType,
  roles: FormRoleWithCount[],
  dateSpecificRequirements?: DateSpecificRequirement[]
): ExtractedRole[] {
  // fixed 타입은 data.roles 직접 사용
  if (postingType === 'fixed') {
    return roles.map((r) => ({
      key: getRoleKey(r.name),
      displayName: getRoleDisplayName(r.name),
      count: r.count,
      isCustom: r.isCustom ?? false,
      existingSalary: r.salary,
    }));
  }

  // 다른 타입은 dateSpecificRequirements에서 추출
  const roleMap = new Map<
    string,
    { displayName: string; count: number; isCustom: boolean; existingSalary?: SalaryInfo }
  >();

  dateSpecificRequirements?.forEach((dateReq) => {
    dateReq.timeSlots?.forEach((slot) => {
      slot.roles?.forEach((roleReq) => {
        const rawRole = (roleReq.role ?? 'dealer') as string;
        const isCustomRole = rawRole === 'other' && !!roleReq.customRole;
        // 커스텀 역할이면 customRole을 키로 사용
        const roleKey = isCustomRole ? roleReq.customRole! : getRoleKey(rawRole);
        // 커스텀 역할이면 customRole을 표시명으로 사용
        const displayName = isCustomRole
          ? roleReq.customRole!
          : getRoleDisplayName(rawRole);
        const existing = roleMap.get(roleKey);
        const headcount = roleReq.headcount ?? 0;

        // 같은 역할이면 인원 합산
        roleMap.set(roleKey, {
          displayName: existing?.displayName || displayName,
          count: (existing?.count || 0) + headcount,
          isCustom: existing?.isCustom || isCustomRole,
          existingSalary: existing?.existingSalary || roleReq.salary,
        });
      });
    });
  });

  return Array.from(roleMap.entries()).map(
    ([key, { displayName, count, isCustom, existingSalary }]) => ({
      key,
      displayName,
      count,
      isCustom,
      existingSalary,
    })
  );
}

/**
 * 추출된 역할과 기존 역할 동기화
 *
 * @description
 * - 새로운 역할 추가
 * - 삭제된 역할 제거
 * - 인원 변경 반영
 *
 * @param extractedRoles - 추출된 역할 배열
 * @param existingRoles - 기존 역할 배열
 * @param useSameSalary - 전체 동일 급여 사용 여부
 * @returns 동기화된 역할 배열 (변경 없으면 null)
 */
export function syncRolesWithExtracted(
  extractedRoles: ExtractedRole[],
  existingRoles: FormRoleWithCount[],
  useSameSalary: boolean
): FormRoleWithCount[] | null {
  const currentRoleKeys = extractedRoles.map((r) => r.key);
  const existingRoleKeys = existingRoles.map((r) => getRoleKey(r.name));

  // 새로운 역할 찾기
  const newRoles = extractedRoles.filter(
    (r) => !existingRoleKeys.includes(r.key)
  );
  // 삭제된 역할 찾기
  const deletedRoleKeys = existingRoleKeys.filter(
    (key) => !currentRoleKeys.includes(key)
  );

  // 변경이 없으면 null 반환
  if (newRoles.length === 0 && deletedRoleKeys.length === 0) {
    // 인원 변경 확인
    let hasCountChange = false;
    extractedRoles.forEach((extracted) => {
      const existing = existingRoles.find(
        (r) => getRoleKey(r.name) === extracted.key
      );
      if (existing && existing.count !== extracted.count) {
        hasCountChange = true;
      }
    });

    if (!hasCountChange) {
      return null;
    }
  }

  // 기존 역할 유지 (삭제된 것 제외)
  const updatedRoles: FormRoleWithCount[] = existingRoles.filter(
    (r) => !deletedRoleKeys.includes(getRoleKey(r.name))
  );

  // 새로운 역할 추가
  newRoles.forEach((role) => {
    // 전체 동일 급여 모드면 첫 역할 급여 복사
    let salary: SalaryInfo = { type: 'hourly', amount: 0 };
    if (role.existingSalary) {
      salary = role.existingSalary;
    } else if (useSameSalary && updatedRoles.length > 0) {
      const firstSalary = updatedRoles[0]?.salary;
      if (firstSalary) {
        salary = { ...firstSalary };
      }
    }

    updatedRoles.push({
      name: role.displayName,
      count: role.count,
      isCustom: role.isCustom,
      salary,
    });
  });

  // 인원수 업데이트 (역할은 같지만 인원이 변경된 경우)
  extractedRoles.forEach((extracted) => {
    const existing = updatedRoles.find(
      (r) => getRoleKey(r.name) === extracted.key
    );
    if (existing && existing.count !== extracted.count) {
      existing.count = extracted.count;
    }
  });

  return updatedRoles;
}

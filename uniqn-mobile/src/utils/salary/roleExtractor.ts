/**
 * UNIQN Mobile - role extraction utilities
 */

import { RoleResolver } from '@/shared/role';
import type { SalaryInfo, FormRoleWithCount, PostingType } from '@/types';
import type { DateSpecificRequirement } from '@/types/jobPosting/dateRequirement';

export interface ExtractedRole {
  key: string;
  displayName: string;
  count: number;
  isCustom: boolean;
  existingSalary?: SalaryInfo;
}

const getRoleDisplayName = RoleResolver.toDisplayName.bind(RoleResolver);
const getRoleKey = RoleResolver.toKey.bind(RoleResolver);

function collectRequirementRoles(
  roleMap: Map<
    string,
    { displayName: string; count: number; isCustom: boolean; existingSalary?: SalaryInfo }
  >,
  requirement: DateSpecificRequirement,
  options: {
    preserveExistingCounts: boolean;
  }
) {
  requirement.timeSlots?.forEach((slot) => {
    slot.roles?.forEach((roleRequirement) => {
      const rawRole = (roleRequirement.role ?? 'dealer') as string;
      const isCustomRole = rawRole === 'other' && !!roleRequirement.customRole;
      const roleKey = isCustomRole ? roleRequirement.customRole! : getRoleKey(rawRole);
      const displayName = isCustomRole ? roleRequirement.customRole! : getRoleDisplayName(rawRole);
      const existing = roleMap.get(roleKey);
      const headcount = roleRequirement.headcount ?? 0;

      if (existing) {
        roleMap.set(roleKey, {
          displayName: existing.displayName,
          count: options.preserveExistingCounts ? existing.count : existing.count + headcount,
          isCustom: existing.isCustom,
          existingSalary: existing.existingSalary || roleRequirement.salary,
        });
        return;
      }

      roleMap.set(roleKey, {
        displayName,
        count: headcount,
        isCustom: isCustomRole,
        existingSalary: roleRequirement.salary,
      });
    });
  });
}

export function extractRolesFromPosting(
  postingType: PostingType,
  roles: FormRoleWithCount[],
  dateSpecificRequirements?: DateSpecificRequirement[]
): ExtractedRole[] {
  if (postingType === 'fixed') {
    return roles.map((role) => ({
      key: getRoleKey(role.name),
      displayName: getRoleDisplayName(role.name),
      count: role.count,
      isCustom: role.isCustom ?? false,
      existingSalary: role.salary,
    }));
  }

  const roleMap = new Map<
    string,
    { displayName: string; count: number; isCustom: boolean; existingSalary?: SalaryInfo }
  >();
  const seedRequirement = dateSpecificRequirements?.find(
    (dateRequirement) => (dateRequirement.timeSlots?.length ?? 0) > 0
  );

  if (seedRequirement) {
    collectRequirementRoles(roleMap, seedRequirement, {
      preserveExistingCounts: false,
    });
  }

  dateSpecificRequirements?.forEach((requirement) => {
    if (requirement === seedRequirement) {
      return;
    }

    collectRequirementRoles(roleMap, requirement, {
      preserveExistingCounts: true,
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

export function syncRolesWithExtracted(
  extractedRoles: ExtractedRole[],
  existingRoles: FormRoleWithCount[],
  useSameSalary: boolean
): FormRoleWithCount[] | null {
  const currentRoleKeys = extractedRoles.map((role) => role.key);
  const existingRoleKeys = existingRoles.map((role) => getRoleKey(role.name));

  const newRoles = extractedRoles.filter((role) => !existingRoleKeys.includes(role.key));
  const deletedRoleKeys = existingRoleKeys.filter((key) => !currentRoleKeys.includes(key));

  if (newRoles.length === 0 && deletedRoleKeys.length === 0) {
    let hasCountChange = false;

    extractedRoles.forEach((extracted) => {
      const existing = existingRoles.find((role) => getRoleKey(role.name) === extracted.key);
      if (existing && existing.count !== extracted.count) {
        hasCountChange = true;
      }
    });

    if (!hasCountChange) {
      return null;
    }
  }

  const updatedRoles: FormRoleWithCount[] = existingRoles.filter(
    (role) => !deletedRoleKeys.includes(getRoleKey(role.name))
  );

  newRoles.forEach((role) => {
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

  extractedRoles.forEach((extracted) => {
    const existing = updatedRoles.find((role) => getRoleKey(role.name) === extracted.key);
    if (existing && existing.count !== extracted.count) {
      existing.count = extracted.count;
    }
  });

  return updatedRoles;
}

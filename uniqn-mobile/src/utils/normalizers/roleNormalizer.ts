import type { JobPosting } from '@/types';
import type { RoleRequirement as DateRoleRequirement } from '@/types/jobPosting/dateRequirement';
import type { PostingSlotRoleRequirement } from '@/types/jobPosting';
import type { RoleWithCount } from '@/types/postingConfig';
import {
  type RoleInfo,
  createRoleInfo,
  filterAvailableRoles as filterRoles,
  findRoleById as findRole,
} from '@/types/unified';

export function normalizeJobRoleStats(role: {
  role: string;
  count: number;
  filled?: number;
}): RoleInfo {
  return createRoleInfo(role.role, role.count, role.filled ?? 0);
}

export function normalizeFormRoleRequirement(role: DateRoleRequirement): RoleInfo {
  return createRoleInfo(
    String(role.role ?? 'other'),
    role.headcount ?? 0,
    role.filled ?? 0,
    role.customRole
  );
}

export function normalizeRoleWithCount(role: RoleWithCount): RoleInfo {
  return createRoleInfo(role.role ?? role.name ?? 'other', role.count, role.filled ?? 0);
}

function normalizePostingSlotRoleRequirement(role: PostingSlotRoleRequirement): RoleInfo {
  // SP3: schedule role.filled(dead counter) 제거 — filledCount 는 표시 시점 hydrate 가 덮어씀(0)
  return createRoleInfo(role.role ?? 'other', role.count, 0, role.customRole);
}

function getRoleAggregationKey(role: RoleInfo): string {
  return role.roleId === 'other' && role.customName ? `other:${role.customName}` : role.roleId;
}

export function normalizeJobRoles(job: JobPosting): RoleInfo[] {
  const requirements =
    job.schedule.kind === 'fixed' || job.schedule.kind === 'dated' ? job.schedule.requirements : [];

  if (requirements.length === 0) {
    return [];
  }

  const roleMap = new Map<string, RoleInfo>();

  for (const requirement of requirements) {
    for (const slot of requirement.timeSlots) {
      for (const role of slot.roles) {
        const normalized = normalizePostingSlotRoleRequirement(role);
        const roleKey = getRoleAggregationKey(normalized);
        const existing = roleMap.get(roleKey);

        if (existing) {
          roleMap.set(roleKey, {
            ...existing,
            requiredCount: existing.requiredCount + normalized.requiredCount,
            filledCount: existing.filledCount + normalized.filledCount,
          });
          continue;
        }

        roleMap.set(roleKey, normalized);
      }
    }
  }

  return Array.from(roleMap.values());
}

export function getRolesForDateAndTime(
  job: JobPosting,
  date: string,
  timeSlot: string
): RoleInfo[] {
  if (job.schedule.kind !== 'dated') {
    return [];
  }

  const dateRequirement = job.schedule.requirements.find(
    (requirement) => requirement.date === date
  );
  if (!dateRequirement) {
    return [];
  }

  const slot = dateRequirement.timeSlots.find(
    (candidate) => (candidate.startTime ?? '') === timeSlot
  );
  if (!slot) {
    return [];
  }

  return slot.roles.map(normalizePostingSlotRoleRequirement);
}

export { filterRoles as filterAvailableRoles };
export { findRole as findRoleById };

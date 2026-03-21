import type { JobPosting } from '@/types';
import type { RoleRequirement as DateRoleRequirement } from '@/types/jobPosting/dateRequirement';
import type { PostingFixedRoleRequirement, PostingSlotRoleRequirement } from '@/types/jobPosting';
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

function normalizePostingFixedRoleRequirement(role: PostingFixedRoleRequirement): RoleInfo {
  return createRoleInfo(role.role ?? 'other', role.count, role.filled ?? 0, role.customRole);
}

function normalizePostingSlotRoleRequirement(role: PostingSlotRoleRequirement): RoleInfo {
  return createRoleInfo(role.role ?? 'other', role.count, role.filled ?? 0, role.customRole);
}

function getRoleAggregationKey(role: RoleInfo): string {
  return role.roleId === 'other' && role.customName ? `other:${role.customName}` : role.roleId;
}

export function normalizeJobRoles(job: JobPosting): RoleInfo[] {
  if (job.schedule.kind === 'fixed') {
    return (job.schedule.roleRequirements ?? []).map(normalizePostingFixedRoleRequirement);
  }

  if (job.schedule.kind === 'dated' && job.schedule.requirements.length > 0) {
    const roleMap = new Map<string, RoleInfo>();

    for (const dateRequirement of job.schedule.requirements) {
      for (const slot of dateRequirement.timeSlots) {
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

  return [];
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

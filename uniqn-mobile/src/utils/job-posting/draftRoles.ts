import { STAFF_ROLES } from '@/constants';
import { RoleResolver } from '@/shared/role';
import type { PostingRoleCatalogEntry, SalaryInfo } from '@/types/jobPosting';
import type { FormRoleWithCount, JobPostingFormData } from '@/types/jobPostingForm';
import type { RoleRequirement, TimeSlot } from '@/types/jobPosting/dateRequirement';
import { generateId } from '@/utils/generateId';

const getRoleDisplayName = RoleResolver.toDisplayName.bind(RoleResolver);

function findRoleOptionByName(name: string) {
  return STAFF_ROLES.find((role) => role.name === name);
}

function getRoleKey(role: { role?: string; customRole?: string }): string {
  if (role.role === 'other' && role.customRole) {
    return `other:${role.customRole}`;
  }

  return role.role ?? '';
}

function getFormRoleKey(role: Pick<FormRoleWithCount, 'name' | 'isCustom'>): string {
  const normalizedName = role.name.trim();

  if (!normalizedName) {
    return '';
  }

  if (role.isCustom) {
    return `other:${normalizedName}`;
  }

  const matchedRole = findRoleOptionByName(normalizedName);
  if (!matchedRole || matchedRole.key === 'other') {
    return `other:${normalizedName}`;
  }

  return matchedRole.key;
}

function areFormRolesEqual(left: FormRoleWithCount[], right: FormRoleWithCount[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const leftMap = new Map(left.map((role) => [getFormRoleKey(role), role.count]));

  return right.every((role) => {
    const key = getFormRoleKey(role);
    const existingCount = leftMap.get(key);

    if (existingCount === undefined) {
      return false;
    }

    return existingCount === role.count;
  });
}

export function shouldPreserveNonFixedDraftRoles(
  data: Pick<
    JobPostingFormData,
    'postingType' | 'dateSpecificRequirements' | 'datedTemplateTimeSlots'
  >
): boolean {
  if (data.postingType === 'fixed') {
    return false;
  }

  if ((data.dateSpecificRequirements?.length ?? 0) > 0) {
    return false;
  }

  return (data.datedTemplateTimeSlots?.length ?? 0) > 0;
}

export function buildSeedRoleRequirements(roles: FormRoleWithCount[]): RoleRequirement[] {
  const seededRoles: RoleRequirement[] = [];

  roles.forEach((role) => {
    const normalizedName = role.name.trim();

    if (!normalizedName) {
      return;
    }

    const matchedRole = findRoleOptionByName(normalizedName);

    if (!matchedRole || role.isCustom || matchedRole.key === 'other') {
      seededRoles.push({
        id: generateId(),
        role: 'other',
        customRole: normalizedName,
        headcount: Math.max(1, role.count),
        ...(role.salary ? { salary: role.salary } : {}),
      });
      return;
    }

    seededRoles.push({
      id: generateId(),
      role: matchedRole.key,
      headcount: Math.max(1, role.count),
      ...(role.salary ? { salary: role.salary } : {}),
    });
  });

  if (seededRoles.length > 0) {
    return seededRoles;
  }

  return [
    {
      id: generateId(),
      role: 'dealer',
      headcount: 1,
    },
  ];
}

export function buildSeedTimeSlotsFromRoles(roles: FormRoleWithCount[]): TimeSlot[] {
  return [
    {
      id: generateId(),
      startTime: '09:00',
      isTimeToBeAnnounced: false,
      roles: buildSeedRoleRequirements(roles),
    },
  ];
}

export function cloneTimeSlotsWithFreshIds(timeSlots: TimeSlot[]): TimeSlot[] {
  return timeSlots.map((slot) => ({
    ...slot,
    id: generateId(),
    roles: slot.roles.map((role) => ({
      ...role,
      id: generateId(),
    })),
  }));
}

export function extractDraftRolesFromTimeSlots(
  timeSlots: TimeSlot[],
  roleCatalog: PostingRoleCatalogEntry[] = []
): FormRoleWithCount[] {
  const roleCatalogMap = new Map(roleCatalog.map((entry) => [getRoleKey(entry), entry]));
  const aggregatedRoles = new Map<
    string,
    {
      role: PostingRoleCatalogEntry['role'];
      customRole?: string;
      count: number;
      salary?: SalaryInfo;
    }
  >();

  timeSlots.forEach((slot) => {
    slot.roles.forEach((roleRequirement) => {
      const role = roleRequirement.role ?? 'dealer';
      const key = getRoleKey({
        role,
        customRole: roleRequirement.customRole,
      });
      const existing = aggregatedRoles.get(key);
      const catalogEntry = roleCatalogMap.get(key);

      aggregatedRoles.set(key, {
        role: catalogEntry?.role ?? role,
        customRole: catalogEntry?.customRole ?? roleRequirement.customRole,
        count: (existing?.count ?? 0) + Math.max(1, roleRequirement.headcount ?? 1),
        salary: catalogEntry?.salary ?? existing?.salary ?? roleRequirement.salary,
      });
    });
  });

  return Array.from(aggregatedRoles.values()).map((entry) => ({
    name: entry.role === 'other' ? entry.customRole || '' : getRoleDisplayName(entry.role),
    count: entry.count,
    isCustom: entry.role === 'other',
    ...(entry.salary ? { salary: entry.salary } : {}),
  }));
}

export function buildSeedTimeSlots(
  data: Pick<JobPostingFormData, 'roles' | 'dateSpecificRequirements' | 'datedTemplateTimeSlots'>
): TimeSlot[] {
  const firstRequirement = data.dateSpecificRequirements?.find(
    (requirement) => (requirement.timeSlots?.length ?? 0) > 0
  );

  if (firstRequirement) {
    return cloneTimeSlotsWithFreshIds(firstRequirement.timeSlots);
  }

  if ((data.datedTemplateTimeSlots?.length ?? 0) > 0) {
    const templateRoles = extractDraftRolesFromTimeSlots(data.datedTemplateTimeSlots ?? []);

    if (areFormRolesEqual(templateRoles, data.roles)) {
      return cloneTimeSlotsWithFreshIds(data.datedTemplateTimeSlots ?? []);
    }
  }

  return buildSeedTimeSlotsFromRoles(data.roles);
}

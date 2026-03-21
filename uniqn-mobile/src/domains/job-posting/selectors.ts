import type {
  JobPosting,
  JobRoleStats,
  PostingCompensation,
  PostingRoleCatalogEntry,
  SalaryInfo,
} from '@/types/jobPosting';

export interface PostingSettlementContext {
  roles: JobRoleStats[];
  defaultSalary?: SalaryInfo;
  allowances?: PostingCompensation['allowances'];
  taxSettings?: PostingCompensation['taxSettings'];
}

function getRoleKey(role: { role?: string; customRole?: string }): string {
  if (role.role === 'other' && role.customRole) {
    return `other:${role.customRole}`;
  }

  return role.role ?? '';
}

export function getPostingRoleStats(posting: JobPosting): JobRoleStats[] {
  if (posting.schedule.kind === 'fixed') {
    return (posting.schedule.roleRequirements ?? []).map((role) => {
      const catalogEntry = posting.roleCatalog.find(
        (entry) => getRoleKey(entry) === getRoleKey(role)
      );

      return {
        role: catalogEntry?.role ?? role.role ?? 'dealer',
        customRole: role.customRole,
        count: role.count,
        filled: role.filled ?? 0,
        salary: catalogEntry?.salary,
      };
    });
  }

  const totals = new Map<string, JobRoleStats>();

  posting.schedule.requirements.forEach((requirement) => {
    requirement.timeSlots.forEach((slot) => {
      slot.roles.forEach((role) => {
        const key = getRoleKey(role);
        const existing = totals.get(key);
        const catalogEntry = posting.roleCatalog.find((entry) => getRoleKey(entry) === key);

        if (existing) {
          existing.count += role.count;
          existing.filled += role.filled ?? 0;
          return;
        }

        totals.set(key, {
          role: catalogEntry?.role ?? role.role ?? 'dealer',
          customRole: role.customRole,
          count: role.count,
          filled: role.filled ?? 0,
          salary: catalogEntry?.salary,
        });
      });
    });
  });

  return Array.from(totals.values());
}

export function getPostingDefaultSalary(
  roleCatalog: PostingRoleCatalogEntry[],
  compensation: PostingCompensation
): SalaryInfo | undefined {
  return compensation.defaultSalary ?? roleCatalog.find((role) => role.salary)?.salary;
}

export function getPostingSettlementContext(posting: JobPosting) {
  return {
    roles: getPostingRoleStats(posting),
    defaultSalary: getPostingDefaultSalary(posting.roleCatalog, posting.compensation),
    allowances: posting.compensation.allowances,
    taxSettings: posting.compensation.taxSettings,
  } satisfies PostingSettlementContext;
}

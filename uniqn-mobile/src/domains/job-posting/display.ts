import type {
  CardDateRequirement,
  JobPosting,
  JobPostingCard,
  PostingAudience,
  PostingCardViewModel,
  PostingDetailViewModel,
  PostingFacts,
  PostingManagementViewModel,
  PostingSalaryRow,
  PostingSurface,
  SalaryInfo,
} from '@/types/jobPosting';
import type { DateSpecificRequirement } from '@/types/jobPosting/dateRequirement';
import type { RoleWithCount } from '@/types/postingConfig';
import type { PreQuestion } from '@/types/preQuestion';
import { getRoleDisplayName } from '@/types/unified';
import { getAllowanceItems } from '@/utils/allowanceUtils';
import { formatSalary } from '@/utils/formatters';

function getRoleKey(role: { role?: string; customRole?: string }): string {
  if (role.role === 'other' && role.customRole) {
    return `other:${role.customRole}`;
  }

  return role.role ?? '';
}

function getLocationLabels(posting: JobPosting): { shortLabel: string; fullLabel: string } {
  const name = posting.location?.name || '';
  const detailed = posting.location?.detailedAddress || '';

  return {
    shortLabel: name,
    fullLabel: `${name}${detailed ? ` ${detailed}` : ''}`.trim(),
  };
}

function getTaxLabel(posting: JobPosting): string | undefined {
  const taxSettings = posting.compensation.taxSettings;

  if (!taxSettings || taxSettings.type === 'none') {
    return undefined;
  }

  return taxSettings.type === 'rate'
    ? `세금 ${taxSettings.value}%`
    : `세금 ${taxSettings.value.toLocaleString('ko-KR')}원`;
}

function getRoleWithCount(role: {
  role?: string;
  customRole?: string;
  count: number;
  filled?: number;
}): RoleWithCount {
  return {
    role: role.role ?? 'dealer',
    name: role.customRole,
    count: role.count,
    filled: role.filled ?? 0,
  };
}

function getSalaryRows(posting: JobPosting): PostingSalaryRow[] {
  const rows = (posting.roleCatalog ?? [])
    .filter((role) => role.salary)
    .map((role) => {
      const roleKey = role.role === 'other' && role.customRole ? role.customRole : role.role;
      const roleLabel = getRoleDisplayName(role.role, role.customRole);

      return {
        key: `${roleKey}-${role.salary?.type}-${role.salary?.amount}`,
        role: role.role,
        customRole: role.customRole,
        roleLabel,
        salary: role.salary!,
        text:
          role.salary?.type === 'other'
            ? '협의'
            : formatSalary(role.salary?.type || 'hourly', role.salary?.amount || 0),
      };
    });

  const unique = new Map<string, PostingSalaryRow>();
  rows.forEach((row) => {
    if (!unique.has(row.key)) {
      unique.set(row.key, row);
    }
  });

  return Array.from(unique.values());
}

function getDerivedRoles(posting: JobPosting): PostingFacts['posting']['roles'] {
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

  const totals = new Map<string, PostingFacts['posting']['roles'][number]>();

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

function getDefaultSalary(
  posting: JobPosting,
  salaryRows: PostingSalaryRow[]
): SalaryInfo | undefined {
  return posting.compensation.defaultSalary ?? salaryRows[0]?.salary;
}

function getDateRequirements(posting: JobPosting): CardDateRequirement[] {
  if (posting.schedule.kind !== 'dated') {
    return [];
  }

  return posting.schedule.requirements.map((requirement) => ({
    date: requirement.date,
    isGrouped: requirement.isGrouped,
    timeSlots: requirement.timeSlots.map((slot) => ({
      id: slot.id,
      startTime: slot.startTime || '',
      isTimeToBeAnnounced: slot.isTimeToBeAnnounced ?? false,
      tentativeDescription: slot.tentativeDescription,
      roles: slot.roles.map((role) => ({
        id: role.id,
        role: role.role ?? 'dealer',
        customRole: role.customRole,
        count: role.count,
        filled: role.filled ?? 0,
      })),
    })),
  }));
}

export function createPostingLegacyDateRequirements(
  posting: JobPosting
): DateSpecificRequirement[] {
  if (posting.schedule.kind !== 'dated') {
    return [];
  }

  return posting.schedule.requirements.map((requirement) => ({
    date: requirement.date,
    isGrouped: requirement.isGrouped,
    timeSlots: requirement.timeSlots.map((slot) => ({
      id: slot.id,
      startTime: slot.startTime,
      isTimeToBeAnnounced: slot.isTimeToBeAnnounced,
      tentativeDescription: slot.tentativeDescription,
      roles: slot.roles.map((role) => ({
        id: role.id,
        role: role.role,
        customRole: role.customRole,
        headcount: role.count,
        filled: role.filled ?? 0,
      })),
    })),
  }));
}

function getQuestions(posting: JobPosting): PreQuestion[] {
  return posting.questions.items ?? [];
}

function getLegacyTimeSlot(posting: JobPosting): string {
  if (posting.schedule.kind === 'fixed') {
    return posting.schedule.startTime ? `${posting.schedule.startTime}~` : '';
  }

  const firstSlot = posting.schedule.requirements[0]?.timeSlots[0];
  if (!firstSlot) {
    return '';
  }

  if (firstSlot.isTimeToBeAnnounced) {
    return '미정';
  }

  return firstSlot.startTime || '';
}

function getRequiredRolesWithCount(posting: JobPosting): RoleWithCount[] | undefined {
  if (posting.schedule.kind !== 'fixed') {
    return undefined;
  }

  return posting.schedule.roleRequirements?.map(getRoleWithCount);
}

export function buildPostingFacts(posting: JobPosting): PostingFacts {
  const salaryRows = getSalaryRows(posting);
  const location = getLocationLabels(posting);
  const dateRequirements = getDateRequirements(posting);
  const allowances = posting.compensation.allowances;
  const allowanceLabels = getAllowanceItems(allowances, { includeEmoji: true });
  const defaultSalary = getDefaultSalary(posting, salaryRows);
  const questions = getQuestions(posting);
  const roles = getDerivedRoles(posting);

  return {
    posting: {
      ...posting,
      roles,
    },
    title: posting.title,
    description: posting.description,
    status: posting.status,
    postingType: posting.postingType,
    isUrgent: posting.postingType === 'urgent',
    location,
    owner: {
      id: posting.ownerId,
      name: posting.ownerName,
      contactPhone: posting.contactPhone,
    },
    schedule: {
      kind: posting.schedule.kind,
      workDate: posting.workDate,
      timeSlot: getLegacyTimeSlot(posting),
      dateRequirements,
      daysPerWeek: posting.schedule.kind === 'fixed' ? posting.schedule.daysPerWeek : undefined,
      startTime: posting.schedule.kind === 'fixed' ? posting.schedule.startTime : undefined,
      isStartTimeNegotiable:
        posting.schedule.kind === 'fixed' ? posting.schedule.isStartTimeNegotiable : undefined,
      requiredRolesWithCount: getRequiredRolesWithCount(posting),
    },
    compensation: {
      mode: posting.compensation.mode,
      defaultSalary,
      salaryRows,
      allowanceLabels,
      taxLabel: getTaxLabel(posting),
    },
    stats: {
      totalPositions: posting.totalPositions,
      filledPositions: posting.filledPositions,
      applicationCount: posting.applicationCount ?? 0,
    },
    questions: {
      items: questions,
      enabled: questions.length > 0,
    },
    tournamentConfig: posting.tournamentConfig,
  };
}

function projectCard(facts: PostingFacts): PostingCardViewModel {
  const salaryRows = facts.compensation.salaryRows;

  return {
    id: facts.posting.id,
    title: facts.title,
    description: facts.description,
    location: facts.location.shortLabel,
    fullLocation: facts.location.fullLabel,
    workDate: facts.schedule.workDate,
    timeSlot: facts.schedule.timeSlot,
    roles: facts.posting.roleCatalog.map((role) => role.role),
    dateRequirements: facts.schedule.dateRequirements,
    defaultSalary: facts.compensation.defaultSalary,
    allowances: facts.posting.compensation.allowances,
    allowanceLabels: facts.compensation.allowanceLabels,
    taxSettings: facts.posting.compensation.taxSettings,
    taxLabel: facts.compensation.taxLabel,
    useSameSalary: facts.compensation.mode === 'shared',
    status: facts.status,
    isUrgent: facts.isUrgent,
    applicationCount: facts.stats.applicationCount,
    postingType: facts.postingType,
    ownerName: facts.owner.name,
    contactPhone: facts.owner.contactPhone,
    ownerId: facts.owner.id,
    daysPerWeek: facts.schedule.daysPerWeek,
    startTime: facts.schedule.startTime,
    requiredRolesWithCount: facts.schedule.requiredRolesWithCount,
    tournamentConfig: facts.tournamentConfig,
    salaryRows: salaryRows.slice(0, 3),
    salaryOverflowCount: Math.max(0, salaryRows.length - 3),
  };
}

function projectDetail(facts: PostingFacts): PostingDetailViewModel {
  return {
    id: facts.posting.id,
    title: facts.title,
    description: facts.description,
    status: facts.status,
    postingType: facts.postingType,
    isUrgent: facts.isUrgent,
    locationLabel: facts.location.fullLabel,
    contactPhone: facts.owner.contactPhone,
    workDate: facts.schedule.workDate,
    timeSlot: facts.schedule.timeSlot,
    dateRequirements: facts.schedule.dateRequirements,
    daysPerWeek: facts.schedule.daysPerWeek,
    startTime: facts.schedule.startTime,
    isStartTimeNegotiable: facts.schedule.isStartTimeNegotiable,
    requiredRolesWithCount: facts.schedule.requiredRolesWithCount,
    salaryRows: facts.compensation.salaryRows,
    defaultSalary: facts.compensation.defaultSalary,
    useSameSalary: facts.compensation.mode === 'shared',
    allowances: facts.posting.compensation.allowances,
    allowanceLabels: facts.compensation.allowanceLabels,
    taxSettings: facts.posting.compensation.taxSettings,
    taxLabel: facts.compensation.taxLabel,
    questions: facts.questions.items,
    ownerName: facts.owner.name,
    ownerId: facts.owner.id,
    applicationCount: facts.stats.applicationCount,
    viewCount: facts.posting.viewCount,
    totalPositions: facts.stats.totalPositions,
    filledPositions: facts.stats.filledPositions,
    tournamentConfig: facts.tournamentConfig,
  };
}

function projectManagement(facts: PostingFacts): PostingManagementViewModel {
  return {
    ...projectDetail(facts),
    totalApplicants: facts.stats.applicationCount,
    confirmedApplicants: 0,
    pendingApplicants: facts.stats.applicationCount,
  };
}

export function projectPostingCard(facts: PostingFacts): PostingCardViewModel {
  return projectCard(facts);
}

export function projectPostingDetail(facts: PostingFacts): PostingDetailViewModel {
  return projectDetail(facts);
}

export function projectPostingManagement(facts: PostingFacts): PostingManagementViewModel {
  return projectManagement(facts);
}

export function projectPostingSurface(
  facts: PostingFacts,
  options: {
    audience: PostingAudience;
    surface: PostingSurface;
  }
): PostingCardViewModel | PostingDetailViewModel | PostingManagementViewModel {
  if (options.surface === 'card') {
    return projectCard(facts);
  }

  if (options.surface === 'manage') {
    return projectManagement(facts);
  }

  return projectDetail(facts);
}

export function toJobPostingCard(posting: JobPosting): JobPostingCard {
  return projectCard(buildPostingFacts(posting));
}

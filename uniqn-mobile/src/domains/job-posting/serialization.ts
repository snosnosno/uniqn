import { Timestamp } from 'firebase/firestore';
import type {
  CreateJobPostingInput,
  ClosedReason,
  JobPosting,
  JobPostingDocumentV3,
  JobPostingStatus,
  PostingCompensation,
  PostingDateRequirement,
  PostingFixedRoleRequirement,
  PostingRoleCatalogEntry,
  PostingSchedule,
  PostingTimeSlot,
  RoleRequirement,
  SalaryInfo,
} from '@/types/jobPosting';
import type { DateSpecificRequirement, TimeSlot } from '@/types/jobPosting/dateRequirement';
import type { PreQuestion } from '@/types/preQuestion';
import type { StaffRole } from '@/types/role';
import { getDateString } from '@/types/jobPosting/dateRequirement';
import { JOB_POSTING_SCHEMA_VERSION } from '@/types/jobPosting';

interface SerializeJobPostingV3Options {
  ownerId: string;
  ownerName?: string;
  status?: JobPostingStatus;
  current?: Partial<JobPosting>;
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

interface LegacyRoleInput {
  role?: string;
  name?: string;
  customRole?: string;
  count?: number;
  headcount?: number;
  filled?: number;
  salary?: SalaryInfo;
}

function normalizePostingType(input: CreateJobPostingInput): CreateJobPostingInput['postingType'] {
  if (input.postingType) {
    return input.postingType;
  }

  if (input.isUrgent) {
    return 'urgent';
  }

  return 'regular';
}

function getRoleKey(role: { role?: string; customRole?: string }): string {
  if (role.role === 'other' && role.customRole) {
    return `other:${role.customRole}`;
  }

  return role.role ?? '';
}

function getRoleKeysFromCatalog(roleCatalog: PostingRoleCatalogEntry[]): string[] {
  const keys = new Set<string>();

  roleCatalog.forEach((role) => {
    const key = getRoleKey(role);
    if (key) {
      keys.add(key);
    }
  });

  return Array.from(keys);
}

function getLegacyRoleCount(role: LegacyRoleInput): number {
  return role.count ?? role.headcount ?? 0;
}

function extractStartTime(timeSlot?: string, fallback?: string): string | undefined {
  if (fallback) {
    return fallback;
  }

  if (!timeSlot) {
    return undefined;
  }

  return timeSlot.split(/[-~]/)[0]?.trim() || undefined;
}

function extractQuestions(input: CreateJobPostingInput): PreQuestion[] {
  if (input.usesPreQuestions === false) {
    return [];
  }

  return input.preQuestions ?? [];
}

function toRoleCatalog(roles: LegacyRoleInput[]): PostingRoleCatalogEntry[] {
  return roles.map((role) => ({
    role: ((role.role ?? 'dealer') as StaffRole | 'other') || 'dealer',
    customRole: role.customRole,
    salary: role.salary,
  }));
}

function toScheduleTimeSlots(
  slots: TimeSlot[],
  roleCatalog: PostingRoleCatalogEntry[]
): PostingTimeSlot[] {
  const catalogByKey = new Map(roleCatalog.map((role) => [getRoleKey(role), role]));

  return (slots ?? []).map((slot) => ({
    id: slot.id,
    startTime: slot.startTime,
    isTimeToBeAnnounced: slot.isTimeToBeAnnounced ?? false,
    tentativeDescription: slot.tentativeDescription,
    roles: (slot.roles ?? []).map((role) => {
      const normalizedRole = (role.role ?? 'dealer') as StaffRole | 'other';
      const key =
        normalizedRole === 'other' && role.customRole ? `other:${role.customRole}` : normalizedRole;

      const catalogEntry = catalogByKey.get(key);

      return {
        id: role.id,
        role: catalogEntry?.role ?? normalizedRole,
        customRole: role.customRole,
        count: role.headcount ?? 0,
        filled: role.filled ?? 0,
      };
    }),
  }));
}

function buildDatedSchedule(
  input: CreateJobPostingInput,
  roleCatalog: PostingRoleCatalogEntry[]
): PostingSchedule {
  const requirements: PostingDateRequirement[] = (input.dateSpecificRequirements ?? [])
    .map((requirement) => ({
      date: getDateString(requirement.date),
      isGrouped: requirement.isGrouped,
      timeSlots: toScheduleTimeSlots(requirement.timeSlots ?? [], roleCatalog),
    }))
    .filter((requirement) => requirement.date);

  if (requirements.length > 0) {
    return {
      kind: 'dated',
      primaryDate: input.workDate || requirements[0]?.date || '',
      allDates: requirements.map((requirement) => requirement.date),
      requirements,
    };
  }

  const fallbackRoles = (input.roles as LegacyRoleInput[]).map((role) => ({
    role: (role.role ?? 'dealer') as StaffRole | 'other',
    customRole: role.customRole,
    count: getLegacyRoleCount(role),
    filled: role.filled ?? 0,
  }));

  return {
    kind: 'dated',
    primaryDate: input.workDate || '',
    allDates: input.workDate ? [input.workDate] : [],
    requirements: input.workDate
      ? [
          {
            date: input.workDate,
            timeSlots: [
              {
                startTime: extractStartTime(input.timeSlot, input.startTime),
                isTimeToBeAnnounced: false,
                roles: fallbackRoles,
              },
            ],
          },
        ]
      : [],
  };
}

function buildFixedSchedule(input: CreateJobPostingInput): PostingSchedule {
  const roleRequirements: PostingFixedRoleRequirement[] = (input.roles as LegacyRoleInput[]).map(
    (role) => ({
      role: (role.role ?? 'dealer') as StaffRole | 'other',
      customRole: role.customRole,
      count: getLegacyRoleCount(role),
      filled: role.filled ?? 0,
    })
  );

  return {
    kind: 'fixed',
    daysPerWeek: input.daysPerWeek,
    startTime: extractStartTime(input.timeSlot, input.startTime),
    isStartTimeNegotiable: input.isStartTimeNegotiable,
    roleRequirements,
  };
}

function buildSchedule(
  input: CreateJobPostingInput,
  postingType: CreateJobPostingInput['postingType'],
  roleCatalog: PostingRoleCatalogEntry[]
): PostingSchedule {
  if (postingType === 'fixed') {
    return buildFixedSchedule(input);
  }

  return buildDatedSchedule(input, roleCatalog);
}

function buildCompensation(input: CreateJobPostingInput): PostingCompensation {
  return {
    mode: input.useSameSalary ? 'shared' : 'by_role',
    defaultSalary: input.defaultSalary,
    allowances: input.allowances,
    taxSettings: input.taxSettings,
  };
}

function normalizeOptionalText(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function buildPostingLocation(input: CreateJobPostingInput): JobPostingDocumentV3['location'] {
  const district =
    normalizeOptionalText(input.location?.district) ??
    normalizeOptionalText(input.location?.address);
  const detailedAddress = normalizeOptionalText(input.detailedAddress);

  return {
    name: input.location.name.trim(),
    ...(district ? { district } : {}),
    ...(detailedAddress ? { detailedAddress } : {}),
  };
}

function calculateTotalsFromSchedule(schedule: PostingSchedule): {
  totalPositions: number;
  filledPositions: number;
  workDate: string;
  workDates?: string[];
  timeSlot: string;
} {
  if (schedule.kind === 'fixed') {
    const totalPositions = (schedule.roleRequirements ?? []).reduce(
      (sum, role) => sum + role.count,
      0
    );
    const filledPositions = (schedule.roleRequirements ?? []).reduce(
      (sum, role) => sum + (role.filled ?? 0),
      0
    );

    return {
      totalPositions,
      filledPositions,
      workDate: '',
      workDates: undefined,
      timeSlot: schedule.startTime ? `${schedule.startTime}~` : '',
    };
  }

  const totalPositions = schedule.requirements.reduce(
    (dateSum, requirement) =>
      dateSum +
      requirement.timeSlots.reduce(
        (slotSum, slot) => slotSum + slot.roles.reduce((sum, role) => sum + role.count, 0),
        0
      ),
    0
  );

  const filledPositions = schedule.requirements.reduce(
    (dateSum, requirement) =>
      dateSum +
      requirement.timeSlots.reduce(
        (slotSum, slot) => slotSum + slot.roles.reduce((sum, role) => sum + (role.filled ?? 0), 0),
        0
      ),
    0
  );

  const firstRequirement = schedule.requirements[0];
  const firstSlot = firstRequirement?.timeSlots[0];
  const timeSlot = firstSlot
    ? firstSlot.isTimeToBeAnnounced
      ? '미정'
      : firstSlot.startTime || ''
    : '';

  return {
    totalPositions,
    filledPositions,
    workDate: schedule.primaryDate,
    workDates: schedule.allDates.length > 0 ? schedule.allDates : undefined,
    timeSlot,
  };
}

export function serializeJobPostingV3(
  input: CreateJobPostingInput,
  options: SerializeJobPostingV3Options
): JobPostingDocumentV3 {
  const postingType = normalizePostingType(input);
  const current = options.current;
  const roleCatalog = toRoleCatalog(input.roles as LegacyRoleInput[]);
  const schedule = buildSchedule(input, postingType, roleCatalog);
  const totals = calculateTotalsFromSchedule(schedule);

  return {
    id: current?.id || '',
    schemaVersion: JOB_POSTING_SCHEMA_VERSION,
    title: input.title,
    description: input.description || '',
    status: options.status || current?.status || 'active',
    ownerId: options.ownerId,
    ownerName: options.ownerName ?? current?.ownerName,
    postingType,
    workDate: totals.workDate,
    workDates: totals.workDates,
    roleKeys: getRoleKeysFromCatalog(roleCatalog),
    totalPositions: totals.totalPositions,
    filledPositions: current?.filledPositions ?? totals.filledPositions,
    viewCount: current?.viewCount ?? 0,
    applicationCount: current?.applicationCount ?? 0,
    createdAt: options.createdAt ?? current?.createdAt,
    updatedAt: options.updatedAt ?? current?.updatedAt,
    closedAt: current?.closedAt,
    closedReason: current?.closedReason,
    tags: input.tags ?? current?.tags,
    contactPhone: input.contactPhone,
    location: buildPostingLocation(input),
    schedule,
    roleCatalog,
    compensation: buildCompensation(input),
    questions: {
      items: extractQuestions(input),
    },
    fixedConfig: current?.fixedConfig,
    tournamentConfig: current?.tournamentConfig,
    urgentConfig:
      postingType === 'urgent'
        ? current?.urgentConfig || {
            createdAt: Timestamp.now(),
            priority: 'high',
          }
        : undefined,
  };
}

function toDateSpecificRequirements(posting: JobPosting): DateSpecificRequirement[] {
  if (posting.dateSpecificRequirements) {
    return posting.dateSpecificRequirements;
  }

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

export function toCreateJobPostingInput(posting: JobPosting): CreateJobPostingInput {
  const compensation = posting.compensation;
  const questions = posting.questions.items ?? posting.preQuestions ?? [];

  return {
    postingType: posting.postingType,
    title: posting.title,
    description: posting.description,
    location: {
      ...posting.location,
      address: posting.location.address ?? posting.location.district,
    },
    detailedAddress: posting.location.detailedAddress,
    contactPhone: posting.contactPhone,
    workDate: posting.workDate,
    timeSlot: posting.timeSlot,
    startTime: posting.schedule.kind === 'fixed' ? posting.schedule.startTime : undefined,
    dateSpecificRequirements: toDateSpecificRequirements(posting),
    daysPerWeek: posting.schedule.kind === 'fixed' ? posting.schedule.daysPerWeek : undefined,
    isStartTimeNegotiable:
      posting.schedule.kind === 'fixed' ? posting.schedule.isStartTimeNegotiable : undefined,
    roles: posting.roles,
    defaultSalary: compensation.defaultSalary ?? posting.defaultSalary,
    allowances: compensation.allowances ?? posting.allowances,
    taxSettings: compensation.taxSettings ?? posting.taxSettings,
    useSameSalary: compensation.mode === 'shared',
    usesPreQuestions: questions.length > 0,
    preQuestions: questions,
    tags: posting.tags,
    isUrgent: posting.postingType === 'urgent',
  };
}

function aggregateRolesFromDatedRequirements(
  requirements: PostingDateRequirement[],
  roleCatalog: PostingRoleCatalogEntry[]
): RoleRequirement[] {
  const map = new Map<string, RoleRequirement>();
  const catalogByKey = new Map(roleCatalog.map((role) => [getRoleKey(role), role]));

  requirements.forEach((requirement) => {
    requirement.timeSlots.forEach((slot) => {
      slot.roles.forEach((role) => {
        const key =
          role.role === 'other' && role.customRole ? `other:${role.customRole}` : role.role || '';
        const existing = map.get(key);
        const catalogEntry = catalogByKey.get(key);

        if (existing) {
          existing.count += role.count;
          existing.filled = (existing.filled ?? 0) + (role.filled ?? 0);
          return;
        }

        map.set(key, {
          role: (catalogEntry?.role ?? role.role ?? 'dealer') as StaffRole | 'other',
          customRole: role.customRole,
          count: role.count,
          filled: role.filled ?? 0,
          salary: catalogEntry?.salary,
        });
      });
    });
  });

  return Array.from(map.values());
}

function buildCompatEntity(document: JobPostingDocumentV3): JobPosting {
  const questions = document.questions.items ?? [];
  const useSameSalary = document.compensation.mode === 'shared';

  if (document.schedule.kind === 'fixed') {
    const roles = (document.schedule.roleRequirements ?? []).map((role) => {
      const catalogEntry = document.roleCatalog.find(
        (entry) => getRoleKey(entry) === getRoleKey(role)
      );

      return {
        role: (catalogEntry?.role ?? role.role ?? 'dealer') as StaffRole | 'other',
        customRole: role.customRole,
        count: role.count,
        filled: role.filled ?? 0,
        salary: catalogEntry?.salary,
      };
    });

    return {
      ...document,
      roles,
      defaultSalary: document.compensation.defaultSalary,
      allowances: document.compensation.allowances,
      taxSettings: document.compensation.taxSettings,
      useSameSalary,
      preQuestions: questions,
      usesPreQuestions: questions.length > 0,
      detailedAddress: document.location.detailedAddress,
      isUrgent: document.postingType === 'urgent',
      timeSlot: document.schedule.startTime ? `${document.schedule.startTime}~` : '',
      daysPerWeek: document.schedule.daysPerWeek,
      isStartTimeNegotiable: document.schedule.isStartTimeNegotiable,
      requiredRolesWithCount: (document.schedule.roleRequirements ?? []).map((role) => ({
        role: role.role,
        count: role.count,
        filled: role.filled ?? 0,
      })),
      dateSpecificRequirements: undefined,
    };
  }

  const dateSpecificRequirements: DateSpecificRequirement[] = document.schedule.requirements.map(
    (requirement) => ({
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
    })
  );

  const roles = aggregateRolesFromDatedRequirements(
    document.schedule.requirements,
    document.roleCatalog
  );
  const firstRequirement = document.schedule.requirements[0];
  const firstSlot = firstRequirement?.timeSlots[0];

  return {
    ...document,
    roles,
    dateSpecificRequirements,
    defaultSalary: document.compensation.defaultSalary,
    allowances: document.compensation.allowances,
    taxSettings: document.compensation.taxSettings,
    useSameSalary,
    preQuestions: questions,
    usesPreQuestions: questions.length > 0,
    detailedAddress: document.location.detailedAddress,
    isUrgent: document.postingType === 'urgent',
    timeSlot: firstSlot ? (firstSlot.isTimeToBeAnnounced ? '미정' : firstSlot.startTime || '') : '',
    daysPerWeek: undefined,
    isStartTimeNegotiable: undefined,
    requiredRolesWithCount: undefined,
  };
}

function coerceLegacyRole(role: Record<string, unknown>): RoleRequirement {
  return {
    role: ((role.role ?? role.name ?? 'dealer') as StaffRole | 'other') || 'dealer',
    customRole: typeof role.customRole === 'string' ? role.customRole : undefined,
    count: Number(role.count ?? role.headcount ?? 0),
    filled: Number(role.filled ?? 0),
    salary: role.salary as SalaryInfo | undefined,
  };
}

function hasLegacyLocation(data: Record<string, unknown>): boolean {
  if (typeof data.location === 'string') {
    return data.location.trim().length > 0;
  }

  if (!data.location || typeof data.location !== 'object') {
    return false;
  }

  const name = (data.location as Record<string, unknown>).name;
  return typeof name === 'string' && name.trim().length > 0;
}

function isLegacyJobPostingCandidate(data: Record<string, unknown>): boolean {
  if (
    data.schemaVersion !== undefined &&
    (typeof data.schemaVersion !== 'number' || data.schemaVersion >= JOB_POSTING_SCHEMA_VERSION)
  ) {
    return false;
  }

  const hasIdentity =
    typeof data.title === 'string' &&
    data.title.trim().length > 0 &&
    typeof data.ownerId === 'string' &&
    data.ownerId.trim().length > 0;
  const hasSchedule =
    typeof data.workDate === 'string' ||
    typeof data.timeSlot === 'string' ||
    Array.isArray(data.dateSpecificRequirements) ||
    typeof data.daysPerWeek === 'number';
  const hasRoles = Array.isArray(data.roles) && data.roles.length > 0;

  return hasIdentity && hasLegacyLocation(data) && (hasSchedule || hasRoles);
}

export function deserializeJobPostingDocument(document: JobPostingDocumentV3): JobPosting {
  return buildCompatEntity(document);
}

export function deserializeLegacyJobPostingDocument(raw: unknown): JobPosting | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const data = raw as Record<string, unknown>;

  if (!isLegacyJobPostingCandidate(data)) {
    return null;
  }

  const legacyLocation =
    typeof data.location === 'string'
      ? { name: data.location }
      : typeof data.location === 'object' && data.location
        ? data.location
        : {};
  const legacyPostingType =
    (data.postingType as CreateJobPostingInput['postingType'] | undefined) ||
    (data.isUrgent ? 'urgent' : 'regular');
  const legacyRoles = Array.isArray(data.roles)
    ? (data.roles as Record<string, unknown>[]).map(coerceLegacyRole)
    : [];

  const legacyInput: CreateJobPostingInput = {
    postingType: legacyPostingType,
    title: String(data.title ?? ''),
    description: typeof data.description === 'string' ? data.description : '',
    location: {
      ...(legacyLocation as Record<string, unknown>),
      name:
        typeof (legacyLocation as Record<string, unknown>).name === 'string'
          ? ((legacyLocation as Record<string, unknown>).name as string)
          : '',
    },
    detailedAddress:
      typeof data.detailedAddress === 'string'
        ? data.detailedAddress
        : typeof (legacyLocation as Record<string, unknown>).detailedAddress === 'string'
          ? ((legacyLocation as Record<string, unknown>).detailedAddress as string)
          : undefined,
    contactPhone: typeof data.contactPhone === 'string' ? data.contactPhone : undefined,
    workDate: typeof data.workDate === 'string' ? data.workDate : undefined,
    timeSlot: typeof data.timeSlot === 'string' ? data.timeSlot : undefined,
    startTime: extractStartTime(data.timeSlot as string | undefined),
    dateSpecificRequirements: Array.isArray(data.dateSpecificRequirements)
      ? (data.dateSpecificRequirements as DateSpecificRequirement[])
      : undefined,
    daysPerWeek: typeof data.daysPerWeek === 'number' ? data.daysPerWeek : undefined,
    isStartTimeNegotiable:
      typeof data.isStartTimeNegotiable === 'boolean' ? data.isStartTimeNegotiable : undefined,
    roles: legacyRoles,
    defaultSalary: data.defaultSalary as SalaryInfo | undefined,
    allowances: data.allowances as CreateJobPostingInput['allowances'],
    taxSettings: data.taxSettings as CreateJobPostingInput['taxSettings'],
    useSameSalary: typeof data.useSameSalary === 'boolean' ? data.useSameSalary : undefined,
    usesPreQuestions:
      typeof data.usesPreQuestions === 'boolean' ? data.usesPreQuestions : undefined,
    preQuestions: Array.isArray(data.preQuestions)
      ? (data.preQuestions as PreQuestion[])
      : undefined,
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : undefined,
    isUrgent: typeof data.isUrgent === 'boolean' ? data.isUrgent : undefined,
  };

  const serialized = serializeJobPostingV3(legacyInput, {
    ownerId: String(data.ownerId ?? ''),
    ownerName: typeof data.ownerName === 'string' ? data.ownerName : undefined,
    status: (data.status as JobPostingStatus | undefined) ?? 'active',
    createdAt: (data.createdAt as Timestamp | Date | undefined) ?? undefined,
    updatedAt: (data.updatedAt as Timestamp | Date | undefined) ?? undefined,
    current: {
      id: String(data.id ?? ''),
      viewCount: Number(data.viewCount ?? 0),
      applicationCount: Number(data.applicationCount ?? 0),
      filledPositions: Number(data.filledPositions ?? 0),
      closedAt: data.closedAt as Timestamp | undefined,
      closedReason: data.closedReason as ClosedReason | undefined,
      tags: Array.isArray(data.tags) ? (data.tags as string[]) : undefined,
      fixedConfig: data.fixedConfig as JobPosting['fixedConfig'],
      tournamentConfig: data.tournamentConfig as JobPosting['tournamentConfig'],
      urgentConfig: data.urgentConfig as JobPosting['urgentConfig'],
    },
  });

  return buildCompatEntity({
    ...serialized,
    id: String(data.id ?? ''),
    viewCount: Number(data.viewCount ?? serialized.viewCount ?? 0),
    applicationCount: Number(data.applicationCount ?? serialized.applicationCount ?? 0),
    filledPositions: Number(data.filledPositions ?? serialized.filledPositions),
    fixedConfig: data.fixedConfig as JobPosting['fixedConfig'],
    tournamentConfig: data.tournamentConfig as JobPosting['tournamentConfig'],
    urgentConfig: data.urgentConfig as JobPosting['urgentConfig'],
    closedAt: data.closedAt as Timestamp | undefined,
    closedReason: data.closedReason as JobPostingDocumentV3['closedReason'],
  });
}

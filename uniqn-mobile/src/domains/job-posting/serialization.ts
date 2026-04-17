import type {
  CreateJobPostingInput,
  JobPosting,
  JobPostingDocumentV3,
  JobPostingStatus,
  PostingCompensation,
  PostingDateRequirement,
  PostingFixedSchedule,
  PostingLocation,
  PostingRoleCatalogEntry,
  PostingSchedule,
  PostingType,
  UpdateJobPostingInput,
} from '@/types/jobPosting';
import { JOB_POSTING_SCHEMA_VERSION } from '@/types/jobPosting';
import { calculateTotalPositionsFromSchedule, normalizePostingAggregateStats } from './stats';

interface SerializeJobPostingV3Options {
  ownerId: string;
  ownerName?: string;
  status?: JobPostingStatus;
  current?: Partial<JobPosting>;
  createdAt?: Date;
  updatedAt?: Date;
}

export const FIXED_POSTING_DURATION_DAYS = 7 as const;

export function getCanonicalPostingType(postingType?: PostingType | null): PostingType {
  return postingType ?? 'regular';
}

export function isScheduleKindCompatibleWithPostingType(
  postingType: PostingType,
  scheduleKind: PostingSchedule['kind']
): boolean {
  return postingType === 'fixed' ? scheduleKind === 'fixed' : scheduleKind === 'dated';
}

export function deriveWorkDateFieldsFromSchedule(schedule: PostingSchedule): {
  workDate: string;
  workDates?: string[];
} {
  if (schedule.kind === 'fixed') {
    return {
      workDate: '',
      workDates: undefined,
    };
  }

  return {
    workDate: schedule.primaryDate,
    workDates: schedule.allDates.length > 0 ? [...schedule.allDates] : undefined,
  };
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

function normalizeOptionalText(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function toCanonicalLocation(
  location: Pick<PostingLocation, 'name' | 'address' | 'district' | 'detailedAddress'>
): JobPostingDocumentV3['location'] {
  const district =
    normalizeOptionalText(location.district) ?? normalizeOptionalText(location.address);
  const detailedAddress = normalizeOptionalText(location.detailedAddress);

  return {
    name: location.name.trim(),
    ...(district ? { district } : {}),
    ...(detailedAddress ? { detailedAddress } : {}),
  };
}

function normalizeRuntimeLocation(location: JobPostingDocumentV3['location']): PostingLocation {
  const district = normalizeOptionalText(location.district);
  const detailedAddress = normalizeOptionalText(location.detailedAddress);

  return {
    name: location.name.trim(),
    ...(district ? { district, address: district } : {}),
    ...(detailedAddress ? { detailedAddress } : {}),
  };
}

function normalizeRoleCatalog(
  roleCatalog: CreateJobPostingInput['roleCatalog']
): PostingRoleCatalogEntry[] {
  return roleCatalog.map((role) => ({
    role: role.role ?? 'dealer',
    ...(role.customRole ? { customRole: role.customRole } : {}),
    ...(role.salary ? { salary: role.salary } : {}),
  }));
}

function normalizeDatedRequirements(
  requirements: PostingDateRequirement[]
): PostingDateRequirement[] {
  return requirements
    .map((requirement) => ({
      date: requirement.date,
      ...(requirement.isGrouped !== undefined ? { isGrouped: requirement.isGrouped } : {}),
      timeSlots: (requirement.timeSlots ?? []).map((slot) => ({
        ...(slot.id ? { id: slot.id } : {}),
        ...(slot.startTime ? { startTime: slot.startTime } : {}),
        ...(slot.isTimeToBeAnnounced !== undefined
          ? { isTimeToBeAnnounced: slot.isTimeToBeAnnounced }
          : {}),
        ...(slot.tentativeDescription ? { tentativeDescription: slot.tentativeDescription } : {}),
        roles: (slot.roles ?? []).map((role) => ({
          ...(role.id ? { id: role.id } : {}),
          ...(role.role ? { role: role.role } : {}),
          ...(role.customRole ? { customRole: role.customRole } : {}),
          count: role.count,
          ...(role.filled !== undefined ? { filled: role.filled } : {}),
        })),
      })),
    }))
    .filter((requirement) => requirement.date);
}

function normalizeSchedule(schedule: CreateJobPostingInput['schedule']): PostingSchedule {
  if (schedule.kind === 'fixed') {
    const fixedSchedule: PostingFixedSchedule = {
      kind: 'fixed',
      ...(schedule.daysPerWeek !== undefined ? { daysPerWeek: schedule.daysPerWeek } : {}),
      ...(schedule.startTime ? { startTime: schedule.startTime } : {}),
      ...(schedule.isStartTimeNegotiable !== undefined
        ? { isStartTimeNegotiable: schedule.isStartTimeNegotiable }
        : {}),
      roleRequirements: (schedule.roleRequirements ?? []).map((role) => ({
        ...(role.role ? { role: role.role } : {}),
        ...(role.customRole ? { customRole: role.customRole } : {}),
        count: role.count,
        ...(role.filled !== undefined ? { filled: role.filled } : {}),
      })),
    };

    return fixedSchedule;
  }

  const requirements = normalizeDatedRequirements(schedule.requirements ?? []);

  return {
    kind: 'dated',
    primaryDate: schedule.primaryDate || requirements[0]?.date || '',
    allDates:
      schedule.allDates && schedule.allDates.length > 0
        ? schedule.allDates
        : requirements.map((requirement) => requirement.date),
    requirements,
  };
}

function normalizeCompensation(
  compensation: CreateJobPostingInput['compensation']
): PostingCompensation {
  return {
    mode: compensation.mode,
    ...(compensation.defaultSalary ? { defaultSalary: compensation.defaultSalary } : {}),
    ...(compensation.allowances ? { allowances: compensation.allowances } : {}),
    ...(compensation.taxSettings ? { taxSettings: compensation.taxSettings } : {}),
  };
}

function buildPostingLocation(input: CreateJobPostingInput): JobPostingDocumentV3['location'] {
  return toCanonicalLocation(input.location);
}

function calculateTotalsFromSchedule(schedule: PostingSchedule): {
  totalPositions: number;
  filledPositions: number;
  workDate: string;
  workDates?: string[];
} {
  if (schedule.kind === 'fixed') {
    const totalPositions = calculateTotalPositionsFromSchedule(schedule);
    const filledPositions = (schedule.roleRequirements ?? []).reduce(
      (sum, role) => sum + (role.filled ?? 0),
      0
    );

    return {
      totalPositions,
      filledPositions,
      ...deriveWorkDateFieldsFromSchedule(schedule),
    };
  }

  // totalPositions는 사람 단위 peak 합(HANDOFF Phase 6), filledPositions는 worktree 1 책임으로 기존 슬롯 합산 유지
  const totalPositions = calculateTotalPositionsFromSchedule(schedule);

  const filledPositions = schedule.requirements.reduce(
    (dateSum, requirement) =>
      dateSum +
      requirement.timeSlots.reduce(
        (slotSum, slot) => slotSum + slot.roles.reduce((sum, role) => sum + (role.filled ?? 0), 0),
        0
      ),
    0
  );

  return {
    totalPositions,
    filledPositions,
    ...deriveWorkDateFieldsFromSchedule(schedule),
  };
}

export function serializeJobPostingV3(
  input: CreateJobPostingInput,
  options: SerializeJobPostingV3Options
): JobPostingDocumentV3 {
  const current = options.current;
  const postingType = getCanonicalPostingType(input.postingType ?? current?.postingType);
  const roleCatalog = normalizeRoleCatalog(input.roleCatalog);
  const schedule = normalizeSchedule(input.schedule);
  const compensation = normalizeCompensation(input.compensation);
  const totals = calculateTotalsFromSchedule(schedule);
  const authoritativeFilledPositions = current?.filledPositions ?? totals.filledPositions;
  const stats = normalizePostingAggregateStats(current?.stats, schedule, {
    authoritativeFilledPositions,
  });

  return {
    id: current?.id || '',
    schemaVersion: JOB_POSTING_SCHEMA_VERSION,
    title: input.title.trim(),
    ...(input.description !== undefined ? { description: input.description } : {}),
    status: options.status || current?.status || 'active',
    ownerId: options.ownerId,
    ownerName: options.ownerName ?? current?.ownerName,
    postingType,
    workDate: totals.workDate,
    ...(totals.workDates ? { workDates: totals.workDates } : {}),
    roleKeys: getRoleKeysFromCatalog(roleCatalog),
    totalPositions: totals.totalPositions,
    filledPositions: authoritativeFilledPositions,
    viewCount: current?.viewCount ?? 0,
    stats,
    createdAt: options.createdAt ?? current?.createdAt,
    updatedAt: options.updatedAt ?? current?.updatedAt,
    ...(current?.closedAt ? { closedAt: current.closedAt } : {}),
    ...(current?.closedReason ? { closedReason: current.closedReason } : {}),
    ...(input.tags ? { tags: input.tags } : {}),
    ...(input.contactPhone ? { contactPhone: input.contactPhone } : {}),
    location: buildPostingLocation(input),
    schedule,
    roleCatalog,
    compensation,
    questions: {
      items: input.questions.items ?? [],
    },
    ...(postingType === 'fixed' && current?.fixedConfig
      ? {
          fixedConfig: {
            ...current.fixedConfig,
            durationDays: FIXED_POSTING_DURATION_DAYS,
          },
        }
      : {}),
    ...(postingType === 'tournament' && current?.tournamentConfig
      ? { tournamentConfig: current.tournamentConfig }
      : {}),
    ...(postingType === 'urgent'
      ? {
          urgentConfig: current?.urgentConfig || {
            createdAt: new Date(),
            priority: 'high',
          },
        }
      : {}),
  };
}

export function toCreateJobPostingInput(posting: JobPosting): CreateJobPostingInput {
  return {
    postingType: posting.postingType,
    title: posting.title,
    ...(posting.description !== undefined ? { description: posting.description } : {}),
    location: toCanonicalLocation(posting.location),
    ...(posting.contactPhone ? { contactPhone: posting.contactPhone } : {}),
    ...(posting.tags ? { tags: posting.tags } : {}),
    schedule: posting.schedule,
    roleCatalog: posting.roleCatalog,
    compensation: posting.compensation,
    questions: posting.questions,
  };
}

export function mergeJobPostingInput(
  current: JobPosting,
  patch: UpdateJobPostingInput
): CreateJobPostingInput {
  const baseInput = toCreateJobPostingInput(current);

  return {
    ...baseInput,
    ...patch,
    location: patch.location
      ? {
          ...baseInput.location,
          ...patch.location,
        }
      : baseInput.location,
    schedule: patch.schedule ?? baseInput.schedule,
    roleCatalog: patch.roleCatalog ?? baseInput.roleCatalog,
    compensation: patch.compensation ?? baseInput.compensation,
    questions: patch.questions ?? baseInput.questions,
  };
}

export function deserializeJobPostingDocument(document: JobPostingDocumentV3): JobPosting {
  const postingType = getCanonicalPostingType(document.postingType);
  const schedule =
    document.schedule.kind === 'fixed'
      ? {
          kind: 'fixed' as const,
          ...(document.schedule.daysPerWeek !== undefined
            ? { daysPerWeek: document.schedule.daysPerWeek }
            : {}),
          ...(document.schedule.startTime ? { startTime: document.schedule.startTime } : {}),
          ...(document.schedule.isStartTimeNegotiable !== undefined
            ? { isStartTimeNegotiable: document.schedule.isStartTimeNegotiable }
            : {}),
          roleRequirements: (document.schedule.roleRequirements ?? []).map((role) => ({
            ...(role.role ? { role: role.role } : {}),
            ...(role.customRole ? { customRole: role.customRole } : {}),
            count: role.count,
            ...(role.filled !== undefined ? { filled: role.filled } : {}),
          })),
        }
      : {
          kind: 'dated' as const,
          primaryDate: document.schedule.primaryDate,
          allDates: [...document.schedule.allDates],
          requirements: document.schedule.requirements.map((requirement) => ({
            date: requirement.date,
            ...(requirement.isGrouped !== undefined ? { isGrouped: requirement.isGrouped } : {}),
            timeSlots: requirement.timeSlots.map((slot) => ({
              ...(slot.id ? { id: slot.id } : {}),
              ...(slot.startTime ? { startTime: slot.startTime } : {}),
              ...(slot.isTimeToBeAnnounced !== undefined
                ? { isTimeToBeAnnounced: slot.isTimeToBeAnnounced }
                : {}),
              ...(slot.tentativeDescription
                ? { tentativeDescription: slot.tentativeDescription }
                : {}),
              roles: slot.roles.map((role) => ({
                ...(role.id ? { id: role.id } : {}),
                ...(role.role ? { role: role.role } : {}),
                ...(role.customRole ? { customRole: role.customRole } : {}),
                count: role.count,
                ...(role.filled !== undefined ? { filled: role.filled } : {}),
              })),
            })),
          })),
        };
  const derivedDates = deriveWorkDateFieldsFromSchedule(schedule);
  const stats = normalizePostingAggregateStats(document.stats, schedule, {
    authoritativeFilledPositions: document.filledPositions,
  });

  return {
    id: document.id,
    schemaVersion: document.schemaVersion,
    title: document.title,
    ...(document.description !== undefined ? { description: document.description } : {}),
    status: document.status,
    ownerId: document.ownerId,
    ...(document.ownerName !== undefined ? { ownerName: document.ownerName } : {}),
    postingType,
    workDate: derivedDates.workDate,
    ...(derivedDates.workDates ? { workDates: derivedDates.workDates } : {}),
    ...(document.roleKeys ? { roleKeys: [...document.roleKeys] } : {}),
    totalPositions: document.totalPositions,
    filledPositions: stats.filledPositions,
    ...(document.viewCount !== undefined ? { viewCount: document.viewCount } : {}),
    stats,
    ...(document.createdAt !== undefined ? { createdAt: document.createdAt } : {}),
    ...(document.updatedAt !== undefined ? { updatedAt: document.updatedAt } : {}),
    ...(document.closedAt ? { closedAt: document.closedAt } : {}),
    ...(document.closedReason ? { closedReason: document.closedReason } : {}),
    ...(document.tags ? { tags: [...document.tags] } : {}),
    ...(document.contactPhone ? { contactPhone: document.contactPhone } : {}),
    location: normalizeRuntimeLocation(document.location),
    schedule,
    roleCatalog: document.roleCatalog.map((role) => ({
      role: role.role,
      ...(role.customRole ? { customRole: role.customRole } : {}),
      ...(role.salary ? { salary: { ...role.salary } } : {}),
    })),
    compensation: {
      mode: document.compensation.mode,
      ...(document.compensation.defaultSalary
        ? { defaultSalary: { ...document.compensation.defaultSalary } }
        : {}),
      ...(document.compensation.allowances
        ? { allowances: { ...document.compensation.allowances } }
        : {}),
      ...(document.compensation.taxSettings
        ? {
            taxSettings: {
              ...document.compensation.taxSettings,
              ...(document.compensation.taxSettings.taxableItems
                ? { taxableItems: { ...document.compensation.taxSettings.taxableItems } }
                : {}),
            },
          }
        : {}),
    },
    questions: {
      items: document.questions.items.map((item) => ({
        ...item,
        ...(item.options ? { options: [...item.options] } : {}),
      })),
    },
    ...(postingType === 'fixed' && document.fixedConfig
      ? {
          fixedConfig: {
            ...document.fixedConfig,
            durationDays: FIXED_POSTING_DURATION_DAYS,
          },
        }
      : {}),
    ...(postingType === 'tournament' && document.tournamentConfig
      ? {
          tournamentConfig: {
            ...document.tournamentConfig,
          },
        }
      : {}),
    ...(postingType === 'urgent' && document.urgentConfig
      ? {
          urgentConfig: {
            ...document.urgentConfig,
          },
        }
      : {}),
  };
}

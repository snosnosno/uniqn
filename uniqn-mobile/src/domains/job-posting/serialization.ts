import { Timestamp } from 'firebase/firestore';
import type {
  CreateJobPostingInput,
  JobPosting,
  JobPostingDocumentV3,
  JobPostingStatus,
  PostingCompensation,
  PostingDateRequirement,
  PostingFixedSchedule,
  PostingRoleCatalogEntry,
  PostingSchedule,
  UpdateJobPostingInput,
} from '@/types/jobPosting';
import { JOB_POSTING_SCHEMA_VERSION } from '@/types/jobPosting';

interface SerializeJobPostingV3Options {
  ownerId: string;
  ownerName?: string;
  status?: JobPostingStatus;
  current?: Partial<JobPosting>;
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
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
  const district =
    normalizeOptionalText(input.location?.district) ??
    normalizeOptionalText(input.location?.address);
  const detailedAddress = normalizeOptionalText(input.location?.detailedAddress);

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

  return {
    totalPositions,
    filledPositions,
    workDate: schedule.primaryDate,
    workDates: schedule.allDates.length > 0 ? schedule.allDates : undefined,
  };
}

export function serializeJobPostingV3(
  input: CreateJobPostingInput,
  options: SerializeJobPostingV3Options
): JobPostingDocumentV3 {
  const current = options.current;
  const roleCatalog = normalizeRoleCatalog(input.roleCatalog);
  const schedule = normalizeSchedule(input.schedule);
  const compensation = normalizeCompensation(input.compensation);
  const totals = calculateTotalsFromSchedule(schedule);

  return {
    id: current?.id || '',
    schemaVersion: JOB_POSTING_SCHEMA_VERSION,
    title: input.title.trim(),
    ...(input.description !== undefined ? { description: input.description } : {}),
    status: options.status || current?.status || 'active',
    ownerId: options.ownerId,
    ownerName: options.ownerName ?? current?.ownerName,
    postingType: input.postingType ?? current?.postingType ?? 'regular',
    workDate: totals.workDate,
    ...(totals.workDates ? { workDates: totals.workDates } : {}),
    roleKeys: getRoleKeysFromCatalog(roleCatalog),
    totalPositions: totals.totalPositions,
    filledPositions: current?.filledPositions ?? totals.filledPositions,
    viewCount: current?.viewCount ?? 0,
    applicationCount: current?.applicationCount ?? 0,
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
    ...(current?.fixedConfig ? { fixedConfig: current.fixedConfig } : {}),
    ...(current?.tournamentConfig ? { tournamentConfig: current.tournamentConfig } : {}),
    ...(input.postingType === 'urgent'
      ? {
          urgentConfig: current?.urgentConfig || {
            createdAt: Timestamp.now(),
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
    location: posting.location,
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
  return document;
}

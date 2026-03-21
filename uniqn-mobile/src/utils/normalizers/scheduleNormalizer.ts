import type { JobPosting } from '@/types';
import type {
  PostingDateRequirement,
  PostingFixedRoleRequirement,
  PostingFixedSchedule,
  PostingTimeSlot,
} from '@/types/jobPosting';
import {
  type RoleInfo,
  type TimeSlotInfo,
  type DatedScheduleInfo,
  type FixedScheduleInfo,
  type NormalizedScheduleList,
  createTimeSlotInfo,
  createDatedSchedule,
  createFixedSchedule,
} from '@/types/unified';
import {
  normalizeFormRoleRequirement,
  normalizeJobRoles,
  normalizeRoleWithCount,
} from './roleNormalizer';

function normalizeTimeSlot(slot: PostingTimeSlot, index: number): TimeSlotInfo {
  const roles: RoleInfo[] = slot.roles.map((role) =>
    normalizeFormRoleRequirement({
      role: role.role,
      customRole: role.customRole,
      headcount: role.count,
      filled: role.filled ?? 0,
    })
  );

  return createTimeSlotInfo(slot.id ?? `slot-${index}`, slot.startTime ?? null, roles, {
    isTimeToBeAnnounced: slot.isTimeToBeAnnounced,
    tentativeDescription: slot.tentativeDescription,
  });
}

function normalizeDateRequirement(requirement: PostingDateRequirement): DatedScheduleInfo {
  return createDatedSchedule(
    requirement.date,
    requirement.timeSlots.map((slot, index) => normalizeTimeSlot(slot, index))
  );
}

function normalizeFixedRole(role: PostingFixedRoleRequirement): RoleInfo {
  return normalizeRoleWithCount({
    role: role.role ?? 'dealer',
    name: role.customRole,
    count: role.count,
    filled: role.filled ?? 0,
  });
}

function normalizeFixedSchedule(schedule: PostingFixedSchedule): FixedScheduleInfo {
  return createFixedSchedule(
    schedule.daysPerWeek ?? 0,
    (schedule.roleRequirements ?? []).map(normalizeFixedRole),
    {
      startTime: schedule.startTime ?? null,
      isStartTimeNegotiable: schedule.isStartTimeNegotiable,
    }
  );
}

function normalizeLegacySchedule(job: JobPosting): DatedScheduleInfo {
  const roles = normalizeJobRoles(job);
  const timeSlot = createTimeSlotInfo('legacy-slot', null, roles);
  return createDatedSchedule(job.workDate, [timeSlot]);
}

function sortDatedSchedules(schedules: DatedScheduleInfo[]): DatedScheduleInfo[] {
  const today = new Date().toISOString().split('T')[0] ?? '';

  return [...schedules].sort((a, b) => {
    const aIsFuture = a.date >= today;
    const bIsFuture = b.date >= today;

    if (aIsFuture && !bIsFuture) return -1;
    if (!aIsFuture && bIsFuture) return 1;
    if (aIsFuture && bIsFuture) return a.date.localeCompare(b.date);

    return b.date.localeCompare(a.date);
  });
}

export function normalizeJobSchedule(job: JobPosting): NormalizedScheduleList {
  if (job.schedule.kind === 'fixed') {
    return {
      type: 'fixed',
      items: [normalizeFixedSchedule(job.schedule)],
    };
  }

  if (job.schedule.requirements.length > 0) {
    return {
      type: 'dated',
      items: sortDatedSchedules(job.schedule.requirements.map(normalizeDateRequirement)),
    };
  }

  if (job.workDate) {
    return {
      type: 'dated',
      items: [normalizeLegacySchedule(job)],
    };
  }

  return {
    type: 'dated',
    items: [],
  };
}

export function isFixedJobPosting(job: JobPosting): boolean {
  return job.schedule.kind === 'fixed';
}

export function hasDatedRequirements(job: JobPosting): boolean {
  return job.schedule.kind === 'dated' && job.schedule.requirements.length > 0;
}

export function isLegacyJobPosting(job: JobPosting): boolean {
  return (
    job.schedule.kind === 'dated' && job.schedule.requirements.length === 0 && Boolean(job.workDate)
  );
}

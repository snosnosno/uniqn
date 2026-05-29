import type { JobPosting } from '@/types';
import type {
  PostingDateRequirement,
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
      // SP3: schedule role.filled(dead counter) 제거 — 충원은 표시 시점 hydrate 가 덮어씀
      filled: 0,
    })
  );

  return createTimeSlotInfo(slot.id ?? `slot-${index}`, slot.startTime ?? null, roles, {
    isTimeToBeAnnounced: slot.isTimeToBeAnnounced,
    tentativeDescription: slot.tentativeDescription,
  });
}

function normalizeDateRequirement(requirement: PostingDateRequirement): DatedScheduleInfo {
  return createDatedSchedule(
    // kind !== 'dated' 가드를 통과한 dated requirement만 도달 — date는 항상 string, null 런타임 미발생
    requirement.date ?? '',
    requirement.timeSlots.map((slot, index) => normalizeTimeSlot(slot, index))
  );
}

function normalizeFixedSchedule(schedule: PostingFixedSchedule): FixedScheduleInfo {
  // SP1 불변식: fixed schedule은 requirements 1개 · timeSlots 1개 (zod superRefine 강제)
  const roles = schedule.requirements[0]?.timeSlots[0]?.roles ?? [];
  return createFixedSchedule(
    schedule.daysPerWeek ?? 0,
    roles.map((role) =>
      normalizeRoleWithCount({
        role: role.role ?? 'dealer',
        name: role.customRole,
        count: role.count,
        // SP3: schedule role.filled(dead counter) 제거 — 충원은 표시 시점 hydrate 가 덮어씀
        filled: 0,
      })
    ),
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
      kind: 'fixed',
      items: [normalizeFixedSchedule(job.schedule)],
    };
  }

  if (job.schedule.requirements.length > 0) {
    return {
      kind: 'dated',
      items: sortDatedSchedules(job.schedule.requirements.map(normalizeDateRequirement)),
    };
  }

  if (job.workDate) {
    return {
      kind: 'dated',
      items: [normalizeLegacySchedule(job)],
    };
  }

  return {
    kind: 'dated',
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

import type { JobPosting } from '@/types';
import { TBA_TIME_MARKER } from '@/types';
import type { PostingSlotRoleRequirement, PostingTimeSlot } from '@/types/jobPosting';

export interface EventQRScope {
  key: string;
  date: string;
  assignmentGroupId: string | null;
  timeSlot: string | null;
  timeLabel: string;
  roleSummary: string;
}

export interface PreferredEventQRScopeInput {
  eventDate?: string;
  assignmentGroupId?: string | null;
  timeSlot?: string | null;
}

function sortScopeSlots(left: PostingTimeSlot, right: PostingTimeSlot): number {
  if (left.isTimeToBeAnnounced && !right.isTimeToBeAnnounced) {
    return 1;
  }

  if (!left.isTimeToBeAnnounced && right.isTimeToBeAnnounced) {
    return -1;
  }

  const leftTime = left.startTime ?? '99:99';
  const rightTime = right.startTime ?? '99:99';

  return leftTime.localeCompare(rightTime);
}

function getRoleSummary(roles: PostingSlotRoleRequirement[]): string {
  const labels = Array.from(
    new Set(
      roles
        .map((role) => role.customRole ?? role.role ?? '')
        .filter((label): label is string => typeof label === 'string' && label.trim().length > 0)
    )
  );

  return labels.length > 0 ? labels.join(', ') : 'Staff';
}

function getScopeTimeSlot(slot: PostingTimeSlot): string | null {
  if (slot.isTimeToBeAnnounced) {
    return TBA_TIME_MARKER;
  }

  return slot.startTime?.trim() || null;
}

function getScopeTimeLabel(slot: PostingTimeSlot): string {
  if (slot.isTimeToBeAnnounced) {
    return slot.tentativeDescription ? `TBD (${slot.tentativeDescription})` : 'TBD';
  }

  return slot.startTime?.trim() || 'TBD';
}

export function buildEventQRScopes(jobPosting: JobPosting | null | undefined): EventQRScope[] {
  if (!jobPosting || jobPosting.schedule.kind !== 'dated') {
    return [];
  }

  return [...jobPosting.schedule.requirements]
    .sort((left, right) => left.date.localeCompare(right.date))
    .flatMap((requirement) =>
      [...requirement.timeSlots].sort(sortScopeSlots).map((slot, index) => {
        const timeSlot = getScopeTimeSlot(slot);

        return {
          key: [requirement.date, slot.id ?? 'scope', timeSlot ?? 'none', index].join('::'),
          date: requirement.date,
          assignmentGroupId: slot.id ?? null,
          timeSlot,
          timeLabel: getScopeTimeLabel(slot),
          roleSummary: getRoleSummary(slot.roles),
        };
      })
    );
}

export function findPreferredEventQRScope(
  scopes: EventQRScope[],
  preferred: PreferredEventQRScopeInput
): EventQRScope | null {
  const hasPreferredFilter =
    preferred.eventDate !== undefined ||
    preferred.assignmentGroupId !== undefined ||
    preferred.timeSlot !== undefined;

  if (!hasPreferredFilter) {
    return null;
  }

  const matches = scopes.filter((scope) => {
    if (preferred.eventDate !== undefined && scope.date !== preferred.eventDate) {
      return false;
    }

    if (
      preferred.assignmentGroupId !== undefined &&
      (scope.assignmentGroupId ?? null) !== (preferred.assignmentGroupId ?? null)
    ) {
      return false;
    }

    if (
      preferred.timeSlot !== undefined &&
      (scope.timeSlot ?? null) !== (preferred.timeSlot ?? null)
    ) {
      return false;
    }

    return true;
  });

  return matches.length === 1 ? matches[0] : null;
}

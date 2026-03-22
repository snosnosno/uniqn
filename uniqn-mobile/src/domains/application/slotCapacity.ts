import type { Assignment, JobPosting } from '@/types';
import { WorkLogCreator } from '@/domains/schedule';

export interface SlotCapacityIssue {
  date: string;
  timeSlot: string;
  roleId: string;
  count: number;
  filled: number;
  requested: number;
  remaining: number;
}

export interface SlotCapacityValidationResult {
  available: boolean;
  issues: SlotCapacityIssue[];
  firstIssue?: SlotCapacityIssue;
}

function getRoleId(role: { role?: string; customRole?: string }): string {
  if (role.role === 'other' && role.customRole) {
    return role.customRole;
  }

  return role.role ?? '';
}

function getCapacityKey(date: string, timeSlot: string, roleId: string): string {
  return `${date}__${timeSlot}__${roleId}`;
}

export function buildPostingSlotCapacityMap(posting: JobPosting): Map<string, SlotCapacityIssue> {
  const capacityMap = new Map<string, SlotCapacityIssue>();

  if (posting.schedule.kind !== 'dated') {
    return capacityMap;
  }

  posting.schedule.requirements.forEach((requirement) => {
    requirement.timeSlots.forEach((slot) => {
      const slotStartTime = WorkLogCreator.extractStartTime(slot.startTime ?? '');

      slot.roles.forEach((role) => {
        const roleId = getRoleId(role);
        if (!roleId) {
          return;
        }

        const key = getCapacityKey(requirement.date, slotStartTime, roleId);
        capacityMap.set(key, {
          date: requirement.date,
          timeSlot: slotStartTime,
          roleId,
          count: role.count,
          filled: role.filled ?? 0,
          requested: 0,
          remaining: Math.max(0, role.count - (role.filled ?? 0)),
        });
      });
    });
  });

  return capacityMap;
}

export function validateAssignmentSlotCapacity(
  posting: JobPosting,
  assignments: Assignment[]
): SlotCapacityValidationResult {
  if (posting.schedule.kind !== 'dated') {
    return {
      available: false,
      issues: [
        {
          date: '',
          timeSlot: '',
          roleId: '',
          count: 0,
          filled: 0,
          requested: 0,
          remaining: 0,
        },
      ],
    };
  }

  const capacityMap = buildPostingSlotCapacityMap(posting);
  const issues: SlotCapacityIssue[] = [];
  const requestedByKey = new Map<string, number>();

  assignments.forEach((assignment) => {
    const slotStartTime = WorkLogCreator.extractStartTime(assignment.timeSlot);

    assignment.roleIds.forEach((roleId) => {
      assignment.dates.forEach((date) => {
        const key = getCapacityKey(date, slotStartTime, roleId);
        requestedByKey.set(key, (requestedByKey.get(key) ?? 0) + 1);
      });
    });
  });

  requestedByKey.forEach((requested, key) => {
    const capacity = capacityMap.get(key);

    if (!capacity) {
      const [date, timeSlot, roleId] = key.split('__');
      issues.push({
        date,
        timeSlot,
        roleId,
        count: 0,
        filled: 0,
        requested,
        remaining: 0,
      });
      return;
    }

    const remaining = Math.max(0, capacity.count - capacity.filled);
    if (requested > remaining) {
      issues.push({
        ...capacity,
        requested,
        remaining,
      });
    }
  });

  return {
    available: issues.length === 0,
    issues,
    firstIssue: issues[0],
  };
}

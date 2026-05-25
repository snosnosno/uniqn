import type { Assignment, JobPosting } from '@/types';
import { FIXED_DATE_MARKER, FIXED_TIME_MARKER, TBA_TIME_MARKER } from '@/types/assignment';
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

  if (posting.schedule.kind !== 'dated' && posting.schedule.kind !== 'fixed') {
    return capacityMap;
  }

  (posting.schedule.requirements ?? []).forEach((requirement) => {
    // fixed 스케줄의 requirement.date는 null — FIXED_DATE_MARKER로 정규화하여
    // assignment 측 dates:['FIXED_SCHEDULE']과 키가 일치하도록 한다.
    const effectiveDate = requirement.date ?? FIXED_DATE_MARKER;

    requirement.timeSlots.forEach((slot) => {
      // AssignmentSelector.getSlotSelectionTime / buildCanonicalFixedAssignment 와 동일한 해석을 사용해야 한다.
      // 시간 미정(isTimeToBeAnnounced) 슬롯은 startTime 이 없으므로 TBA_TIME_MARKER 로 키를 만든다.
      // (이 줄이 startTime 만 보면 요청측 키 `date__미정__role` 과 영원히 불일치 → 빈자리도 마감 처리됨)
      // fixed 공고가 시간 협의(startTime 없음 + not TBA)이면 assignment 측은 timeSlot=FIXED_TIME_MARKER 를 쓰므로,
      // capacity 키도 FIXED_TIME_MARKER 로 맞춰야 한다. (그냥 '' 면 'NEGOTIABLE' 과 불일치 → 항상 마감 회귀)
      const slotSelectionTime = slot.isTimeToBeAnnounced
        ? TBA_TIME_MARKER
        : slot.startTime || (posting.schedule.kind === 'fixed' ? FIXED_TIME_MARKER : '');
      const slotStartTime = WorkLogCreator.extractStartTime(slotSelectionTime);

      slot.roles.forEach((role) => {
        const roleId = getRoleId(role);
        if (!roleId) {
          return;
        }

        const key = getCapacityKey(effectiveDate, slotStartTime, roleId);
        capacityMap.set(key, {
          date: effectiveDate,
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
  if (posting.schedule.kind !== 'dated' && posting.schedule.kind !== 'fixed') {
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

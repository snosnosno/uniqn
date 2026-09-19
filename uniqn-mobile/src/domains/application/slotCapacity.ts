import type { Assignment, JobPosting } from '@/types';
import { FIXED_DATE_MARKER } from '@/types/assignment';
import { timeSlotKey, UNKNOWN_TIME_KEY } from '@/domains/schedule';

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

/**
 * 공고가 제공하는 (날짜·슬롯·역할) 조합과 각 정원.
 *
 * ⚠️ `filled` 은 항상 0 이다 — 역할별 충원 카운터가 SP3 에서 제거됐고 클라이언트는 실확정 수를
 * 모른다. 따라서 이 맵으로 만드는 판정은 사실상 **"고른 조합이 공고에 존재하는가"**이지 정원
 * 검사가 아니다. 실제 overfill 차단은 서버 `confirm_application`(H1)이 권위를 갖는다.
 */
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
      // 🔑 공고 측 키와 요청 측 키(:114)는 **같은 함수**(`timeSlotKey`)를 통과해야 한다.
      //    예전엔 양쪽이 각자 폴백을 골랐다 — TBA 는 '미정', fixed 협의는 'NEGOTIABLE', dated 는 ''.
      //    폴백이 셋으로 갈린 탓에 한쪽만 손대면 "빈자리인데 항상 마감" 회귀가 났다(과거 주석이 그 사고 기록).
      //    `timeSlotKey` 는 서버 `_posting_slot_key` 와 동치라 센티널 4종을 전부 '미정' 으로 접는다 —
      //    폴백을 고를 일 자체가 없어지고, 레거시 'NEGOTIABLE' 배정도 같은 키로 만난다.
      const slotStartTime = slot.isTimeToBeAnnounced
        ? UNKNOWN_TIME_KEY
        : timeSlotKey(slot.startTime);

      slot.roles.forEach((role) => {
        const roleId = getRoleId(role);
        if (!roleId) {
          return;
        }

        const key = getCapacityKey(effectiveDate, slotStartTime, roleId);
        // SP3: 클라이언트 capacity 맵은 정원(count)만 담는다. schedule role.filled(dead counter)는 제거됨.
        // overfill/충원 강제는 서버측(SP2 H1 정원 가드)이 권위 — 클라이언트는 capacity 만 검증.
        capacityMap.set(key, {
          date: effectiveDate,
          timeSlot: slotStartTime,
          roleId,
          count: role.count,
          filled: 0,
          requested: 0,
          remaining: role.count,
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
    // 공고 측(:58)과 같은 함수를 쓴다 — 레거시 'NEGOTIABLE' 배정도 '미정' 키로 접혀 매칭된다.
    const slotStartTime = timeSlotKey(assignment.timeSlot);

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

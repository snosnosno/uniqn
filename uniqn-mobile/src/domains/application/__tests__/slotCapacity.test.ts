import type { Assignment, JobPosting } from '@/types';
import { TBA_TIME_MARKER } from '@/types/assignment';
import { validateAssignmentSlotCapacity } from '../slotCapacity';

/**
 * 회귀 테스트 — 시간 미정(TBA) 슬롯 capacity 키 불일치
 *
 * 버그(2026-05-20): 시간 미정 dated 공고는 빈자리가 있어도 지원이 100% 차단되었다.
 * 원인은 buildPostingSlotCapacityMap이 isTimeToBeAnnounced를 무시하고 `slot.startTime ?? ''`만
 * 써서 capacity 키가 `date____role`인 반면, AssignmentSelector는 TBA 슬롯에 TBA_TIME_MARKER('미정')를
 * 넣어 요청 키가 `date__미정__role`이 되어 영원히 매칭되지 않았던 것.
 */

function makeDatedPosting(timeSlot: {
  startTime?: string;
  isTimeToBeAnnounced?: boolean;
  roleCount: number;
  filled: number;
}): JobPosting {
  return {
    schedule: {
      kind: 'dated',
      primaryDate: '2026-05-23',
      allDates: ['2026-05-23'],
      requirements: [
        {
          date: '2026-05-23',
          isGrouped: false,
          timeSlots: [
            {
              id: 'slot-1',
              ...(timeSlot.startTime ? { startTime: timeSlot.startTime } : {}),
              ...(timeSlot.isTimeToBeAnnounced ? { isTimeToBeAnnounced: true } : {}),
              roles: [{ role: 'dealer', count: timeSlot.roleCount, filled: timeSlot.filled }],
            },
          ],
        },
      ],
    },
  } as unknown as JobPosting;
}

function makeAssignment(timeSlot: string): Assignment {
  return {
    roleIds: ['dealer'],
    timeSlot,
    dates: ['2026-05-23'],
    isGrouped: false,
    checkMethod: 'individual',
  } as Assignment;
}

describe('validateAssignmentSlotCapacity — TBA(시간 미정) 슬롯', () => {
  it('빈자리(0/1)가 있는 시간 미정 슬롯은 지원 가능해야 한다 (회귀)', () => {
    const posting = makeDatedPosting({ isTimeToBeAnnounced: true, roleCount: 1, filled: 0 });
    const result = validateAssignmentSlotCapacity(posting, [makeAssignment(TBA_TIME_MARKER)]);

    expect(result.available).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('정원이 찬 시간 미정 슬롯(1/1)은 지원 불가여야 한다', () => {
    const posting = makeDatedPosting({ isTimeToBeAnnounced: true, roleCount: 1, filled: 1 });
    const result = validateAssignmentSlotCapacity(posting, [makeAssignment(TBA_TIME_MARKER)]);

    expect(result.available).toBe(false);
    expect(result.firstIssue?.remaining).toBe(0);
  });

  it('시간이 확정된 슬롯(09:00)은 종전대로 정상 매칭된다', () => {
    const posting = makeDatedPosting({ startTime: '09:00', roleCount: 1, filled: 0 });
    const result = validateAssignmentSlotCapacity(posting, [makeAssignment('09:00')]);

    expect(result.available).toBe(true);
  });
});

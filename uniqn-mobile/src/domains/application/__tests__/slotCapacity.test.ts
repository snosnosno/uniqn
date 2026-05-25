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

// SP3: schedule role.filled(dead counter) 제거 — 클라이언트 capacity 맵은 정원(count)만 담는다.
// 따라서 "정원이 찬 슬롯" 차단은 요청 수(requested)가 count 를 초과할 때만 발생한다.
// 사전 충원 기반 마감/overfill 강제는 서버측(SP2 H1 정원 가드)이 권위.
function makeDatedPosting(timeSlot: {
  startTime?: string;
  isTimeToBeAnnounced?: boolean;
  roleCount: number;
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
              roles: [{ role: 'dealer', count: timeSlot.roleCount }],
            },
          ],
        },
      ],
    },
  } as unknown as JobPosting;
}

function makeAssignment(timeSlot: string, persons = 1): Assignment {
  return {
    // 동일 슬롯에 persons 명 요청 = roleIds 에 dealer 를 persons 번 (요청 카운트 누적)
    roleIds: Array.from({ length: persons }, () => 'dealer'),
    timeSlot,
    dates: ['2026-05-23'],
    isGrouped: false,
    checkMethod: 'individual',
  } as Assignment;
}

describe('validateAssignmentSlotCapacity — TBA(시간 미정) 슬롯', () => {
  it('빈자리(정원 1)가 있는 시간 미정 슬롯은 지원 가능해야 한다 (회귀)', () => {
    const posting = makeDatedPosting({ isTimeToBeAnnounced: true, roleCount: 1 });
    const result = validateAssignmentSlotCapacity(posting, [makeAssignment(TBA_TIME_MARKER)]);

    expect(result.available).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('정원(1)을 초과 요청(2명)하는 시간 미정 슬롯은 지원 불가여야 한다', () => {
    const posting = makeDatedPosting({ isTimeToBeAnnounced: true, roleCount: 1 });
    const result = validateAssignmentSlotCapacity(posting, [makeAssignment(TBA_TIME_MARKER, 2)]);

    expect(result.available).toBe(false);
    expect(result.firstIssue?.remaining).toBe(1);
  });

  it('시간이 확정된 슬롯(09:00)은 종전대로 정상 매칭된다', () => {
    const posting = makeDatedPosting({ startTime: '09:00', roleCount: 1 });
    const result = validateAssignmentSlotCapacity(posting, [makeAssignment('09:00')]);

    expect(result.available).toBe(true);
  });
});

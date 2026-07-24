import { areTimeSlotsStructureEqual } from '@/utils/assignment/selectionUtils';
import type { TimeSlotInfo } from '@/types/unified';

const slot = (requiredCount: number): TimeSlotInfo =>
  ({
    startTime: '18:00',
    roles: [{ roleId: 'dealer', displayName: '딜러', requiredCount, filledCount: 0 }],
  }) as TimeSlotInfo;

describe('그룹 경계 통일 — headcount 반영', () => {
  it('역할이 같아도 인원이 다르면 다른 구조다 (카드 그룹핑 areRolesEqual과 동일 기준)', () => {
    expect(areTimeSlotsStructureEqual([slot(5)], [slot(3)])).toBe(false); // 현행 true라 RED
  });

  it('역할·인원 모두 같으면 같은 구조다 (회귀)', () => {
    expect(areTimeSlotsStructureEqual([slot(5)], [slot(5)])).toBe(true);
  });
});

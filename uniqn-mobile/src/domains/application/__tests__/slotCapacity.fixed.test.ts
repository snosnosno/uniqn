/**
 * Task 7 — slotCapacity fixed 분기 제거 회귀 테스트
 *
 * 버그 방지 목적:
 * validateAssignmentSlotCapacity/buildPostingSlotCapacityMap에 `kind !== 'dated'` 조기 반환
 * 가드가 있으면 fixed 공고가 항상 available:false(마감)로 처리됨.
 * 가드를 fixed 포함으로 완화하고, 합성 슬롯의 date:null→FIXED_DATE_MARKER 정규화로
 * capacity 키와 assignment 키(dates:['FIXED_SCHEDULE'])가 일치해야 한다.
 */

import { validateAssignmentSlotCapacity } from '@/domains/application/slotCapacity';
import { FIXED_DATE_MARKER, FIXED_TIME_MARKER } from '@/types/assignment';
import type { Assignment, JobPosting } from '@/types';

function fixedPosting(filled: number): JobPosting {
  return {
    id: 'job-fixed',
    schemaVersion: 3,
    title: 'Fixed',
    status: 'active',
    ownerId: 'owner-1',
    postingType: 'fixed',
    workDate: '',
    totalPositions: 3,
    filledPositions: filled,
    location: { name: 'Seoul' },
    schedule: {
      kind: 'fixed',
      startTime: FIXED_TIME_MARKER,
      requirements: [
        {
          date: null,
          timeSlots: [
            {
              startTime: FIXED_TIME_MARKER,
              isTimeToBeAnnounced: false,
              roles: [{ role: 'dealer', count: 3, filled }],
            },
          ],
        },
      ],
    },
    roleCatalog: [{ role: 'dealer' }],
    compensation: { mode: 'shared' },
    questions: { items: [] },
  } as unknown as JobPosting;
}

// buildCanonicalFixedAssignment와 동일한 형태:
// dates: [FIXED_DATE_MARKER='FIXED_SCHEDULE'], timeSlot: startTime ?? FIXED_TIME_MARKER
const dealerAssignment: Assignment = {
  dates: [FIXED_DATE_MARKER],
  timeSlot: FIXED_TIME_MARKER,
  roleIds: ['dealer'],
  isGrouped: false,
  checkMethod: 'individual',
} as unknown as Assignment;

describe('validateAssignmentSlotCapacity fixed (통일 구조)', () => {
  it('빈자리가 있는 fixed 역할은 지원 가능해야 한다 (회귀 — kind!==dated 가드 완화)', () => {
    const result = validateAssignmentSlotCapacity(fixedPosting(0), [dealerAssignment]);
    expect(result.available).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('정원이 찬 fixed 역할은 지원 불가여야 한다', () => {
    const result = validateAssignmentSlotCapacity(fixedPosting(3), [dealerAssignment]);
    expect(result.available).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});

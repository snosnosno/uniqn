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

// SP3: schedule role.filled(dead counter) 제거 — 클라이언트 capacity 맵은 정원(count)만 담는다.
// 따라서 "정원이 찬" 차단은 요청 수(requested)가 count 를 초과할 때만 발생한다.
// 사전 충원 기반 마감/overfill 강제는 서버측(SP2 H1 정원 가드)이 권위.
function fixedPosting(): JobPosting {
  return {
    id: 'job-fixed',
    schemaVersion: 3,
    title: 'Fixed',
    status: 'active',
    ownerId: 'owner-1',
    postingType: 'fixed',
    workDate: '',
    totalPositions: 3,
    filledPositions: 0,
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
              roles: [{ role: 'dealer', count: 3 }],
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

// 정원(3) 초과 요청 = roleIds 에 dealer 를 4번 (요청 카운트 누적)
const overCapacityAssignment: Assignment = {
  dates: [FIXED_DATE_MARKER],
  timeSlot: FIXED_TIME_MARKER,
  roleIds: ['dealer', 'dealer', 'dealer', 'dealer'],
  isGrouped: false,
  checkMethod: 'individual',
} as unknown as Assignment;

// 시간 협의(negotiable) fixed 공고: 실제 직렬화는 schedule.startTime이 없어
// 합성 슬롯에 startTime 키 자체가 생략된다(FIXED_TIME_MARKER 문자열이 박히지 않음).
// buildCanonicalFixedAssignment는 이때 timeSlot=FIXED_TIME_MARKER를 쓰므로,
// capacity 측이 startTime 부재를 ''로 처리하면 'NEGOTIABLE'과 불일치 → 항상 마감.
function negotiableFixedPosting(): JobPosting {
  return {
    id: 'job-fixed-negotiable',
    schemaVersion: 3,
    title: 'Fixed negotiable',
    status: 'active',
    ownerId: 'owner-1',
    postingType: 'fixed',
    workDate: '',
    totalPositions: 3,
    filledPositions: 0,
    location: { name: 'Seoul' },
    schedule: {
      kind: 'fixed',
      // startTime 없음 — 시간 협의 공고
      requirements: [
        {
          date: null,
          timeSlots: [
            {
              // startTime 키 없음 (직렬화가 생략)
              isTimeToBeAnnounced: false,
              roles: [{ role: 'dealer', count: 3 }],
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

describe('validateAssignmentSlotCapacity fixed (통일 구조)', () => {
  it('빈자리가 있는 fixed 역할은 지원 가능해야 한다 (회귀 — kind!==dated 가드 완화)', () => {
    const result = validateAssignmentSlotCapacity(fixedPosting(), [dealerAssignment]);
    expect(result.available).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('정원(3)을 초과 요청(4명)하는 fixed 역할은 지원 불가여야 한다', () => {
    const result = validateAssignmentSlotCapacity(fixedPosting(), [overCapacityAssignment]);
    expect(result.available).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('시간 협의(startTime 없는) fixed 공고도 빈자리면 지원 가능해야 한다 (회귀 — FIXED_TIME_MARKER 키 정합)', () => {
    const result = validateAssignmentSlotCapacity(negotiableFixedPosting(), [dealerAssignment]);
    expect(result.available).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('시간 협의 fixed 공고가 정원(3)을 초과 요청(4명)하면 지원 불가여야 한다', () => {
    const result = validateAssignmentSlotCapacity(negotiableFixedPosting(), [
      overCapacityAssignment,
    ]);
    expect(result.available).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});

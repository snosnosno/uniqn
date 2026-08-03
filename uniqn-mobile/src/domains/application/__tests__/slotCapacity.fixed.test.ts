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
import { FIXED_DATE_MARKER, FIXED_TIME_MARKER, TBA_TIME_MARKER } from '@/types/assignment';
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

// 🔴 [R1] 이 픽스처의 timeSlot 은 **레거시** 값(`'NEGOTIABLE'`)이다.
// buildCanonicalFixedAssignment 는 이제 `'미정'`(TBA_TIME_MARKER)을 쓴다 — 그런데도 이 픽스처를
// 남겨 둔 이유는, 전환기에 **옛 값을 담은 기존 지원서·MMKV 오프라인 캐시가 그대로 흘러들어오기**
// 때문이다. 옛 값과 새 값이 **둘 다** 같은 슬롯으로 접혀야 "빈자리인데 항상 마감"이 안 생긴다.
// 새 값 쪽 가드는 아래 `dealerAssignmentTBD` 가 맡는다.
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

// [R1] 신규 쓰기 규약 값 — buildCanonicalFixedAssignment 가 실제로 만드는 형태.
const dealerAssignmentTBD: Assignment = {
  dates: [FIXED_DATE_MARKER],
  timeSlot: TBA_TIME_MARKER,
  roleIds: ['dealer'],
  isGrouped: false,
  checkMethod: 'individual',
} as unknown as Assignment;

// 시간 협의(negotiable) fixed 공고: 실제 직렬화는 schedule.startTime이 없어
// 합성 슬롯에 startTime 키 자체가 생략된다.
// capacity 측이 startTime 부재를 각자 폴백('' 또는 'NEGOTIABLE')으로 메우면 요청 키와 갈려
// 항상 마감이 된다 — 그래서 양측 모두 `timeSlotKey`(서버 _posting_slot_key 동치)를 통과시킨다.
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

  // 🔴 [R1] 전환기 이중 관용 가드 — 옛 값과 새 값이 **같은 슬롯**으로 접혀야 한다.
  //    한쪽만 접히면 "빈자리인데 마감" 또는 "정원 초과가 통과" 중 하나가 조용히 생긴다.
  it.each([
    ['레거시 NEGOTIABLE', dealerAssignment],
    ['신규 미정', dealerAssignmentTBD],
  ])('시간 협의 fixed 공고는 %s 배정도 같은 슬롯으로 접어 지원 가능하다', (_label, assignment) => {
    const result = validateAssignmentSlotCapacity(negotiableFixedPosting(), [assignment]);
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

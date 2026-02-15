/**
 * selectionUtils 테스트
 *
 * @description AssignmentSelector 컴포넌트에서 분리된 순수 함수 테스트
 * - makeSelectionKey: 키 생성 (selectionCore 위임)
 * - areTimeSlotsStructureEqual: 시간대 구조 비교
 * - createGroupFromSchedules: 스케줄 그룹 생성
 * - groupDatedSchedules: 스케줄 그룹화 로직
 */

import type { TimeSlotInfo, DatedScheduleInfo } from '@/types/unified';
import type { DateSpecificRequirement } from '@/types/jobPosting/dateRequirement';
import type { RoleInfo } from '@/types/unified/role';
import {
  makeSelectionKey,
  areTimeSlotsStructureEqual,
  createGroupFromSchedules,
  groupDatedSchedules,
} from '@/utils/assignment/selectionUtils';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * RoleInfo 테스트 헬퍼
 */
function createTestRole(roleId: string, requiredCount = 1, filledCount = 0): RoleInfo {
  return {
    roleId,
    displayName: roleId,
    requiredCount,
    filledCount,
  };
}

/**
 * TimeSlotInfo 테스트 헬퍼
 */
function createTestTimeSlot(
  id: string,
  startTime: string | null,
  roleIds: string[],
  options?: { isTimeToBeAnnounced?: boolean }
): TimeSlotInfo {
  return {
    id,
    startTime,
    isTimeToBeAnnounced: options?.isTimeToBeAnnounced ?? false,
    roles: roleIds.map((rid) => createTestRole(rid)),
  };
}

/**
 * DatedScheduleInfo 테스트 헬퍼
 */
function createTestSchedule(date: string, timeSlots: TimeSlotInfo[]): DatedScheduleInfo {
  return {
    type: 'dated',
    date,
    timeSlots,
  };
}

// ============================================================================
// makeSelectionKey
// ============================================================================

describe('makeSelectionKey', () => {
  it('기본 구분자(|)로 키를 생성한다', () => {
    const key = makeSelectionKey('2024-01-17', '09:00', 'dealer');
    expect(key).toBe('2024-01-17|09:00|dealer');
  });

  it('selectionCore의 makeSelectionKey에 위임한다', () => {
    // selectionUtils의 makeSelectionKey는 항상 | 구분자를 사용
    const key = makeSelectionKey('2024-01-17', '09:00', 'floor');
    expect(key).toBe('2024-01-17|09:00|floor');
  });

  it('빈 문자열 입력도 처리한다', () => {
    const key = makeSelectionKey('', '', '');
    expect(key).toBe('||');
  });
});

// ============================================================================
// areTimeSlotsStructureEqual
// ============================================================================

describe('areTimeSlotsStructureEqual', () => {
  it('동일한 시간대 구조이면 true', () => {
    const slots1: TimeSlotInfo[] = [createTestTimeSlot('s1', '09:00', ['dealer', 'floor'])];
    const slots2: TimeSlotInfo[] = [createTestTimeSlot('s2', '09:00', ['dealer', 'floor'])];

    expect(areTimeSlotsStructureEqual(slots1, slots2)).toBe(true);
  });

  it('시간대 수가 다르면 false', () => {
    const slots1: TimeSlotInfo[] = [createTestTimeSlot('s1', '09:00', ['dealer'])];
    const slots2: TimeSlotInfo[] = [
      createTestTimeSlot('s2', '09:00', ['dealer']),
      createTestTimeSlot('s3', '14:00', ['floor']),
    ];

    expect(areTimeSlotsStructureEqual(slots1, slots2)).toBe(false);
  });

  it('시작 시간이 다르면 false', () => {
    const slots1: TimeSlotInfo[] = [createTestTimeSlot('s1', '09:00', ['dealer'])];
    const slots2: TimeSlotInfo[] = [createTestTimeSlot('s2', '14:00', ['dealer'])];

    expect(areTimeSlotsStructureEqual(slots1, slots2)).toBe(false);
  });

  it('역할 ID가 다르면 false', () => {
    const slots1: TimeSlotInfo[] = [createTestTimeSlot('s1', '09:00', ['dealer'])];
    const slots2: TimeSlotInfo[] = [createTestTimeSlot('s2', '09:00', ['floor'])];

    expect(areTimeSlotsStructureEqual(slots1, slots2)).toBe(false);
  });

  it('역할 수가 다르면 false', () => {
    const slots1: TimeSlotInfo[] = [createTestTimeSlot('s1', '09:00', ['dealer'])];
    const slots2: TimeSlotInfo[] = [createTestTimeSlot('s2', '09:00', ['dealer', 'floor'])];

    expect(areTimeSlotsStructureEqual(slots1, slots2)).toBe(false);
  });

  it('순서가 다르지만 구조가 동일하면 true (시작시간 기준 정렬)', () => {
    const slots1: TimeSlotInfo[] = [
      createTestTimeSlot('s1', '14:00', ['floor']),
      createTestTimeSlot('s2', '09:00', ['dealer']),
    ];
    const slots2: TimeSlotInfo[] = [
      createTestTimeSlot('s3', '09:00', ['dealer']),
      createTestTimeSlot('s4', '14:00', ['floor']),
    ];

    expect(areTimeSlotsStructureEqual(slots1, slots2)).toBe(true);
  });

  it('역할 ID 순서가 다르지만 동일한 역할이면 true', () => {
    const slots1: TimeSlotInfo[] = [
      {
        id: 's1',
        startTime: '09:00',
        isTimeToBeAnnounced: false,
        roles: [createTestRole('floor'), createTestRole('dealer')],
      },
    ];
    const slots2: TimeSlotInfo[] = [
      {
        id: 's2',
        startTime: '09:00',
        isTimeToBeAnnounced: false,
        roles: [createTestRole('dealer'), createTestRole('floor')],
      },
    ];

    expect(areTimeSlotsStructureEqual(slots1, slots2)).toBe(true);
  });

  it('빈 배열끼리 비교하면 true', () => {
    expect(areTimeSlotsStructureEqual([], [])).toBe(true);
  });

  it('isTimeToBeAnnounced가 다르면 false', () => {
    const slots1: TimeSlotInfo[] = [
      createTestTimeSlot('s1', null, ['dealer'], { isTimeToBeAnnounced: true }),
    ];
    const slots2: TimeSlotInfo[] = [
      createTestTimeSlot('s2', '09:00', ['dealer'], { isTimeToBeAnnounced: false }),
    ];

    expect(areTimeSlotsStructureEqual(slots1, slots2)).toBe(false);
  });

  it('둘 다 isTimeToBeAnnounced=true이고 역할이 같으면 true', () => {
    const slots1: TimeSlotInfo[] = [
      createTestTimeSlot('s1', null, ['dealer'], { isTimeToBeAnnounced: true }),
    ];
    const slots2: TimeSlotInfo[] = [
      createTestTimeSlot('s2', null, ['dealer'], { isTimeToBeAnnounced: true }),
    ];

    expect(areTimeSlotsStructureEqual(slots1, slots2)).toBe(true);
  });

  it('ID가 다르더라도 구조가 동일하면 true (id는 비교 대상 아님)', () => {
    const slots1: TimeSlotInfo[] = [createTestTimeSlot('id-aaa', '09:00', ['dealer'])];
    const slots2: TimeSlotInfo[] = [createTestTimeSlot('id-bbb', '09:00', ['dealer'])];

    expect(areTimeSlotsStructureEqual(slots1, slots2)).toBe(true);
  });

  it('null startTime과 빈 문자열은 구조가 다르다', () => {
    const slots1: TimeSlotInfo[] = [
      { id: 's1', startTime: null, isTimeToBeAnnounced: true, roles: [createTestRole('dealer')] },
    ];
    const slots2: TimeSlotInfo[] = [
      { id: 's2', startTime: '', isTimeToBeAnnounced: false, roles: [createTestRole('dealer')] },
    ];

    // isTimeToBeAnnounced가 다르므로 false
    expect(areTimeSlotsStructureEqual(slots1, slots2)).toBe(false);
  });
});

// ============================================================================
// createGroupFromSchedules
// ============================================================================

describe('createGroupFromSchedules', () => {
  it('단일 스케줄에서 그룹을 생성한다', () => {
    const timeSlots = [createTestTimeSlot('s1', '09:00', ['dealer'])];
    const schedules: DatedScheduleInfo[] = [createTestSchedule('2024-01-17', timeSlots)];

    const group = createGroupFromSchedules(schedules);

    expect(group.id).toBe('2024-01-17-2024-01-17');
    expect(group.startDate).toBe('2024-01-17');
    expect(group.endDate).toBe('2024-01-17');
    expect(group.dates).toEqual(schedules);
    expect(group.timeSlots).toEqual(timeSlots);
  });

  it('여러 날짜 스케줄에서 그룹을 생성한다', () => {
    const timeSlots = [createTestTimeSlot('s1', '09:00', ['dealer'])];
    const schedules: DatedScheduleInfo[] = [
      createTestSchedule('2024-01-17', timeSlots),
      createTestSchedule('2024-01-18', timeSlots),
      createTestSchedule('2024-01-19', timeSlots),
    ];

    const group = createGroupFromSchedules(schedules);

    expect(group.id).toBe('2024-01-17-2024-01-19');
    expect(group.startDate).toBe('2024-01-17');
    expect(group.endDate).toBe('2024-01-19');
    expect(group.dates).toHaveLength(3);
  });

  it('정렬되지 않은 날짜도 올바른 startDate/endDate를 생성한다', () => {
    const timeSlots = [createTestTimeSlot('s1', '09:00', ['dealer'])];
    const schedules: DatedScheduleInfo[] = [
      createTestSchedule('2024-01-19', timeSlots),
      createTestSchedule('2024-01-17', timeSlots),
      createTestSchedule('2024-01-18', timeSlots),
    ];

    const group = createGroupFromSchedules(schedules);

    expect(group.startDate).toBe('2024-01-17');
    expect(group.endDate).toBe('2024-01-19');
  });

  it('timeSlots는 첫 번째 스케줄 기준으로 설정된다', () => {
    const timeSlotsA = [createTestTimeSlot('s1', '09:00', ['dealer'])];
    const timeSlotsB = [createTestTimeSlot('s2', '14:00', ['floor'])];
    const schedules: DatedScheduleInfo[] = [
      createTestSchedule('2024-01-17', timeSlotsA),
      createTestSchedule('2024-01-18', timeSlotsB),
    ];

    const group = createGroupFromSchedules(schedules);

    // schedules[0]의 timeSlots를 사용 (정렬 후 첫 번째)
    expect(group.timeSlots).toEqual(timeSlotsA);
  });

  it('label에는 formatDateRangeWithCount 결과가 들어간다', () => {
    const timeSlots = [createTestTimeSlot('s1', '09:00', ['dealer'])];
    const schedules: DatedScheduleInfo[] = [
      createTestSchedule('2024-01-17', timeSlots),
      createTestSchedule('2024-01-18', timeSlots),
    ];

    const group = createGroupFromSchedules(schedules);

    // formatDateRangeWithCount는 날짜 범위 + 일수를 포맷
    // 정확한 포맷은 locale에 따라 다를 수 있으므로 존재 여부만 확인
    expect(group.label).toBeDefined();
    expect(typeof group.label).toBe('string');
    expect(group.label.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// groupDatedSchedules
// ============================================================================

describe('groupDatedSchedules', () => {
  const sameTimeSlots = [createTestTimeSlot('s1', '09:00', ['dealer'])];

  describe('빈 입력 처리', () => {
    it('빈 배열이면 빈 배열 반환', () => {
      const result = groupDatedSchedules([], undefined, 'tournament');
      expect(result).toEqual([]);
    });
  });

  describe('비대회 공고 (regular, urgent, fixed)', () => {
    it('regular 공고는 개별 날짜를 각각 그룹으로 반환한다', () => {
      const schedules: DatedScheduleInfo[] = [
        createTestSchedule('2024-01-17', sameTimeSlots),
        createTestSchedule('2024-01-18', sameTimeSlots),
      ];

      const result = groupDatedSchedules(schedules, undefined, 'regular');

      expect(result).toHaveLength(2);
      expect(result[0]!.id).toBe('2024-01-17');
      expect(result[0]!.startDate).toBe('2024-01-17');
      expect(result[0]!.endDate).toBe('2024-01-17');
      expect(result[0]!.dates).toHaveLength(1);
      expect(result[1]!.id).toBe('2024-01-18');
    });

    it('urgent 공고도 개별 날짜로 분리된다', () => {
      const schedules: DatedScheduleInfo[] = [createTestSchedule('2024-01-17', sameTimeSlots)];

      const result = groupDatedSchedules(schedules, undefined, 'urgent');

      expect(result).toHaveLength(1);
      expect(result[0]!.startDate).toBe('2024-01-17');
      expect(result[0]!.endDate).toBe('2024-01-17');
    });

    it('postingType이 undefined이면 개별 날짜로 분리된다', () => {
      const schedules: DatedScheduleInfo[] = [
        createTestSchedule('2024-01-17', sameTimeSlots),
        createTestSchedule('2024-01-18', sameTimeSlots),
      ];

      const result = groupDatedSchedules(schedules, undefined, undefined);

      expect(result).toHaveLength(2);
    });

    it('개별 그룹의 label은 formatDateDisplay 결과이다', () => {
      const schedules: DatedScheduleInfo[] = [createTestSchedule('2024-01-17', sameTimeSlots)];

      const result = groupDatedSchedules(schedules, undefined, 'regular');

      expect(result[0]!.label).toBeDefined();
      expect(typeof result[0]!.label).toBe('string');
    });
  });

  describe('대회 공고 (tournament) - 그룹화 로직', () => {
    it('연속 날짜 + 동일 구조 + isGrouped=true이면 하나로 그룹화', () => {
      const schedules: DatedScheduleInfo[] = [
        createTestSchedule('2024-01-17', sameTimeSlots),
        createTestSchedule('2024-01-18', sameTimeSlots),
        createTestSchedule('2024-01-19', sameTimeSlots),
      ];
      const dateReqs: DateSpecificRequirement[] = [
        { date: '2024-01-17', timeSlots: [], isGrouped: true },
        { date: '2024-01-18', timeSlots: [], isGrouped: true },
        { date: '2024-01-19', timeSlots: [], isGrouped: true },
      ];

      const result = groupDatedSchedules(schedules, dateReqs, 'tournament');

      expect(result).toHaveLength(1);
      expect(result[0]!.startDate).toBe('2024-01-17');
      expect(result[0]!.endDate).toBe('2024-01-19');
      expect(result[0]!.dates).toHaveLength(3);
    });

    it('날짜가 연속이 아니면 별도 그룹', () => {
      const schedules: DatedScheduleInfo[] = [
        createTestSchedule('2024-01-17', sameTimeSlots),
        createTestSchedule('2024-01-19', sameTimeSlots), // 1일 건너뜀
      ];
      const dateReqs: DateSpecificRequirement[] = [
        { date: '2024-01-17', timeSlots: [], isGrouped: true },
        { date: '2024-01-19', timeSlots: [], isGrouped: true },
      ];

      const result = groupDatedSchedules(schedules, dateReqs, 'tournament');

      expect(result).toHaveLength(2);
      expect(result[0]!.startDate).toBe('2024-01-17');
      expect(result[1]!.startDate).toBe('2024-01-19');
    });

    it('timeSlots 구조가 다르면 별도 그룹', () => {
      const timeSlotsA = [createTestTimeSlot('s1', '09:00', ['dealer'])];
      const timeSlotsB = [createTestTimeSlot('s2', '14:00', ['floor'])];
      const schedules: DatedScheduleInfo[] = [
        createTestSchedule('2024-01-17', timeSlotsA),
        createTestSchedule('2024-01-18', timeSlotsB),
      ];
      const dateReqs: DateSpecificRequirement[] = [
        { date: '2024-01-17', timeSlots: [], isGrouped: true },
        { date: '2024-01-18', timeSlots: [], isGrouped: true },
      ];

      const result = groupDatedSchedules(schedules, dateReqs, 'tournament');

      expect(result).toHaveLength(2);
    });

    it('isGrouped가 false이면 그룹화하지 않음', () => {
      const schedules: DatedScheduleInfo[] = [
        createTestSchedule('2024-01-17', sameTimeSlots),
        createTestSchedule('2024-01-18', sameTimeSlots),
      ];
      const dateReqs: DateSpecificRequirement[] = [
        { date: '2024-01-17', timeSlots: [], isGrouped: false },
        { date: '2024-01-18', timeSlots: [], isGrouped: false },
      ];

      const result = groupDatedSchedules(schedules, dateReqs, 'tournament');

      expect(result).toHaveLength(2);
    });

    it('isGrouped가 undefined이면 그룹화하지 않음', () => {
      const schedules: DatedScheduleInfo[] = [
        createTestSchedule('2024-01-17', sameTimeSlots),
        createTestSchedule('2024-01-18', sameTimeSlots),
      ];
      const dateReqs: DateSpecificRequirement[] = [
        { date: '2024-01-17', timeSlots: [] },
        { date: '2024-01-18', timeSlots: [] },
      ];

      const result = groupDatedSchedules(schedules, dateReqs, 'tournament');

      expect(result).toHaveLength(2);
    });

    it('하나만 isGrouped=true이면 그룹화하지 않음 (bothGrouped 조건)', () => {
      const schedules: DatedScheduleInfo[] = [
        createTestSchedule('2024-01-17', sameTimeSlots),
        createTestSchedule('2024-01-18', sameTimeSlots),
      ];
      const dateReqs: DateSpecificRequirement[] = [
        { date: '2024-01-17', timeSlots: [], isGrouped: true },
        { date: '2024-01-18', timeSlots: [], isGrouped: false },
      ];

      const result = groupDatedSchedules(schedules, dateReqs, 'tournament');

      expect(result).toHaveLength(2);
    });

    it('dateRequirements가 undefined이면 모두 개별 그룹', () => {
      const schedules: DatedScheduleInfo[] = [
        createTestSchedule('2024-01-17', sameTimeSlots),
        createTestSchedule('2024-01-18', sameTimeSlots),
      ];

      const result = groupDatedSchedules(schedules, undefined, 'tournament');

      // dateRequirements?.find returns undefined -> bothGrouped = false
      expect(result).toHaveLength(2);
    });

    it('정렬되지 않은 스케줄도 날짜 기준으로 정렬 후 그룹화', () => {
      const schedules: DatedScheduleInfo[] = [
        createTestSchedule('2024-01-19', sameTimeSlots),
        createTestSchedule('2024-01-17', sameTimeSlots),
        createTestSchedule('2024-01-18', sameTimeSlots),
      ];
      const dateReqs: DateSpecificRequirement[] = [
        { date: '2024-01-17', timeSlots: [], isGrouped: true },
        { date: '2024-01-18', timeSlots: [], isGrouped: true },
        { date: '2024-01-19', timeSlots: [], isGrouped: true },
      ];

      const result = groupDatedSchedules(schedules, dateReqs, 'tournament');

      expect(result).toHaveLength(1);
      expect(result[0]!.startDate).toBe('2024-01-17');
      expect(result[0]!.endDate).toBe('2024-01-19');
    });

    it('중간에 그룹이 끊기는 복합 시나리오', () => {
      const timeSlotsA = [createTestTimeSlot('s1', '09:00', ['dealer'])];
      const timeSlotsB = [createTestTimeSlot('s2', '14:00', ['floor'])];
      const schedules: DatedScheduleInfo[] = [
        createTestSchedule('2024-01-17', timeSlotsA),
        createTestSchedule('2024-01-18', timeSlotsA),
        createTestSchedule('2024-01-19', timeSlotsB), // 구조 변경 -> 새 그룹
        createTestSchedule('2024-01-20', timeSlotsB),
      ];
      const dateReqs: DateSpecificRequirement[] = [
        { date: '2024-01-17', timeSlots: [], isGrouped: true },
        { date: '2024-01-18', timeSlots: [], isGrouped: true },
        { date: '2024-01-19', timeSlots: [], isGrouped: true },
        { date: '2024-01-20', timeSlots: [], isGrouped: true },
      ];

      const result = groupDatedSchedules(schedules, dateReqs, 'tournament');

      expect(result).toHaveLength(2);
      expect(result[0]!.startDate).toBe('2024-01-17');
      expect(result[0]!.endDate).toBe('2024-01-18');
      expect(result[1]!.startDate).toBe('2024-01-19');
      expect(result[1]!.endDate).toBe('2024-01-20');
    });

    it('단일 스케줄이면 단일 그룹', () => {
      const schedules: DatedScheduleInfo[] = [createTestSchedule('2024-01-17', sameTimeSlots)];
      const dateReqs: DateSpecificRequirement[] = [
        { date: '2024-01-17', timeSlots: [], isGrouped: true },
      ];

      const result = groupDatedSchedules(schedules, dateReqs, 'tournament');

      expect(result).toHaveLength(1);
      expect(result[0]!.startDate).toBe('2024-01-17');
      expect(result[0]!.endDate).toBe('2024-01-17');
    });
  });
});

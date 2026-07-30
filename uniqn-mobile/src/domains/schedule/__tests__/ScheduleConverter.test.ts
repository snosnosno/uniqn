import {
  ScheduleConverter,
  createSchedulePostingContext,
  createScheduleContainerContext,
} from '../ScheduleConverter';
import type { Application, JobPosting, WorkLog } from '@/types';
import type { VenueContainer } from '@/domains/workSchedule';

function createPosting(): JobPosting {
  return {
    id: 'job-1',
    schemaVersion: 3,
    title: '포커 이벤트',
    ownerId: 'owner-1',
    ownerName: '고용주',
    workDate: '2025-01-15',
    workDates: ['2025-01-15'],
    roleKeys: ['dealer', 'floor'],
    totalPositions: 2,
    filledPositions: 0,
    status: 'active',
    location: {
      name: 'Seoul',
      address: 'Gangnam-daero',
      detailedAddress: '101',
    },
    contactPhone: '01012345678',
    schedule: {
      kind: 'dated',
      primaryDate: '2025-01-15',
      allDates: ['2025-01-15'],
      requirements: [
        {
          date: '2025-01-15',
          timeSlots: [
            {
              id: 'slot-1',
              startTime: '09:00',
              roles: [
                { id: 'dealer-role', role: 'dealer', count: 1 },
                { id: 'floor-role', role: 'floor', count: 1 },
              ],
            },
          ],
        },
      ],
    },
    roleCatalog: [
      { role: 'dealer', salary: { type: 'hourly', amount: 13000 } },
      { role: 'floor', salary: { type: 'daily', amount: 90000 } },
    ],
    compensation: {
      mode: 'by_role',
      defaultSalary: { type: 'hourly', amount: 10000 },
      allowances: { meal: 5000 },
      taxSettings: { type: 'rate', value: 3.3 },
    },
    questions: {
      items: [],
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function createWorkLog(overrides: Partial<WorkLog> = {}): WorkLog {
  return {
    id: 'wl-1',
    staffId: 'staff-1',
    jobPostingId: 'job-1',
    date: '2025-01-15',
    status: 'scheduled',
    role: 'floor',
    timeSlot: '09:00~18:00',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createApplication(overrides: Partial<Application> = {}): Application {
  return {
    id: 'app-1',
    applicantId: 'staff-1',
    applicantName: 'Tester',
    jobPostingId: 'job-1',
    jobPostingTitle: 'Poker Event',
    status: 'confirmed',
    assignments: [
      {
        roleIds: ['dealer'],
        timeSlot: '09:00~18:00',
        dates: ['2025-01-15'],
        isGrouped: false,
        groupId: 'slot-1',
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('ScheduleConverter.parseTimeSlotToTimestamp', () => {
  it('parses valid time slots through the shared date utility path', () => {
    const timestamp = ScheduleConverter.parseTimeSlotToTimestamp(
      '09:00~18:00',
      '2025-01-15',
      'start'
    );

    expect(timestamp).not.toBeNull();
    expect(timestamp?.getFullYear()).toBe(2025);
    expect(timestamp?.getMonth()).toBe(0);
    expect(timestamp?.getDate()).toBe(15);
    expect(timestamp?.getHours()).toBe(9);
  });

  it('returns null for invalid date input', () => {
    expect(
      ScheduleConverter.parseTimeSlotToTimestamp('09:00~18:00', 'invalid-date', 'start')
    ).toBeNull();
    expect(
      ScheduleConverter.parseTimeSlotToTimestamp('09:00~18:00', '2025-02-30', 'start')
    ).toBeNull();
  });
});

describe('ScheduleConverter.workLogToScheduleEvent', () => {
  it('attaches only the minimal posting projection and keeps canonical settlement data', () => {
    const postingContext = createSchedulePostingContext(createPosting());
    const event = ScheduleConverter.workLogToScheduleEvent(createWorkLog(), postingContext);

    expect(event.postingProjection).toEqual({
      ownerName: '고용주',
      description: undefined,
      settlement: expect.objectContaining({
        defaultSalary: { type: 'hourly', amount: 10000 },
        allowances: { meal: 5000 },
        taxSettings: { type: 'rate', value: 3.3 },
      }),
    });
    expect((event as unknown as Record<string, unknown>).jobPostingCard).toBeUndefined();
    expect(event.detailedAddress).toBe('101');
  });

  it('calculates role-specific settlement from canonical role catalog instead of a card view-model', () => {
    const postingContext = createSchedulePostingContext(createPosting());
    const event = ScheduleConverter.workLogToScheduleEvent(
      createWorkLog({
        checkInTime: '2025-01-15T09:00:00.000Z',
        checkOutTime: '2025-01-15T18:00:00.000Z',
      }),
      postingContext
    );

    expect(event.settlementBreakdown?.salaryInfo).toEqual({
      type: 'daily',
      amount: 90000,
    });
  });

  it('keeps fixed worklog markers out of the UI schedule event while preserving the fixed flag', () => {
    const postingContext = createSchedulePostingContext(createPosting());
    const event = ScheduleConverter.workLogToScheduleEvent(
      createWorkLog({
        date: '',
        timeSlot: undefined,
        isFixedPosting: true,
      }),
      postingContext
    );

    expect(event.isFixedPosting).toBe(true);
    expect(event.startTime).toBeNull();
    expect(event.endTime).toBeNull();
  });

  it('uses the real applications.id as applicationId (not a synthetic composite key)', () => {
    const postingContext = createSchedulePostingContext(createPosting());
    const event = ScheduleConverter.workLogToScheduleEvent(
      createWorkLog({ applicationId: 'f9960cc9-7cf0-45ce-abe1-1e1b336213f7' }),
      postingContext
    );

    // 취소/상세 조회가 이 값으로 applications.id = eq(...) UUID 조회를 한다.
    // 합성키(`${jobPostingId}_${staffId}`)면 invalid uuid(22P02)로 400이 난다.
    expect(event.applicationId).toBe('f9960cc9-7cf0-45ce-abe1-1e1b336213f7');
  });

  it('leaves applicationId undefined when the workLog has no source application', () => {
    const postingContext = createSchedulePostingContext(createPosting());
    const event = ScheduleConverter.workLogToScheduleEvent(createWorkLog(), postingContext);

    expect(event.applicationId).toBeUndefined();
  });

  it('preserves assignmentGroupId from the canonical workLog contract', () => {
    const postingContext = createSchedulePostingContext(createPosting());
    const event = ScheduleConverter.workLogToScheduleEvent(
      createWorkLog({
        assignmentGroupId: 'slot-1',
      }),
      postingContext
    );

    expect(event.assignmentGroupId).toBe('slot-1');
  });
});

describe('ScheduleConverter.applicationToScheduleEvents', () => {
  it('preserves assignment group identifiers for confirmed schedule entries', () => {
    const postingContext = createSchedulePostingContext(createPosting());
    const events = ScheduleConverter.applicationToScheduleEvents(
      createApplication(),
      postingContext
    );

    expect(events).toHaveLength(1);
    expect(events[0]?.assignmentGroupId).toBe('slot-1');
  });

  it('marks cancellation-pending applications on schedule events', () => {
    const postingContext = createSchedulePostingContext(createPosting());
    const events = ScheduleConverter.applicationToScheduleEvents(
      createApplication({
        status: 'cancellation_pending',
      }),
      postingContext
    );

    expect(events).toHaveLength(1);
    expect(events[0]?.isCancellationPending).toBe(true);
  });
});

describe('createScheduleContainerContext (#6 — 근무표 직접배치 급여 복구)', () => {
  function createContainer(): VenueContainer {
    return {
      id: 'venue-1',
      name: '내 팀',
      workspaceId: 'ws-1',
      ownerId: 'owner-1',
      venueId: 'venue-1',
      kind: 'dated',
      softTargets: {},
      roleSalaries: [{ role: 'dealer', salary: { type: 'hourly', amount: 20000 } }],
      location: null,
      contactPhone: null,
      description: null,
    };
  }

  it('컨테이너 역할별 단가표를 정산 컨텍스트 roles 로 주입한다(count/filled 채움)', () => {
    const container = createContainer();
    const context = createScheduleContainerContext(container.roleSalaries, {
      title: container.name,
    });

    expect(context.title).toBe('내 팀');
    expect(context.settlement.roles).toEqual([
      {
        role: 'dealer',
        customRole: undefined,
        count: 0,
        filled: 0,
        salary: { type: 'hourly', amount: 20000 },
      },
    ]);
  });

  it('title 미지정 시 기본 라벨(이벤트)로 폴백한다', () => {
    const context = createScheduleContainerContext(createContainer().roleSalaries);
    expect(context.title).toBe('이벤트');
  });

  it('설정된 역할의 급여가 기본 단가(15,000원) 폴백이 아니라 지점 단가로 해소된다', () => {
    const context = createScheduleContainerContext(createContainer().roleSalaries);
    const event = ScheduleConverter.workLogToScheduleEvent(
      {
        id: 'wl-1',
        jobPostingId: 'venue-1',
        staffId: 'staff-1',
        date: '2026-07-24',
        role: 'dealer',
        status: 'checked_out',
        checkInTime: '2026-07-24T18:00:00+09:00',
        checkOutTime: '2026-07-25T02:00:00+09:00',
      } as unknown as WorkLog,
      context
    );

    // 8시간 × 20,000원 = 160,000원 (기본단가라면 8 × 15,000 = 120,000원)
    expect(event.settlementBreakdown?.basePay).toBe(160000);
  });

  // S1 — 지점 표시 정보 전달. 매핑 규칙은 일반 공고 경로와 대칭이어야 한다(소비처가 두 경로를
  // 구분하지 않는다). 예전엔 location 이 '' 로 하드코딩돼 상세 모달이 "장소 : -" 를 보여줬다.
  describe('지점 표시 정보 전달(S1)', () => {
    it('컨텍스트의 location/연락처/소개/담당자를 공고 경로와 같은 필드로 투영한다', () => {
      const context = createScheduleContainerContext([], {
        title: '홀덤펍 강남점',
        location: { name: '강남역 2번 출구', district: '강남구', detailedAddress: '3층' },
        contactPhone: '02-123-4567',
        description: '역삼역 도보 2분',
        ownerName: '김사장',
      });

      expect(context.title).toBe('홀덤펍 강남점');
      expect(context.location).toBe('강남역 2번 출구');
      expect(context.locationAddress).toBe('강남구');
      expect(context.detailedAddress).toBe('3층');
      expect(context.contactPhone).toBe('02-123-4567');
      expect(context.description).toBe('역삼역 도보 2분');
      expect(context.ownerName).toBe('김사장');
    });

    it('컨텍스트가 없으면 종전대로 이벤트/빈 장소로 폴백한다(회귀 방어)', () => {
      const context = createScheduleContainerContext([]);
      expect(context.title).toBe('이벤트');
      expect(context.location).toBe('');
      expect(context.contactPhone).toBeUndefined();
      expect(context.locationAddress).toBeUndefined();
    });

    it('location 이 null 이거나 이름이 비면 빈 장소로 둔다', () => {
      expect(createScheduleContainerContext([], { title: '지점', location: null }).location).toBe(
        ''
      );
      expect(
        createScheduleContainerContext([], { location: { district: '강남구' } }).location
      ).toBe('');
    });
  });
});

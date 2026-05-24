import { ScheduleConverter, createSchedulePostingContext } from '../ScheduleConverter';
import type { Application, JobPosting, WorkLog } from '@/types';

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
                { id: 'dealer-role', role: 'dealer', count: 1, filled: 0 },
                { id: 'floor-role', role: 'floor', count: 1, filled: 0 },
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
    createdAt: new Date(),
    updatedAt: new Date(),
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
    createdAt: new Date(),
    updatedAt: new Date(),
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

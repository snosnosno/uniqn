import { STATUS } from '@/constants';
import type { ScheduleEvent } from '@/types';
import { ScheduleMerger } from '../ScheduleMerger';

function createScheduleEvent(overrides: Partial<ScheduleEvent> = {}): ScheduleEvent {
  return {
    id: 'schedule-1',
    type: STATUS.SCHEDULE.CONFIRMED,
    assignmentGroupId: 'slot-1',
    date: '2025-01-15',
    startTime: new Date(),
    endTime: new Date(),
    jobPostingId: 'job-1',
    jobPostingName: 'Poker Event',
    location: 'Seoul',
    role: 'dealer',
    status: STATUS.ATTENDANCE.NOT_STARTED,
    sourceCollection: 'applications',
    sourceId: 'source-1',
    timeSlot: '09:00~18:00',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('ScheduleMerger.merge', () => {
  it('keeps distinct same-day slots when assignmentGroupId or timeSlot differs', () => {
    const workLogSchedules = [
      createScheduleEvent({
        id: 'worklog-slot-a',
        sourceCollection: 'workLogs',
        sourceId: 'wl-1',
        workLogId: 'wl-1',
        assignmentGroupId: 'slot-a',
        timeSlot: '09:00~18:00',
      }),
    ];
    const applicationSchedules = [
      createScheduleEvent({
        id: 'application-slot-b',
        sourceId: 'app-1',
        applicationId: 'app-1',
        assignmentGroupId: 'slot-b',
        timeSlot: '18:00~22:00',
      }),
    ];

    const merged = ScheduleMerger.merge(workLogSchedules, applicationSchedules);

    expect(merged).toHaveLength(2);
    expect(merged.map((event) => event.assignmentGroupId)).toEqual(['slot-a', 'slot-b']);
  });

  it('prefers workLogs for the same assignment even when role metadata changes', () => {
    const workLogSchedules = [
      createScheduleEvent({
        id: 'worklog-slot-a',
        sourceCollection: 'workLogs',
        sourceId: 'wl-1',
        workLogId: 'wl-1',
        assignmentGroupId: 'slot-a',
        timeSlot: '09:00~18:00',
        role: 'floor',
      }),
    ];
    const applicationSchedules = [
      createScheduleEvent({
        id: 'application-slot-a',
        sourceId: 'app-1',
        applicationId: 'app-1',
        assignmentGroupId: 'slot-a',
        timeSlot: '09:00~18:00',
        role: 'dealer',
      }),
    ];

    const merged = ScheduleMerger.merge(workLogSchedules, applicationSchedules);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.sourceCollection).toBe('workLogs');
    expect(merged[0]?.role).toBe('floor');
  });

  it('preserves cancellation-pending metadata when workLogs win the merge', () => {
    const workLogSchedules = [
      createScheduleEvent({
        id: 'worklog-slot-a',
        sourceCollection: 'workLogs',
        sourceId: 'wl-1',
        workLogId: 'wl-1',
        assignmentGroupId: 'slot-a',
        timeSlot: '09:00~18:00',
      }),
    ];
    const applicationSchedules = [
      createScheduleEvent({
        id: 'application-slot-a',
        sourceId: 'app-1',
        applicationId: 'app-1',
        assignmentGroupId: 'slot-a',
        timeSlot: '09:00~18:00',
        isCancellationPending: true,
      }),
    ];

    const merged = ScheduleMerger.merge(workLogSchedules, applicationSchedules);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.sourceCollection).toBe('workLogs');
    expect(merged[0]?.isCancellationPending).toBe(true);
    expect(merged[0]?.applicationId).toBe('app-1');
  });

  it('uses role as a fallback identity when assignmentGroupId is missing', () => {
    const workLogSchedules = [
      createScheduleEvent({
        id: 'worklog-dealer',
        sourceCollection: 'workLogs',
        sourceId: 'wl-1',
        workLogId: 'wl-1',
        assignmentGroupId: null,
        timeSlot: '09:00~18:00',
        role: 'dealer',
      }),
    ];
    const applicationSchedules = [
      createScheduleEvent({
        id: 'application-floor',
        sourceId: 'app-1',
        applicationId: 'app-1',
        assignmentGroupId: null,
        timeSlot: '09:00~18:00',
        role: 'floor',
      }),
    ];

    const merged = ScheduleMerger.merge(workLogSchedules, applicationSchedules);

    expect(merged).toHaveLength(2);
    expect(merged.map((event) => event.role)).toEqual(['dealer', 'floor']);
  });
});

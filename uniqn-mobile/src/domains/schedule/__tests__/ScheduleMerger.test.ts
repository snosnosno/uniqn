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

  it('재현: 시각이 바뀌어도 같은 지원서면 병합되고 취소 요청이 얹힌다', () => {
    // 구인자가 슬롯 시각을 09:00 → 14:00 으로 바꾸면 work_logs.time_slot 만 갱신되고
    // applications.assignments[].timeSlot 은 낡은 채 남는다(WorkLogRepositoryVenue.updateSlot).
    const workLogSchedules = [
      createScheduleEvent({
        id: 'worklog-slot-a',
        sourceCollection: 'workLogs',
        sourceId: 'wl-1',
        workLogId: 'wl-1',
        applicationId: 'app-1',
        assignmentGroupId: 'slot-a',
        timeSlot: '14:00',
      }),
    ];
    const applicationSchedules = [
      createScheduleEvent({
        id: 'application-slot-a',
        sourceId: 'app-1',
        applicationId: 'app-1',
        assignmentGroupId: 'slot-a',
        timeSlot: '09:00',
        isCancellationPending: true,
      }),
    ];

    const merged = ScheduleMerger.merge(workLogSchedules, applicationSchedules);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.sourceCollection).toBe('workLogs');
    expect(merged[0]?.isCancellationPending).toBe(true);
  });

  // 🔴 편집은 시각뿐 아니라 **역할도** 함께 바꾼다(updateSlot 이 role 을 UPDATE 한다).
  //    링크 키가 표류하지 않는 축(applicationId·date·assignmentGroupId)만 쓰는 이유다.
  it('시각과 역할이 동시에 바뀌어도 같은 지원서면 병합된다', () => {
    const workLogSchedules = [
      createScheduleEvent({
        id: 'worklog-drifted',
        sourceCollection: 'workLogs',
        sourceId: 'wl-1',
        workLogId: 'wl-1',
        applicationId: 'app-1',
        assignmentGroupId: null,
        role: 'floor',
        timeSlot: '14:00',
      }),
    ];
    const applicationSchedules = [
      createScheduleEvent({
        id: 'application-original',
        sourceId: 'app-1',
        applicationId: 'app-1',
        assignmentGroupId: null,
        role: 'dealer',
        timeSlot: '09:00',
        isCancellationPending: true,
      }),
    ];

    const merged = ScheduleMerger.merge(workLogSchedules, applicationSchedules);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.role).toBe('floor');
    expect(merged[0]?.isCancellationPending).toBe(true);
  });

  // ⚠️ 이건 **가드 테스트가 아니라 특성화(characterization) 테스트**다. 링크 키의 `applicationId`
  //    없음 방어를 제거해도 이 단언은 red 가 되지 않는다(실측 확인) — 지원서 쪽 이벤트는 항상
  //    applicationId 를 갖기 때문에 두 키가 애초에 충돌하지 않는다. 그 방어가 관찰 불가능하다는
  //    사실은 ScheduleMerger.generateApplicationLinkKey 주석에 적어 두었다.
  //    여기서는 "수동 추가(application_id NULL) 행이 남의 지원서와 뭉치지 않는다"는 현재 동작만 못박는다.
  it('applicationId 가 없는 work_log 는 남의 지원서와 뭉치지 않는다', () => {
    const workLogSchedules = [
      createScheduleEvent({
        id: 'worklog-manual',
        sourceCollection: 'workLogs',
        sourceId: 'wl-1',
        workLogId: 'wl-1',
        applicationId: undefined,
        assignmentGroupId: null,
        timeSlot: '14:00',
      }),
    ];
    const applicationSchedules = [
      createScheduleEvent({
        id: 'application-other',
        sourceId: 'app-1',
        applicationId: 'app-1',
        assignmentGroupId: null,
        timeSlot: '09:00',
        isCancellationPending: true,
      }),
    ];

    const merged = ScheduleMerger.merge(workLogSchedules, applicationSchedules);

    expect(merged).toHaveLength(2);
    expect(
      merged.find((event) => event.sourceCollection === 'workLogs')?.isCancellationPending
    ).toBeUndefined();
  });

  // 🔴 아래 3건은 2단계(링크 키) 병합의 **안전 가드**를 지킨다. `work_logs` 에는 PK 외 UNIQUE
  //    제약이 없어 한 지원서가 같은 날 여러 슬롯을 가질 수 있고, 그때 링크 키만으로 단독
  //    병합하면 남의 슬롯과 뭉친다. 모두 groupId 가 없는 경우(=링크 키가 가장 약한 경우)다.
  it('같은 지원서·같은 날의 work_log 가 둘이면(모호) 링크 병합을 하지 않는다', () => {
    const workLogSchedules = [
      createScheduleEvent({
        id: 'worklog-morning',
        sourceCollection: 'workLogs',
        sourceId: 'wl-1',
        workLogId: 'wl-1',
        applicationId: 'app-1',
        assignmentGroupId: null,
        timeSlot: '09:00',
      }),
      createScheduleEvent({
        id: 'worklog-night',
        sourceCollection: 'workLogs',
        sourceId: 'wl-2',
        workLogId: 'wl-2',
        applicationId: 'app-1',
        assignmentGroupId: null,
        timeSlot: '18:00',
      }),
    ];
    const applicationSchedules = [
      createScheduleEvent({
        id: 'application-unknown',
        sourceId: 'app-1',
        applicationId: 'app-1',
        assignmentGroupId: null,
        timeSlot: '12:00',
        isCancellationPending: true,
      }),
    ];

    const merged = ScheduleMerger.merge(workLogSchedules, applicationSchedules);

    expect(merged).toHaveLength(3);
    // 취소 요청은 어느 work_log 에도 얹히지 않는다 — 어느 쪽인지 모르기 때문이다.
    expect(
      merged.filter((event) => event.sourceCollection === 'workLogs' && event.isCancellationPending)
    ).toHaveLength(0);
  });

  it('같은 링크 키의 지원서 일정이 둘이면(모호) 병합하지 않는다', () => {
    const workLogSchedules = [
      createScheduleEvent({
        id: 'worklog-only',
        sourceCollection: 'workLogs',
        sourceId: 'wl-1',
        workLogId: 'wl-1',
        applicationId: 'app-1',
        assignmentGroupId: null,
        timeSlot: '09:00',
      }),
    ];
    // 한 지원서가 같은 날 두 슬롯을 가진 경우 — 링크 키가 같다.
    const applicationSchedules = [
      createScheduleEvent({
        id: 'application-a',
        sourceId: 'app-1',
        applicationId: 'app-1',
        assignmentGroupId: null,
        timeSlot: '10:00',
      }),
      createScheduleEvent({
        id: 'application-b',
        sourceId: 'app-1',
        applicationId: 'app-1',
        assignmentGroupId: null,
        timeSlot: '11:00',
      }),
    ];

    const merged = ScheduleMerger.merge(workLogSchedules, applicationSchedules);

    expect(merged).toHaveLength(3);
  });

  // 이 테스트가 고정하는 것은 **`consumed` 제외**다(단계 순서가 아니다 — 순서를 스왑해도
  // 같은 키의 leftover 가 2개가 되어 count 가드가 먼저 막는다). 엄격 단계에서 이미 짝지어진
  // work_log 를 링크 후보에 남겨 두면, 야간 일정이 오전 work_log 에 얹혀 취소 요청이 오배치된다.
  it('엄격하게 짝지어진 work_log 는 링크 단계의 후보에서 빠진다', () => {
    const workLogSchedules = [
      createScheduleEvent({
        id: 'worklog-morning',
        sourceCollection: 'workLogs',
        sourceId: 'wl-1',
        workLogId: 'wl-1',
        applicationId: 'app-1',
        assignmentGroupId: null,
        timeSlot: '09:00',
      }),
    ];
    const applicationSchedules = [
      createScheduleEvent({
        id: 'application-morning',
        sourceId: 'app-1',
        applicationId: 'app-1',
        assignmentGroupId: null,
        timeSlot: '09:00',
      }),
      createScheduleEvent({
        id: 'application-night',
        sourceId: 'app-1',
        applicationId: 'app-1',
        assignmentGroupId: null,
        timeSlot: '18:00',
        isCancellationPending: true,
      }),
    ];

    const merged = ScheduleMerger.merge(workLogSchedules, applicationSchedules);

    expect(merged).toHaveLength(2);
    // 야간 일정은 오전 work_log 에 얹히지 않고 자기 카드로 남는다.
    expect(
      merged.find((event) => event.sourceCollection === 'workLogs')?.isCancellationPending
    ).toBeUndefined();
  });

  // 2단계를 도입하며 dateRange 적용 지점이 `.filter()` 안에서 바깥으로 옮겨갔다.
  // 링크 키에는 `date` 가 들어 있어 양쪽 날짜가 반드시 같으므로, 창 밖 지원서가 창 안
  // work_log 에 얹히는 누수는 구조적으로 불가능하다 — 그 사실을 단언으로 못박는다.
  it('dateRange 밖의 짝은 링크 병합을 거쳐도 결과에 새지 않는다', () => {
    const workLogSchedules = [
      createScheduleEvent({
        id: 'worklog-out',
        sourceCollection: 'workLogs',
        sourceId: 'wl-out',
        workLogId: 'wl-out',
        applicationId: 'app-out',
        assignmentGroupId: null,
        date: '2025-02-20',
        timeSlot: '14:00',
      }),
    ];
    const applicationSchedules = [
      createScheduleEvent({
        id: 'application-out',
        sourceId: 'app-out',
        applicationId: 'app-out',
        assignmentGroupId: null,
        date: '2025-02-20',
        timeSlot: '09:00',
        isCancellationPending: true,
      }),
    ];

    const merged = ScheduleMerger.merge(workLogSchedules, applicationSchedules, {
      dateRange: { start: '2025-01-01', end: '2025-01-31' },
    });

    expect(merged).toHaveLength(0);
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

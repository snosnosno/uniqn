import { planShiftReminders } from '../shiftReminderPlan';
import type { ScheduleEvent } from '@/types';

const NOW = new Date('2026-07-27T09:00:00');

function shift(overrides: Record<string, unknown> = {}): ScheduleEvent {
  return {
    id: 's1',
    workLogId: 'wl-1',
    type: 'confirmed',
    status: 'not_started',
    date: '2026-07-29',
    startTime: new Date('2026-07-29T18:00:00'),
    jobPostingName: '강남 홀덤펍',
    ...overrides,
  } as unknown as ScheduleEvent;
}

describe('planShiftReminders', () => {
  it('확정 근무에 전날 20시와 출근 2시간 전 두 건을 잡는다', () => {
    const reminders = planShiftReminders([shift()], NOW);

    expect(reminders.map((r) => r.kind)).toEqual(['day-before', 'hours-before']);
    expect(reminders[0].fireAt).toEqual(new Date('2026-07-28T20:00:00'));
    expect(reminders[1].fireAt).toEqual(new Date('2026-07-29T16:00:00'));
  });

  it('확정이 아니면 예약하지 않는다', () => {
    expect(planShiftReminders([shift({ type: 'applied' })], NOW)).toEqual([]);
  });

  it('이미 퇴근한 근무는 예약하지 않는다', () => {
    expect(planShiftReminders([shift({ status: 'checked_out' })], NOW)).toEqual([]);
  });

  // workLogId 가 없으면 예약을 나중에 취소·갱신할 키가 없다.
  it('workLogId가 없으면 예약하지 않는다', () => {
    expect(planShiftReminders([shift({ workLogId: undefined })], NOW)).toEqual([]);
  });

  it('지난 근무는 예약하지 않는다', () => {
    expect(planShiftReminders([shift({ date: '2026-07-20' })], NOW)).toEqual([]);
  });

  // 이미 지난 시각을 예약하면 OS 가 즉시 발사해 버린다.
  it('오늘 근무는 이미 지난 전날 알림을 건너뛰고 남은 것만 잡는다', () => {
    const reminders = planShiftReminders(
      [shift({ date: '2026-07-27', startTime: new Date('2026-07-27T18:00:00') })],
      NOW
    );

    expect(reminders.map((r) => r.kind)).toEqual(['hours-before']);
  });

  it('출근 2시간 전이 이미 지났으면 당일 알림도 건너뛴다', () => {
    const reminders = planShiftReminders(
      [shift({ date: '2026-07-27', startTime: new Date('2026-07-27T10:00:00') })],
      NOW
    );

    expect(reminders).toEqual([]);
  });

  it('시작 시각을 모르면 전날 알림만 잡는다', () => {
    const reminders = planShiftReminders([shift({ startTime: null })], NOW);

    expect(reminders.map((r) => r.kind)).toEqual(['day-before']);
  });

  it('30일보다 먼 근무는 아직 예약하지 않는다', () => {
    expect(
      planShiftReminders(
        [shift({ date: '2026-09-30', startTime: new Date('2026-09-30T18:00:00') })],
        NOW
      )
    ).toEqual([]);
  });

  it('키는 근무·종류마다 안정적이라 재계산해도 같다', () => {
    const first = planShiftReminders([shift()], NOW);
    const second = planShiftReminders([shift()], NOW);

    expect(first.map((r) => r.key)).toEqual(second.map((r) => r.key));
    expect(first.map((r) => r.key)).toEqual(['wl-1:day-before', 'wl-1:hours-before']);
  });

  it('여러 근무를 울릴 시각 순으로 돌려준다', () => {
    const reminders = planShiftReminders(
      [shift({ id: 's2', workLogId: 'wl-2', date: '2026-08-05', startTime: null }), shift()],
      NOW
    );

    const times = reminders.map((r) => r.fireAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });
});

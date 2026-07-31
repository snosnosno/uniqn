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
  it('확정 근무에 전날 20시 한 건만 잡는다', () => {
    const reminders = planShiftReminders([shift()], NOW);

    expect(reminders.map((r) => r.kind)).toEqual(['day-before']);
    expect(reminders[0].fireAt).toEqual(new Date('2026-07-28T20:00:00'));
  });

  // 새벽 근무를 "정확히 24시간 전"으로 바꾸면 전날 새벽에 발사된다. 20시 고정이 그 방어다.
  it('새벽 근무여도 전날 20시에 울린다', () => {
    const reminders = planShiftReminders(
      [shift({ date: '2026-07-29', startTime: new Date('2026-07-29T02:00:00') })],
      NOW
    );

    expect(reminders[0].fireAt).toEqual(new Date('2026-07-28T20:00:00'));
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
  //
  // ⚠️ 전날 20시가 유일한 리마인더이므로 **그 시각을 넘겨 확정된 근무는 전부 0건**이다.
  //    당일 확정만이 아니다 — 전날 22시에 확정된 다음날 오전 근무도 알림을 못 받는다.
  //    예전에는 hours-before 가 이 구간을 덮고 있었고 제거하면서 드러났다.
  //    설계 결정 6(스태프 독촉 금지)을 따른 결과지만, 직전 확정이 잦아지면
  //    '독촉' 이 아닌 '최초 고지' 성격의 폴백 1회를 재검토할 것.
  it('전날 20시를 넘겨 확정된 근무는 예약할 것이 없다', () => {
    const reminders = planShiftReminders(
      [shift({ date: '2026-07-27', startTime: new Date('2026-07-27T18:00:00') })],
      NOW
    );

    expect(reminders).toEqual([]);
  });

  // 출근 시각은 더 이상 계획에 영향을 주지 않는다 — '미정'인 근무도 똑같이 알림을 받는다.
  it('시작 시각을 몰라도 전날 알림을 잡는다', () => {
    const reminders = planShiftReminders([shift({ startTime: null })], NOW);

    expect(reminders.map((r) => r.kind)).toEqual(['day-before']);
    expect(reminders[0].fireAt).toEqual(new Date('2026-07-28T20:00:00'));
  });

  it('30일보다 먼 근무는 아직 예약하지 않는다', () => {
    expect(
      planShiftReminders(
        [shift({ date: '2026-09-30', startTime: new Date('2026-09-30T18:00:00') })],
        NOW
      )
    ).toEqual([]);
  });

  // 키가 흔들리면 MMKV 원장이 stale 로 판정해 매번 취소·재예약이 돈다.
  it('키는 근무마다 안정적이라 재계산해도 같다', () => {
    const first = planShiftReminders([shift()], NOW);
    const second = planShiftReminders([shift()], NOW);

    expect(first.map((r) => r.key)).toEqual(second.map((r) => r.key));
    expect(first.map((r) => r.key)).toEqual(['wl-1:day-before']);
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

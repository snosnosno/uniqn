import { pickNextShift } from '../nextShift';
import type { ScheduleEvent } from '@/types';

const TODAY = '2026-07-27';

/** `startTime` 은 Date 다 — 문자열로 넣으면 정렬이 조용히 깨진다. */
function at(date: string, time: string): Date {
  return new Date(`${date}T${time}:00`);
}

function shift(overrides: Partial<ScheduleEvent> & { id: string }): ScheduleEvent {
  return {
    type: 'confirmed',
    status: 'not_started',
    date: TODAY,
    startTime: at(TODAY, '18:00'),
    ...overrides,
  } as unknown as ScheduleEvent;
}

describe('pickNextShift', () => {
  it('후보가 없으면 null', () => {
    expect(pickNextShift([], TODAY)).toBeNull();
  });

  it('확정 건만 고른다 — 지원 중은 갈지 모르는 일정이라 제외', () => {
    expect(pickNextShift([shift({ id: 'a', type: 'applied' })], TODAY)).toBeNull();
  });

  it('지난 근무는 고르지 않는다', () => {
    expect(pickNextShift([shift({ id: 'a', date: '2026-07-26' })], TODAY)).toBeNull();
  });

  // ScheduleEvent.status 는 AttendanceStatus(not_started|checked_in|checked_out)다.
  // WorkLogStatus('scheduled')로 판정하면 출근 전 근무가 전부 걸러져 히어로가 빈다.
  it('출근 전(not_started) 근무를 고른다', () => {
    expect(pickNextShift([shift({ id: 'pending' })], TODAY)?.id).toBe('pending');
  });

  it('퇴근 완료 건은 건너뛰고 다음 근무를 고른다', () => {
    const result = pickNextShift(
      [
        shift({ id: 'done', status: 'checked_out' }),
        shift({ id: 'next', date: '2026-07-29', startTime: at('2026-07-29', '18:00') }),
      ],
      TODAY
    );

    expect(result?.id).toBe('next');
  });

  it('출근 중인 근무는 계속 다음 근무로 본다', () => {
    expect(pickNextShift([shift({ id: 'working', status: 'checked_in' })], TODAY)?.id).toBe(
      'working'
    );
  });

  it('가장 가까운 날짜를 고르고, 같은 날이면 시작이 이른 쪽을 고른다', () => {
    const result = pickNextShift(
      [
        shift({ id: 'later', date: '2026-07-30', startTime: at('2026-07-30', '09:00') }),
        shift({ id: 'evening', startTime: at(TODAY, '20:00') }),
        shift({ id: 'morning', startTime: at(TODAY, '09:00') }),
      ],
      TODAY
    );

    expect(result?.id).toBe('morning');
  });

  it('오늘 목록과 이번 달 목록이 겹쳐도 중복으로 세지 않는다', () => {
    const same = shift({ id: 'dup', date: '2026-07-28', startTime: at('2026-07-28', '10:00') });

    expect(pickNextShift([same, same], TODAY)?.id).toBe('dup');
  });

  it('시작 시각이 없는 건은 시각이 있는 같은 날 건보다 뒤로 민다', () => {
    const result = pickNextShift(
      [
        shift({ id: 'no-time', startTime: null }),
        shift({ id: 'has-time', startTime: at(TODAY, '22:00') }),
      ],
      TODAY
    );

    expect(result?.id).toBe('has-time');
  });
});

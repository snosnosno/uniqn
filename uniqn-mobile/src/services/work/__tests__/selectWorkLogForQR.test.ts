/**
 * UNIQN Mobile - QR 처리 대상 work_log 자동 선택 테스트
 *
 * @description 고정 QR 은 슬롯을 인코딩하지 않으므로 하루 다중 배정 시
 *   클라이언트가 처리 대상을 자동 결정한다.
 *
 * @remarks `now` 는 반드시 로컬 시각 생성자(`new Date(y, m, d, h, min)`)로 만든다.
 *   구현이 `getHours()`(로컬 시각)를 쓰므로 ISO 오프셋 문자열('...+09:00')로 만들면
 *   CI(ubuntu=UTC)에서 다른 시각으로 읽혀 선택 결과가 뒤바뀐다.
 */
import { selectWorkLogForQR, parseTimeSlotStartMinutes } from '@/services/work/selectWorkLogForQR';
import { WORK_LOG_STATUS_VALUES } from '@/constants/statusValues';
import type { WorkLog } from '@/types';

function makeWorkLog(overrides: Partial<WorkLog> & { id: string }): WorkLog {
  return {
    staffId: 'staff-1',
    jobPostingId: 'posting-1',
    date: '2026-07-20',
    status: WORK_LOG_STATUS_VALUES.SCHEDULED,
    role: 'dealer',
    ...overrides,
  } as WorkLog;
}

describe('parseTimeSlotStartMinutes', () => {
  it('"18:00~02:00" 에서 시작 시각 분(1080)을 뽑는다', () => {
    expect(parseTimeSlotStartMinutes('18:00~02:00')).toBe(18 * 60);
  });

  it('"09:30" 단일 표기도 처리한다', () => {
    expect(parseTimeSlotStartMinutes('09:30')).toBe(9 * 60 + 30);
  });

  it('파싱 불가 값은 null 을 반환한다', () => {
    expect(parseTimeSlotStartMinutes('미정')).toBeNull();
    expect(parseTimeSlotStartMinutes('NEGOTIABLE')).toBeNull();
    expect(parseTimeSlotStartMinutes(undefined)).toBeNull();
  });

  it('시/분 범위를 벗어난 값은 null 을 반환한다', () => {
    expect(parseTimeSlotStartMinutes('25:00')).toBeNull();
    expect(parseTimeSlotStartMinutes('12:75')).toBeNull();
  });
});

describe('selectWorkLogForQR', () => {
  // 로컬 시각 오전 10시 — TZ 무관하게 getHours()=10
  const now = new Date(2026, 6, 20, 10, 0);

  it('후보가 없으면 no_assignment 를 반환한다', () => {
    expect(selectWorkLogForQR([], now)).toEqual({ workLog: null, reason: 'no_assignment' });
  });

  it('후보가 1건이면 그것을 선택한다', () => {
    const wl = makeWorkLog({ id: 'wl-1', timeSlot: '09:00~15:00' });
    expect(selectWorkLogForQR([wl], now)).toEqual({ workLog: wl, reason: null });
  });

  it('checked_in 후보가 있으면 시간대와 무관하게 그것을 우선한다 (퇴근 대상)', () => {
    const scheduled = makeWorkLog({ id: 'wl-scheduled', timeSlot: '10:00~16:00' });
    const checkedIn = makeWorkLog({
      id: 'wl-checked-in',
      timeSlot: '18:00~24:00',
      status: WORK_LOG_STATUS_VALUES.CHECKED_IN,
    });

    const result = selectWorkLogForQR([scheduled, checkedIn], now);

    expect(result.workLog?.id).toBe('wl-checked-in');
  });

  it('checked_in 이 여럿이면 checkInTime 이 가장 이른 건을 고른다', () => {
    const late = makeWorkLog({
      id: 'wl-late',
      status: WORK_LOG_STATUS_VALUES.CHECKED_IN,
      checkInTime: new Date(2026, 6, 20, 9, 30),
    });
    const early = makeWorkLog({
      id: 'wl-early',
      status: WORK_LOG_STATUS_VALUES.CHECKED_IN,
      checkInTime: new Date(2026, 6, 20, 6, 0),
    });

    expect(selectWorkLogForQR([late, early], now).workLog?.id).toBe('wl-early');
  });

  it('scheduled 후보가 여럿이면 현재 시각과 가장 가까운 시작시각을 고른다', () => {
    const morning = makeWorkLog({ id: 'wl-morning', timeSlot: '09:00~15:00' }); // 10:00 기준 60분
    const evening = makeWorkLog({ id: 'wl-evening', timeSlot: '18:00~24:00' }); // 10:00 기준 480분

    const result = selectWorkLogForQR([evening, morning], now);

    expect(result.workLog?.id).toBe('wl-morning');
  });

  it('자정을 넘는 시각도 24시간 순환 거리로 계산한다', () => {
    const lateNight = new Date(2026, 6, 20, 23, 0); // 로컬 23:00
    const nearWrap = makeWorkLog({ id: 'wl-wrap', timeSlot: '02:00~08:00' }); // 순환거리 180분
    const far = makeWorkLog({ id: 'wl-far', timeSlot: '14:00~20:00' }); // 거리 540분

    const result = selectWorkLogForQR([far, nearWrap], lateNight);

    expect(result.workLog?.id).toBe('wl-wrap');
  });

  it('후보가 전부 checked_out 이면 all_checked_out 을 반환한다', () => {
    const done = makeWorkLog({ id: 'wl-done', status: WORK_LOG_STATUS_VALUES.CHECKED_OUT });

    expect(selectWorkLogForQR([done], now)).toEqual({ workLog: null, reason: 'all_checked_out' });
  });

  it('후보가 전부 취소/노쇼면 not_active 를 반환한다', () => {
    const cancelled = makeWorkLog({ id: 'wl-c', status: WORK_LOG_STATUS_VALUES.CANCELLED });
    const noShow = makeWorkLog({ id: 'wl-n', status: WORK_LOG_STATUS_VALUES.NO_SHOW });

    expect(selectWorkLogForQR([cancelled, noShow], now)).toEqual({
      workLog: null,
      reason: 'not_active',
    });
  });

  it('timeSlot 파싱 불가 후보만 있으면 그중 첫 번째를 선택한다', () => {
    const tba = makeWorkLog({ id: 'wl-tba', timeSlot: '미정' });

    expect(selectWorkLogForQR([tba], now).workLog?.id).toBe('wl-tba');
  });

  it('파싱 가능한 후보가 파싱 불가 후보보다 우선한다', () => {
    const tba = makeWorkLog({ id: 'wl-tba', timeSlot: '미정' });
    const parsable = makeWorkLog({ id: 'wl-parsable', timeSlot: '18:00~24:00' });

    // 배열 순서가 뒤바뀌어도 파싱 가능한 쪽이 이긴다
    expect(selectWorkLogForQR([tba, parsable], now).workLog?.id).toBe('wl-parsable');
    expect(selectWorkLogForQR([parsable, tba], now).workLog?.id).toBe('wl-parsable');
  });

  // findQRCandidates 는 .order() 를 걸지 않아 배열 순서가 무보장이다.
  // 같은 후보 집합이면 순서와 무관하게 같은 결과가 나와야 한다.
  it('시작시각이 동률이면 입력 순서와 무관하게 같은 건을 선택한다', () => {
    const a = makeWorkLog({ id: 'wl-a', timeSlot: '09:00~15:00' });
    const b = makeWorkLog({ id: 'wl-b', timeSlot: '11:00~17:00' }); // 10:00 기준 동률(60분)

    expect(selectWorkLogForQR([a, b], now).workLog?.id).toBe('wl-a');
    expect(selectWorkLogForQR([b, a], now).workLog?.id).toBe('wl-a');
  });

  it('timeSlot 파싱 불가 후보가 여럿이어도 입력 순서와 무관하게 같은 건을 선택한다', () => {
    const x = makeWorkLog({ id: 'wl-x', timeSlot: '미정' });
    const y = makeWorkLog({ id: 'wl-y', timeSlot: '협의' });

    expect(selectWorkLogForQR([x, y], now).workLog?.id).toBe('wl-x');
    expect(selectWorkLogForQR([y, x], now).workLog?.id).toBe('wl-x');
  });
});

/**
 * WorkTimeDisplay — 근무시간 표시 SSOT 테스트 (P2-3-lite: isEndNextDay 익일 플래그)
 *
 * 홀덤펍 심야 운영(18:00~익일 02:00)에서 종료 시각이 다음날임을 표시 계층이 알 수 있도록
 * SSOT 가 isEndNextDay 를 노출한다. duration 자정 넘김 계산은 기존 동작 회귀 고정.
 */
import { WorkTimeDisplay } from '../WorkTimeDisplay';

describe('WorkTimeDisplay.getDisplayInfo — isEndNextDay', () => {
  it('자정 넘는 timeSlot(18:00 - 02:00) → isEndNextDay=true, duration 8시간', () => {
    const info = WorkTimeDisplay.getDisplayInfo({
      timeSlot: '18:00 - 02:00',
      date: '2026-07-02',
    });

    expect(info.isEndNextDay).toBe(true);
    expect(info.duration).toBe('8시간');
  });

  it('같은 날 timeSlot(18:00 - 23:00) → isEndNextDay=false', () => {
    const info = WorkTimeDisplay.getDisplayInfo({
      timeSlot: '18:00 - 23:00',
      date: '2026-07-02',
    });

    expect(info.isEndNextDay).toBe(false);
    expect(info.duration).toBe('5시간');
  });

  it('실측 출퇴근이 자정을 넘기면 isEndNextDay=true', () => {
    const info = WorkTimeDisplay.getDisplayInfo({
      checkInTime: new Date(2026, 6, 2, 18, 0, 0),
      checkOutTime: new Date(2026, 6, 3, 2, 0, 0),
    });

    expect(info.isEndNextDay).toBe(true);
    expect(info.isEffectiveEndActual).toBe(true);
  });

  it('시간 정보가 없으면 isEndNextDay=false', () => {
    const info = WorkTimeDisplay.getDisplayInfo({});

    expect(info.isEndNextDay).toBe(false);
    expect(info.effectiveEnd).toBe('미정');
  });
});

describe('WorkTimeDisplay.getDisplayInfo — 출근 예정 단일값(§K 정본) 하위호환', () => {
  /**
   * `time_slot` 정본이 출근 예정 시각 단일값이 되면서, 예정만 있는 근무에는 종료가 없다.
   * **구 빌드도 이 값을 읽는다** — 범위를 기대하던 코드가 단일값을 만나도 깨지지 않고
   * '미정'/'-' 로 물러서야 한다(파싱 실패나 잘못된 숫자가 아니라).
   */
  it("단일값 timeSlot 은 종료를 '미정', 근무시간을 '-' 로 물러선다", () => {
    const info = WorkTimeDisplay.getDisplayInfo({ timeSlot: '19:00', date: '2026-07-02' });

    expect(info.scheduledStart).toBe('19:00');
    expect(info.effectiveStart).toBe('19:00');
    expect(info.effectiveEnd).toBe('미정');
    expect(info.duration).toBe('-');
    expect(info.isEndNextDay).toBe(false);
  });

  it('실제 출근만 찍힌 단일값 근무도 근무시간을 지어내지 않는다', () => {
    const info = WorkTimeDisplay.getDisplayInfo({
      timeSlot: '19:00',
      date: '2026-07-02',
      checkInTime: new Date('2026-07-02T19:04:00'),
    });

    expect(info.isEffectiveStartActual).toBe(true);
    expect(info.effectiveEnd).toBe('미정');
    expect(info.duration).toBe('-');
  });

  it('퇴근이 찍히면 그때 비로소 근무시간이 나온다', () => {
    const info = WorkTimeDisplay.getDisplayInfo({
      timeSlot: '19:00',
      date: '2026-07-02',
      checkInTime: new Date('2026-07-02T19:00:00'),
      checkOutTime: new Date('2026-07-03T02:00:00'),
    });

    expect(info.duration).toBe('7시간');
    expect(info.isEndNextDay).toBe(true);
  });
});

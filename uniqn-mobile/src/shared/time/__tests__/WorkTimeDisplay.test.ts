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

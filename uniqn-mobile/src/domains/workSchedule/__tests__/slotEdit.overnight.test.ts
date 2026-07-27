/**
 * detectSlotConflicts — 자정 포함 구간 겹침 감지 회귀 테스트.
 *
 * 기존 로직(시작시각 동일성만 비교)은 자정을 넘는 실제 겹침을 놓쳤다.
 * 이 테스트는 시작/종료를 분 절대구간으로 환산한 반열림 겹침 판정을 검증한다.
 */
import { detectSlotConflicts } from '../slotEdit';

describe('detectSlotConflicts — 구간 겹침(자정 포함)', () => {
  it('같은 스태프의 자정 넘는 구간이 실제로 겹치면 충돌로 표시한다', () => {
    // 18:00-02:00 [1080,1560) 와 23:00-06:00 [1380,1800) 는 겹침 — 시작시각은 서로 다름
    const target = { workLogId: 'a', staffId: 's1', timeSlot: '18:00 - 02:00' };
    const siblings = [{ workLogId: 'b', staffId: 's1', timeSlot: '23:00 - 06:00' }];
    const conflicts = detectSlotConflicts(target, siblings);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toEqual({ workLogId: 'b', reason: 'overlap' });
  });

  it('겹치지 않는 구간은 충돌 아님', () => {
    // 10:00-14:00 [600,840) 와 18:00-02:00 [1080,1560) 는 겹치지 않음
    const target = { workLogId: 'a', staffId: 's1', timeSlot: '10:00 - 14:00' };
    const siblings = [{ workLogId: 'b', staffId: 's1', timeSlot: '18:00 - 02:00' }];
    expect(detectSlotConflicts(target, siblings)).toHaveLength(0);
  });

  it('같은 스태프의 같은 날 겹침도 시작시각이 달라도 감지한다', () => {
    // 18:00-22:00 [1080,1320) 와 20:00-23:00 [1200,1380) 는 겹침
    const target = { workLogId: 'a', staffId: 's1', timeSlot: '18:00 - 22:00' };
    const siblings = [{ workLogId: 'b', staffId: 's1', timeSlot: '20:00 - 23:00' }];
    expect(detectSlotConflicts(target, siblings)).toHaveLength(1);
  });

  it('경계가 맞닿기만 하는 구간(14:00 종료 vs 14:00 시작)은 겹침 아님(반열림)', () => {
    // 10:00-14:00 [600,840) 와 14:00-18:00 [840,1080) 는 접점만 공유 → 겹침 아님
    const target = { workLogId: 'a', staffId: 's1', timeSlot: '10:00 - 14:00' };
    const siblings = [{ workLogId: 'b', staffId: 's1', timeSlot: '14:00 - 18:00' }];
    expect(detectSlotConflicts(target, siblings)).toHaveLength(0);
  });

  it('다른 스태프의 겹침은 충돌 아님', () => {
    const target = { workLogId: 'a', staffId: 's1', timeSlot: '18:00 - 02:00' };
    const siblings = [{ workLogId: 'b', staffId: 's2', timeSlot: '23:00 - 06:00' }];
    expect(detectSlotConflicts(target, siblings)).toHaveLength(0);
  });
});

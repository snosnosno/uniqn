/**
 * 슬롯 완성 판정 헬퍼 단위 테스트 (리뷰 MEDIUM — 빈 배열 진공참 차단)
 *
 * @description ScheduleSlotsSheet 확인 게이팅과 getRowState('time'/'roles')가 공유하는
 * 단일 소스 헬퍼를 직접 검증한다. 특히 areSlotsComplete([]) 는 Array.every 의 빈 배열
 * 진공참(=true)에 걸리지 않고 false 여야 한다 — 컴포넌트 경유로는 seed 보장(≥1)과
 * removable 게이트 때문에 빈 배열에 도달할 수 없어, 헬퍼 직접 테스트가 유일 검증 경로다.
 */
import { isSlotTimeSet, slotHasRoles, isSlotComplete, areSlotsComplete } from '../orderRowMeta';

const withTime = { startTime: '19:00', roles: [{ role: 'dealer', count: 2 }] };
const tba = { startTime: '', isTimeToBeAnnounced: true, roles: [{ role: 'dealer', count: 1 }] };
const noTime = { startTime: '', roles: [{ role: 'dealer', count: 1 }] };
const noRoles = { startTime: '19:00', roles: [] as { role: string; count: number }[] };

describe('isSlotTimeSet', () => {
  it('유효한 HH:MM 시각이면 set', () => {
    expect(isSlotTimeSet(withTime)).toBe(true);
  });
  it('시간 미정(isTimeToBeAnnounced)이면 set — 유효한 확정값', () => {
    expect(isSlotTimeSet(tba)).toBe(true);
  });
  it('시각도 미정도 없으면 unset', () => {
    expect(isSlotTimeSet(noTime)).toBe(false);
  });
});

describe('slotHasRoles', () => {
  it('역할이 1개 이상이면 true', () => {
    expect(slotHasRoles(withTime)).toBe(true);
  });
  it('역할이 0개면 false', () => {
    expect(slotHasRoles(noRoles)).toBe(false);
  });
});

describe('isSlotComplete', () => {
  it('시간 set + 역할 있음이면 완성', () => {
    expect(isSlotComplete(withTime)).toBe(true);
  });
  it('시간 미정 + 역할 있음도 완성', () => {
    expect(isSlotComplete(tba)).toBe(true);
  });
  it('역할 0개면 미완성 — 급여 데드엔드 방지', () => {
    expect(isSlotComplete(noRoles)).toBe(false);
  });
  it('시간 unset이면 미완성', () => {
    expect(isSlotComplete(noTime)).toBe(false);
  });
});

describe('areSlotsComplete — 빈 배열 진공참 차단', () => {
  it('빈 배열이면 미완성(false) — Array.every 진공참에 걸리지 않는다', () => {
    expect(areSlotsComplete([])).toBe(false);
  });
  it('모든 슬롯이 완성이면 true', () => {
    expect(areSlotsComplete([withTime, tba])).toBe(true);
  });
  it('하나라도 미완성이면 false', () => {
    expect(areSlotsComplete([withTime, noRoles])).toBe(false);
  });
});

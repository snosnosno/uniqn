/**
 * softTargets — 운영처 컨테이너의 날짜별 목표인원(soft-target) 순수 헬퍼
 *
 * 저장소: 컨테이너 schedule.softTargets (requirements 와 분리 — MAX_CAPACITY 가드 회피, §4.4).
 * 날짜 키: YYYY-MM-DD SSOT (toDateString). 부족신호 = softTarget − headcount (0 clamp).
 */

import { getSoftTargets, getSoftTarget, withSoftTarget, computeShortage } from '../softTargets';

describe('softTargets', () => {
  const schedule = {
    kind: 'dated',
    softTargets: { '2026-07-01': 3, '2026-07-02': 5 },
  };

  describe('getSoftTargets', () => {
    it('schedule.softTargets 맵을 반환한다', () => {
      expect(getSoftTargets(schedule)).toEqual({ '2026-07-01': 3, '2026-07-02': 5 });
    });

    it('softTargets 가 없으면 빈 맵을 반환한다', () => {
      expect(getSoftTargets({ kind: 'dated' })).toEqual({});
      expect(getSoftTargets(null)).toEqual({});
      expect(getSoftTargets(undefined)).toEqual({});
    });
  });

  describe('getSoftTarget', () => {
    it('해당 날짜의 목표인원을 반환한다', () => {
      expect(getSoftTarget(schedule, '2026-07-01')).toBe(3);
      expect(getSoftTarget(schedule, '2026-07-02')).toBe(5);
    });

    it('목표가 없는 날짜는 0 을 반환한다', () => {
      expect(getSoftTarget(schedule, '2026-07-09')).toBe(0);
    });

    it('Date 입력을 YYYY-MM-DD 키로 정규화해 조회한다 (E5 날짜 SSOT)', () => {
      expect(getSoftTarget(schedule, new Date('2026-07-01T09:30:00Z'))).toBe(3);
    });
  });

  describe('withSoftTarget (불변)', () => {
    it('목표를 추가해 새 schedule 을 반환하고 원본은 불변', () => {
      const next = withSoftTarget(schedule, '2026-07-03', 4);
      expect(getSoftTarget(next, '2026-07-03')).toBe(4);
      // 원본 불변
      expect(getSoftTarget(schedule, '2026-07-03')).toBe(0);
      expect(next).not.toBe(schedule);
    });

    it('목표 0/음수는 키를 제거한다(부족신호 노이즈 방지)', () => {
      const next = withSoftTarget(schedule, '2026-07-01', 0);
      expect(getSoftTargets(next)).toEqual({ '2026-07-02': 5 });
    });

    it('softTargets 가 없던 schedule 에도 안전하게 추가한다', () => {
      const next = withSoftTarget({ kind: 'dated' }, '2026-07-01', 2);
      expect(getSoftTarget(next, '2026-07-01')).toBe(2);
    });
  });

  describe('computeShortage', () => {
    it('부족 = 목표 − 인원', () => {
      expect(computeShortage(5, 2)).toBe(3);
    });

    it('충족/초과면 0 으로 clamp', () => {
      expect(computeShortage(5, 5)).toBe(0);
      expect(computeShortage(5, 8)).toBe(0);
    });

    it('목표 0 이면 부족 0', () => {
      expect(computeShortage(0, 0)).toBe(0);
    });
  });
});

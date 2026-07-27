/**
 * gridSlotState — 근무표 셀 상태 순수함수(슬롯 상태머신)
 *
 * venue 스팬 read-time COUNT(headcount) + open 공고 수(jobCount) + soft-target 으로
 * 셀 상태/우선순위 뱃지를 도출한다. UI(Phase 2 CalendarCell) 가 이 순수 결과를 소비.
 *
 * U2 뱃지 밀도: 우선순위 압축 1개(부족 > 공고 > 배치).
 * U1 a11y: 부족은 색상 단독이 아니라 숫자/종류로 표현(여기서 종류·수치 산출).
 */

import { computeDayCell } from '../gridSlotState';

describe('computeDayCell', () => {
  it('목표 > 인원: 부족(shortage) 상태 + 부족 수치', () => {
    const cell = computeDayCell({
      dateKey: '2026-07-01',
      headcount: 1,
      jobCount: 0,
      softTarget: 3,
    });
    expect(cell.status).toBe('shortage');
    expect(cell.shortage).toBe(2);
  });

  it('인원 >= 목표(>0): staffed 상태, 부족 0', () => {
    const cell = computeDayCell({
      dateKey: '2026-07-01',
      headcount: 3,
      jobCount: 0,
      softTarget: 3,
    });
    expect(cell.status).toBe('staffed');
    expect(cell.shortage).toBe(0);
  });

  it('목표 0 + 인원 있음: staffed (부족 신호 없음)', () => {
    const cell = computeDayCell({
      dateKey: '2026-07-01',
      headcount: 2,
      jobCount: 0,
      softTarget: 0,
    });
    expect(cell.status).toBe('staffed');
    expect(cell.shortage).toBe(0);
  });

  it('전부 0: empty 상태, 뱃지 없음', () => {
    const cell = computeDayCell({
      dateKey: '2026-07-01',
      headcount: 0,
      jobCount: 0,
      softTarget: 0,
    });
    expect(cell.status).toBe('empty');
    expect(cell.priorityBadge).toBeNull();
  });

  describe('우선순위 뱃지(U2): 부족 > 공고 > 배치', () => {
    it('부족이 있으면 부족 뱃지를 최우선으로', () => {
      const cell = computeDayCell({ dateKey: 'd', headcount: 2, jobCount: 1, softTarget: 5 });
      expect(cell.priorityBadge).toEqual({ kind: 'shortage', count: 3 });
    });

    it('부족이 없고 공고가 있으면 공고 뱃지', () => {
      const cell = computeDayCell({ dateKey: 'd', headcount: 3, jobCount: 2, softTarget: 3 });
      expect(cell.priorityBadge).toEqual({ kind: 'job', count: 2 });
    });

    it('부족·공고가 없고 배치만 있으면 배치 뱃지', () => {
      const cell = computeDayCell({ dateKey: 'd', headcount: 4, jobCount: 0, softTarget: 0 });
      expect(cell.priorityBadge).toEqual({ kind: 'batch', count: 4 });
    });
  });

  it('음수 입력은 0 으로 방어(headcount/softTarget)', () => {
    const cell = computeDayCell({ dateKey: 'd', headcount: -2, jobCount: -1, softTarget: -3 });
    expect(cell.headcount).toBe(0);
    expect(cell.jobCount).toBe(0);
    expect(cell.softTarget).toBe(0);
    expect(cell.status).toBe('empty');
  });
});

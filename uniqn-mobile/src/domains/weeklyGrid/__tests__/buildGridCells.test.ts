/**
 * buildGridCells — 월 그리드 요약행 + 컨테이너 softTargets → 셀 맵 합성(순수) 테스트
 *
 * useGridSummary 의 합성 로직을 순수함수로 분리해 단위테스트한다(렌더 없이 결정적).
 */
import { buildGridCells, type GridSummaryRow } from '../buildGridCells';

describe('buildGridCells', () => {
  it('빈 요약행 + 빈 softTargets → 빈 맵', () => {
    expect(buildGridCells([], {})).toEqual({});
  });

  it('요약행 + softTarget 미달 → 부족셀(shortage 뱃지 우선)', () => {
    const rows: GridSummaryRow[] = [
      { d: '2026-07-10', headcount: 1, jobCount: 2, requiredCount: 0 },
    ];
    const cells = buildGridCells(rows, { '2026-07-10': 3 });
    expect(cells['2026-07-10']).toMatchObject({
      dateKey: '2026-07-10',
      headcount: 1,
      jobCount: 2,
      softTarget: 3,
      shortage: 2,
      status: 'shortage',
      priorityBadge: { kind: 'shortage', count: 2 },
    });
  });

  it('softTarget 충족(headcount>=target) → staffed + 공고 뱃지 우선', () => {
    const rows: GridSummaryRow[] = [
      { d: '2026-07-11', headcount: 5, jobCount: 1, requiredCount: 0 },
    ];
    const cells = buildGridCells(rows, { '2026-07-11': 3 });
    expect(cells['2026-07-11']).toMatchObject({
      shortage: 0,
      status: 'staffed',
      priorityBadge: { kind: 'job', count: 1 },
    });
  });

  it('softTarget 없는 배치날 → staffed + 배치 뱃지', () => {
    const rows: GridSummaryRow[] = [
      { d: '2026-07-12', headcount: 2, jobCount: 0, requiredCount: 0 },
    ];
    const cells = buildGridCells(rows, {});
    expect(cells['2026-07-12']).toMatchObject({
      softTarget: 0,
      shortage: 0,
      status: 'staffed',
      priorityBadge: { kind: 'batch', count: 2 },
    });
  });

  it('요약행에 없지만 softTarget>0 인 날 → 배치 0 부족셀 생성(E5 불변식)', () => {
    const cells = buildGridCells([], { '2026-07-20': 4 });
    expect(cells['2026-07-20']).toMatchObject({
      headcount: 0,
      softTarget: 4,
      shortage: 4,
      status: 'shortage',
      priorityBadge: { kind: 'shortage', count: 4 },
    });
  });

  it('요약행 없고 softTarget<=0 인 날은 셀을 만들지 않는다', () => {
    const cells = buildGridCells([], { '2026-07-21': 0, '2026-07-22': -1 });
    expect(cells['2026-07-21']).toBeUndefined();
    expect(cells['2026-07-22']).toBeUndefined();
  });

  it('빈 dateKey 행은 건너뛴다', () => {
    const rows: GridSummaryRow[] = [{ d: '', headcount: 3, jobCount: 1, requiredCount: 0 }];
    expect(buildGridCells(rows, {})).toEqual({});
  });

  it('필요인원 = max(수동 softTarget, requiredCount) 로 병합한다', () => {
    const rows: GridSummaryRow[] = [
      { d: '2026-08-10', headcount: 1, jobCount: 1, requiredCount: 3 }, // 파생 우세
      { d: '2026-08-11', headcount: 0, jobCount: 1, requiredCount: 1 }, // 수동 우세
    ];
    const softTargets = { '2026-08-11': 5 };
    const cells = buildGridCells(rows, softTargets);
    expect(cells['2026-08-10'].softTarget).toBe(3); // max(0, 3)
    expect(cells['2026-08-10'].shortage).toBe(2); // 3 - 1
    expect(cells['2026-08-11'].softTarget).toBe(5); // max(5, 1)
  });
});

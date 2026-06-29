/**
 * buildGridCells — 월 그리드 요약행 + 컨테이너 softTargets 를 셀 맵으로 합성(순수)
 *
 * useGridSummary 의 합성 로직을 순수함수로 분리해 렌더 없이 결정적으로 단위테스트한다.
 * - 요약행(headcount/jobCount) + 그 날 softTarget 으로 computeDayCell 도출.
 * - 요약행에 없지만 softTarget>0 인 날도 셀을 생성한다 → 배치 0 이어도 부족신호가 표면화(E5 불변식).
 *
 * 불변성: 새 Record 를 생성하며 입력은 변경하지 않는다.
 */
import { computeDayCell, type GridDayCell } from './gridSlotState';

/** get_venue_grid_summary RPC 한 행(camelCase 투영). */
export interface GridSummaryRow {
  /** YYYY-MM-DD (work_logs.date) */
  d: string;
  /** venue 스팬 read-time COUNT (cancelled/no_show 제외) */
  headcount: number;
  /** 그 날 venue 의 open 공고 수 */
  jobCount: number;
}

export function buildGridCells(
  rows: GridSummaryRow[],
  softTargets: Record<string, number>
): Record<string, GridDayCell> {
  const cells: Record<string, GridDayCell> = {};
  const seen = new Set<string>();

  for (const row of rows) {
    const dateKey = row.d;
    if (!dateKey) continue;
    seen.add(dateKey);
    cells[dateKey] = computeDayCell({
      dateKey,
      headcount: row.headcount,
      jobCount: row.jobCount,
      softTarget: softTargets[dateKey] ?? 0,
    });
  }

  // 요약행에 없지만 목표인원(>0)이 설정된 날 → 배치 0 부족셀 생성(부족신호 누락 방지)
  for (const [dateKey, target] of Object.entries(softTargets)) {
    if (seen.has(dateKey)) continue;
    if (!(typeof target === 'number' && Number.isFinite(target) && target > 0)) continue;
    cells[dateKey] = computeDayCell({
      dateKey,
      headcount: 0,
      jobCount: 0,
      softTarget: target,
    });
  }

  return cells;
}

/**
 * gridSlotState — 근무표 셀 상태 순수함수(슬롯 상태머신)
 *
 * venue 스팬 read-time COUNT(headcount, §6) + open 공고 수(jobCount) + soft-target 으로
 * 셀 상태/우선순위 뱃지를 도출한다. UI(Phase 2 CalendarCell)는 이 순수 결과만 소비한다.
 *
 * U2 뱃지 밀도: 모바일 셀 과밀 방지 → 우선순위 1개로 압축(부족 > 공고 > 배치).
 * U1 a11y: 부족을 색상 단독이 아니라 종류(kind)+수치(count)로 표현 가능하게 산출.
 */
import { computeShortage } from './softTargets';

export type GridBadgeKind = 'shortage' | 'job' | 'batch';
export type GridDayStatus = 'empty' | 'shortage' | 'staffed';

export interface GridDayCellInput {
  dateKey: string;
  /** venue 스팬 read-time COUNT (cancelled/no_show 제외) */
  headcount: number;
  /** 그 날 venue 의 open 공고 수 */
  jobCount: number;
  /** 컨테이너 schedule.softTargets[date] */
  softTarget: number;
}

export interface GridBadge {
  kind: GridBadgeKind;
  count: number;
}

export interface GridDayCell {
  dateKey: string;
  headcount: number;
  jobCount: number;
  softTarget: number;
  shortage: number;
  status: GridDayStatus;
  /** U2: 우선순위 압축 단일 뱃지(없으면 null) */
  priorityBadge: GridBadge | null;
}

const clampNonNeg = (n: number): number => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

/** 하루 셀 상태 도출(순수). 음수/비정상 입력은 0 으로 방어. */
export function computeDayCell(input: GridDayCellInput): GridDayCell {
  const headcount = clampNonNeg(input.headcount);
  const jobCount = clampNonNeg(input.jobCount);
  const softTarget = clampNonNeg(input.softTarget);
  const shortage = computeShortage(softTarget, headcount);

  let status: GridDayStatus;
  if (shortage > 0) status = 'shortage';
  else if (headcount > 0) status = 'staffed';
  else status = 'empty';

  // U2 우선순위: 부족 > 공고 > 배치
  let priorityBadge: GridBadge | null = null;
  if (shortage > 0) priorityBadge = { kind: 'shortage', count: shortage };
  else if (jobCount > 0) priorityBadge = { kind: 'job', count: jobCount };
  else if (headcount > 0) priorityBadge = { kind: 'batch', count: headcount };

  return {
    dateKey: input.dateKey,
    headcount,
    jobCount,
    softTarget,
    shortage,
    status,
    priorityBadge,
  };
}

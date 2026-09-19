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
  /** 부족 계산에 쓰는 **실효** 목표 = max(수동, 공고 파생). */
  softTarget: number;
  /**
   * 사용자가 직접 저장한 목표(`schedule.softTargets[date]`) — 실효 목표와 분리해 보존한다.
   * 미지정이면 `softTarget` 과 같다고 본다(파생값이 없는 기존 호출부 무회귀).
   *
   * 🔑 이 분리가 없으면 편집 UI 가 실효값을 수동 목표 입력칸에 프리필하고, 저장 한 번에
   *    공고에서 파생된 숫자가 사용자의 수동 목표를 덮어쓴다(기준선 §5.1 위반).
   */
  manualTarget?: number;
  /** 그 날 공고 requirements 에서 파생된 좌석 합(dated only). 미지정이면 0. */
  derivedRequired?: number;
}

export interface GridBadge {
  kind: GridBadgeKind;
  count: number;
}

export interface GridDayCell {
  dateKey: string;
  headcount: number;
  jobCount: number;
  /** 실효 목표 = max(manualTarget, derivedRequired). 부족 계산·뱃지의 기준. */
  softTarget: number;
  /** 사용자가 직접 저장한 목표(편집 입력칸의 정본). */
  manualTarget: number;
  /** 공고 좌석에서 파생된 목표(읽기 전용 — 사용자가 고칠 수 없다). */
  derivedRequired: number;
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
  // 미지정이면 실효값을 그대로 수동값으로 본다 — 파생 개념이 없던 기존 호출부의 의미를 보존한다.
  const manualTarget =
    input.manualTarget === undefined ? softTarget : clampNonNeg(input.manualTarget);
  const derivedRequired = clampNonNeg(input.derivedRequired ?? 0);
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
    manualTarget,
    derivedRequired,
    shortage,
    status,
    priorityBadge,
  };
}

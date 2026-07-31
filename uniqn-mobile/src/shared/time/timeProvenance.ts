/**
 * timeProvenance — 실제 출퇴근 시각이 "어디서 온 값인지" 판정 (순수 함수)
 *
 * 근무 시간은 곧 금액이라, 화면에 뜬 `19:04` 가 QR 로 찍힌 값인지 사람이 나중에 적어 넣은
 * 값인지가 정산 분쟁의 근거가 된다. 그런데 스키마는 이 구분을 절반만 들고 있다.
 *
 * 실측 (2026-07-31):
 * - `work_logs.end_time_source` 에 `'qr'` 을 쓰는 곳은 `process_qr_checkin_atomically` RPC
 *   **퇴근 분기 하나뿐**이다. 출근 분기는 `check_in_ts` 만 쓰고 출처를 남기지 않으며,
 *   `start_time_source` 같은 대응 컬럼도 **존재하지 않는다**.
 *   → 출근 시각은 "QR 로 찍혔다" 고 주장할 근거가 아예 없다.
 * - 2026-07-31 이전의 수동 수정 경로는 `end_time_source` 를 갱신하지 않았다.
 *   → QR 퇴근 뒤 구인자가 시각을 고친 레거시 행은 여전히 `'qr'` 이다.
 *   컬럼만 보고 표시하면 **사람이 적어 넣은 값에 "QR 기록" 딱지**가 붙는다.
 *
 * 그래서 판정은 `modification_history` 를 먼저 본다. 수정 이력이 그 시간축을 건드렸으면
 * 출처가 무엇이라 적혀 있든 '수정됨' 이다 — 확실한 쪽이 이긴다. 애매하면 아무것도
 * 주장하지 않는다(`'unknown'`): 거짓 "QR 기록" 이 표시 없음보다 훨씬 나쁘다.
 */
import type { WorkTimeModification } from '@/types';

/** 실제 시각의 출처 판정 결과 */
export type TimeProvenance =
  /** QR 로 찍혔고 이후 수정된 적 없다 */
  | 'qr'
  /** 사람이 수정한 값이다 */
  | 'edited'
  /** 근거가 없어 아무것도 주장하지 않는다 */
  | 'unknown';

/** 판정 대상 시간축 */
export type TimeAxis = 'start' | 'end';

export interface ResolveTimeProvenanceInput {
  axis: TimeAxis;
  /** work_logs.end_time_source — 퇴근축에만 의미가 있다 */
  endTimeSource?: 'qr' | 'manual' | null;
  modificationHistory?: readonly WorkTimeModification[];
}

/**
 * 이력 배열에 해당 시간축을 바꾼 엔트리가 하나라도 있는가.
 *
 * `appendWorkTimeModification` 은 **변경된 축의 키만** 엔트리에 담는다(미변경 축은 생략).
 * 따라서 값의 참·거짓이 아니라 **키의 존재**로 판정해야 한다 — `null`(미정으로 변경)도
 * 엄연한 수정이므로 truthy 검사를 쓰면 "미정으로 바꾼 수정" 을 놓친다.
 */
function hasEditOnAxis(
  history: readonly WorkTimeModification[] | undefined,
  axis: TimeAxis
): boolean {
  if (!history || history.length === 0) return false;
  const key = axis === 'start' ? 'newStartTime' : 'newEndTime';
  return history.some((entry) => entry?.[key] !== undefined);
}

/**
 * 실제 시각의 출처를 판정한다.
 *
 * 우선순위: 수정 이력 > 출처 컬럼 > 미상.
 */
export function resolveTimeProvenance(input: ResolveTimeProvenanceInput): TimeProvenance {
  if (hasEditOnAxis(input.modificationHistory, input.axis)) return 'edited';

  // 출근축에는 출처 컬럼이 없다 — 이력이 없으면 알 방법이 없다.
  if (input.axis === 'start') return 'unknown';

  if (input.endTimeSource === 'qr') return 'qr';
  if (input.endTimeSource === 'manual') return 'edited';
  return 'unknown';
}

/** 출처 배지 문구. `'unknown'` 은 배지를 렌더하지 않는다(null). */
export const TIME_PROVENANCE_LABELS: Record<TimeProvenance, string | null> = {
  qr: 'QR',
  edited: '수정됨',
  unknown: null,
};

/** 스크린리더용 문구 — 기호(✓)는 읽히지 않으므로 별도로 준다. */
export const TIME_PROVENANCE_A11Y_LABELS: Record<TimeProvenance, string | null> = {
  qr: 'QR로 기록된 시각',
  edited: '사람이 수정한 시각',
  unknown: null,
};

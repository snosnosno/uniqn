/**
 * editSlotPayload — 근무 수정 시트가 서버로 보낼 시간 값 결정(순수)
 *
 * @description `time_slot` 의 정본은 **출근 예정 시각 단일값 'HH:mm'** 또는 미기록(=미정)이다(§K).
 *   예정 종료 시각은 더 이상 저장하지 않는다 — 퇴근은 실적(`check_out_ts`)이지 약속이 아니다.
 *
 *   이 모듈이 지키는 것은 하나다: **사용자가 시간 축을 건드리지 않았으면 아무것도 보내지 않는다.**
 *   시트는 화면을 그리려고 시간 상태를 항상 들고 있는데, 그걸 저장 신호로 오해하면
 *   색상·메모만 고치려던 저장이 근무 시간을 바꿔버린다. 예전에는 종료 기본값('02:00')이
 *   그렇게 실려 나가 없던 8시간 근무가 확정됐고, 그 값이 정산 금액의 계산 근거가 됐다.
 *   이제는 반대 방향의 같은 위험도 막는다 — 이미 저장된 값을 조용히 지우지 않는다.
 */

export interface SlotTimeSelection {
  /** 사용자에게 보이는 출근 예정 시각('HH:mm'). 아직 정해진 값이 없으면 null. */
  startTime: string | null;
  /** 사용자가 '미정'을 명시 선택했는가. */
  timeUndecided: boolean;
  /** 이번 편집에서 사용자가 시간 축을 실제로 건드렸는가(피커 선택 또는 미정 토글). */
  timeDirty: boolean;
}

export interface SlotTimePayload {
  startTime?: string;
  timeUndecided?: boolean;
}

/**
 * 시트 상태 → 서버 payload 의 시간 축.
 *
 * @returns 사용자가 시간 축을 안 건드렸으면 `{}` — 레포가 time_slot 키를 만들지 않아
 *   기존 저장값(단일 시각이든, 이미 저장된 레거시 범위든)이 그대로 보존된다.
 *   미정은 startTime 보다 우선한다(레포·인원 추가 경로와 동일 우선순위).
 */
export function resolveSlotTimePayload(selection: SlotTimeSelection): SlotTimePayload {
  if (!selection.timeDirty) return {};
  if (selection.timeUndecided) return { timeUndecided: true };
  if (selection.startTime) return { startTime: selection.startTime };
  return {};
}

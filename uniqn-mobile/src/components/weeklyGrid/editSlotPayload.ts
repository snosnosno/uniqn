/**
 * editSlotPayload — 근무 수정 시트가 서버로 보낼 시간 값 결정(순수)
 *
 * @description 인원 추가 경로는 종료 개념이 없어 `time_slot` 을 단일 시각('18:00')으로 저장하거나
 *   아예 비워 둔다. 그런데 수정 시트는 종료 필드를 상수 기본값('02:00')으로 채운 뒤 저장 시
 *   **조건 없이** 시작·종료를 함께 보냈다. 그래서 색상만 바꾸거나 메모만 남기려고 카드를 열었다
 *   저장해도 없던 8시간(18:00~익일 02:00) 근무가 확정되고, 그 값이 실측 출퇴근이 없을 때의
 *   정산 계산 근거가 된다(`domains/settlement/helpers.ts` 의 timeSlot 파싱 경로).
 *
 *   따라서 "사용자가 종료를 실제로 정했는가"를 값과 분리해 추적하고, 정하지 않았으면 종료를
 *   보내지 않는다. 레포지토리는 이미 `startTime && endTime` 일 때만 time_slot 을 갱신하므로
 *   서버 변경 없이 원본(단일 시각·미정)이 보존된다.
 */

export interface SlotTimeSelection {
  startTime: string;
  endTime: string;
  /** 사용자가 종료 시각을 실제로 지정했는가(원본에 있었거나 이번에 골랐거나). */
  endTimeSet: boolean;
}

export interface SlotTimePayload {
  startTime?: string;
  endTime?: string;
}

/**
 * 시트 상태 → 서버 payload 의 시간 축.
 *
 * @returns 종료가 미설정이면 두 값 모두 생략한다 — 레포가 시작만으론 time_slot 을 갱신하지
 *   않으므로 시작만 보내는 것은 무의미하고, 원본 슬롯의 표기를 그대로 두는 편이 정직하다.
 */
export function resolveSlotTimePayload(selection: SlotTimeSelection): SlotTimePayload {
  if (!selection.endTimeSet) return {};
  return { startTime: selection.startTime, endTime: selection.endTime };
}

/** 종료 미설정 상태에서 트리거 필드에 보여줄 문구. */
export const UNSET_END_TIME_LABEL = '미설정';

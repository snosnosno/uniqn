/**
 * scheduledStart — 저장된 `time_slot` 을 통합 편집 시트의 **예정 축 두 값**으로 읽는다.
 *
 * 진입점 3곳(근무표·공고 스태프관리·정산)이 각자 이 판정을 다시 쓰면 어긋난다. 실제로
 * 어긋났을 때 무슨 일이 나는지가 이 파일의 존재 이유다:
 *
 * 🔴 `scheduledStart === null` 만 보고 '미정'으로 초기화하면, 폐지 전 자유 텍스트
 *    ('저녁 6시')로 저장된 행에서 미정 체크가 **이미 켜진 상태**로 시작한다. 그러면
 *    사용자가 미정을 골라도 dirty 가 안 잡혀 패치가 비고, 화면에는 "고쳤는데 그대로"로
 *    보인다. 그래서 "값이 없다"(미정)와 "값은 있는데 못 읽는다"(지워야 할 값)를 가른다.
 *
 * 판정 기준은 폐기된 `EditSlotSheet` 의 초기화 블록을 그대로 옮긴 것이다(새로 만들지 않았다):
 *   `Boolean(timeSlot) && !isValidSlotStartTime(parseTimeSlotParts(timeSlot).start)`
 */
import { isValidSlotStartTime, parseTimeSlotParts } from './slotEdit';

export interface ScheduledStartReading {
  /** 정본 형식('HH:mm')으로 읽힌 출근 예정 시각. 없거나 못 읽으면 null. */
  scheduledStart: string | null;
  /** 값은 있는데 읽을 수 없다 — '미정'이 아니라 **지워야 할 값**이다. */
  scheduledUnreadable: boolean;
}

/**
 * `time_slot` → 예정 축 두 값.
 *
 * 이미 저장된 범위 데이터('18:00 - 02:00')는 시작만 취한다(읽기 하위호환 — §K).
 */
export function readScheduledStart(timeSlot: string | null | undefined): ScheduledStartReading {
  const { start } = parseTimeSlotParts(timeSlot);
  const readable = isValidSlotStartTime(start);

  return {
    scheduledStart: readable ? start.trim() : null,
    scheduledUnreadable: Boolean(timeSlot) && !readable,
  };
}

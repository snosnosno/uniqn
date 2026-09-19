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
  /**
   * 원본에 **예정 종료**가 저장돼 있었다(폐지된 범위 데이터 `'18:00 - 02:00'`).
   *
   * 🔴 화면이 이걸 모르면 종료 시각이 **말없이 사라진다.** 시트는 시작만 보여주는데,
   *    사용자가 예정을 다시 고르면 저장은 단일값 `'HH:mm'` 으로 나가 범위가 소멸한다.
   *    폐기된 `EditSlotSheet` 는 정확히 이 상황을 고지했고(`hadLegacyEnd`), 그 테스트 이름이
   *    "조용한 소실 방지"였다. 고지를 대체 없이 잃지 않으려고 판정을 여기로 옮겼다.
   */
  hadLegacyEnd: boolean;
}

/**
 * `time_slot` → 예정 축 세 값.
 *
 * 이미 저장된 범위 데이터('18:00 - 02:00')는 시작만 취한다(읽기 하위호환 — §K).
 * 종료는 값으로 돌려주지 않고 **있었다는 사실만** 알린다 — 되살릴 축이 아니라 고지할 사실이다.
 */
export function readScheduledStart(timeSlot: string | null | undefined): ScheduledStartReading {
  const { start, end } = parseTimeSlotParts(timeSlot);
  const readable = isValidSlotStartTime(start);

  return {
    scheduledStart: readable ? start.trim() : null,
    scheduledUnreadable: Boolean(timeSlot) && !readable,
    hadLegacyEnd: Boolean(end),
  };
}

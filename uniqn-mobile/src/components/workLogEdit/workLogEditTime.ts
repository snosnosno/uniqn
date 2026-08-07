/**
 * workLogEditTime — 통합 편집 시트의 시각 표기 공용 규칙
 *
 * 🔴 **'익일' 판정을 여기 한 벌로 모은다.** 같은 화면의 두 곳이 각자 계산하고 있었다 —
 *    퇴근 칸의 `(익일)` 꼬리표(`WorkTimeFields`)와 "익일 퇴근으로 계산돼요" 배너
 *    (`attendanceInsight.isNextDay` → `AttendanceNotices`). 규칙이 두 벌이면 한쪽만 고쳤을 때
 *    꼬리표는 붙는데 배너는 안 뜨는(또는 그 반대) 상태가 되고, 그건 보는 사람이 **둘 중
 *    무엇이 사실인지 알 수 없는** 화면이다. 판정은 하나여야 한다.
 *
 * 🔑 앵커는 호출부가 정한다. 꼬리표는 `checkIn ?? baseDate` 를, 배너는 `checkIn` 을 기준으로
 *    본다 — 같은 함수를 쓰되 무엇과 비교할지는 각자의 맥락이다.
 *
 * ⚠️ 시각 **조립**(`composeTime`·`applyPickedTime`)은 여기 두지 않는다. 그쪽은 피커의 24+ 표기
 *    계약과 얽혀 있어 `WorkTimeFields` 가 소유하는 것이 맞다(그 계약을 아는 유일한 컴포넌트다).
 */

/** 'HH:mm' / 'H:mm' 파싱용. 예정 시각 입력과 피커 왕복이 같은 형식을 쓴다. */
export const CLOCK_RE = /^(\d{1,2}):(\d{2})$/;

/** 로컬 시각 'HH:mm'. `WorkTimeDisplay` 의 표시 정본과 같은 24시간 표기다. */
export function formatClock(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * 두 Date 가 서로 다른 달력 날짜인가. **시각 비교가 아니라 날짜 비교다** —
 * 24시간 차이가 아니라 자정을 넘겼는지를 본다(`WorkTimeDisplay.isEndNextDay` 와 같은 축).
 */
export function isLaterCalendarDay(target: Date, base: Date): boolean {
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const baseDay = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  return targetDay.getTime() > baseDay.getTime();
}

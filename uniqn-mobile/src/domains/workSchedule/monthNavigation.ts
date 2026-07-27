/**
 * monthNavigation — 근무표 월 이동 시 선택 날짜 보정(순수 로직).
 *
 * 근무표는 "보이는 달(visibleMonth)"과 "선택된 날(selectedDate)" 두 상태를 함께 쓴다.
 * 월만 이동하고 선택 날을 그대로 두면 캘린더는 새 달을 그리는데 아래 상세 패널은 이전 달
 * 날짜를 계속 붙들어, **같은 화면이 한 날짜에 대해 서로 다른 값을 동시에 말한다**
 * (요약 칩은 '현재 0명', 카드는 3명). 더 나쁜 건 그 상태로 목표 인원을 저장하면 화면에
 * 보이지도 않는 이전 달 날짜에 저장된다는 것이다.
 */
import { isSameMonth, startOfMonth } from 'date-fns';

/**
 * 보이는 달이 바뀌었을 때 선택해야 할 날짜를 고른다.
 *
 * - 이미 그 달 안의 날짜를 고른 상태면 그대로 둔다(사용자 선택 보존).
 * - 이동한 달이 오늘이 속한 달이면 오늘 — 되돌아왔을 때 기대하는 자리.
 * - 그 외에는 그 달 1일.
 *
 * @param current 현재 선택된 날짜
 * @param visibleMonth 새로 보이게 된 달(그 달의 아무 날짜여도 됨)
 * @param today 오늘 날짜(테스트 결정성을 위해 주입받는다)
 */
export function resolveSelectedDateForMonth(current: Date, visibleMonth: Date, today: Date): Date {
  if (isSameMonth(current, visibleMonth)) return current;
  if (isSameMonth(visibleMonth, today)) return today;
  return startOfMonth(visibleMonth);
}

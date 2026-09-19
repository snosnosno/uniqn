/**
 * ops 대회 날짜(`ops_tournaments.event_date`) 형식 계약 — 순수 도메인.
 *
 * 이 모듈이 존재하는 이유는 형식이 **조용히** 깨졌기 때문이다. 생성 폼이 자유 텍스트였고
 * 스키마가 `z.string().optional()` 이라 "7/1" 도 저장에 성공했다. 그런데 '이어서 운영' 카드는
 * `eventDate === 오늘(YYYY-MM-DD)` 정확 문자열 비교라, 형식이 어긋난 대회는 **영영 카드에
 * 오르지 못한다.** 에러도 경고도 없다 — 그래서 형식을 값 계층에서 못박는다.
 *
 * "오늘"의 정의도 여기 하나만 둔다(`kstDateString`). ops 는 한국 현장의 벽시계 날짜로
 * 운영되므로 기기 로컬 TZ 가 아니라 **KST(UTC+9) 고정**이다 — 앱 표준 `getTodayString()`(로컬)과
 * 의도적으로 다르며, 읽기(재개 카드)·쓰기(복제) 양쪽이 이 함수 하나를 공유해야 어긋나지 않는다.
 */
import { format } from 'date-fns';

/** `event_date` 저장 형식. DB 컬럼은 `date` 타입이라 서버도 이 형태만 받는다. */
export const OPS_EVENT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 'YYYY-MM-DD' 이고 **실재하는 달력 날짜**인지. 패턴만 보면 `2026-02-30`·`2026-13-01` 이
 * 통과해 DB 에서 22008 로 터진다(원인에서 먼 실패).
 */
export function isOpsEventDate(value: string): boolean {
  const m = OPS_EVENT_DATE_PATTERN.exec(value);
  if (!m) return false;
  const [y, mo, d] = value.split('-').map(Number) as [number, number, number];
  const probe = new Date(y, mo - 1, d);
  return probe.getFullYear() === y && probe.getMonth() === mo - 1 && probe.getDate() === d;
}

/** KST(UTC+9) 기준 날짜 문자열(YYYY-MM-DD). 기기 로컬 TZ 비의존(UTC epoch 산술만 사용). */
export function kstDateString(nowMs: number): string {
  return new Date(nowMs + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * KST 기준 오늘을 **로컬 자정 Date** 로. `DatePicker`/`CalendarPicker` 가 로컬 Date 로
 * 달력 날짜를 다루므로, 시드값을 여기서 한 번 변환해 둔다.
 * ⚠️ `new Date(nowMs + 9h)` 를 그대로 넘기면 안 된다 — 그건 KST 벽시계를 로컬로 읽은 값이라
 *    기기가 KST 가 아니면 달력에서 하루 어긋난다.
 */
export function kstTodayLocalDate(nowMs: number): Date {
  const [y, mo, d] = kstDateString(nowMs).split('-').map(Number) as [number, number, number];
  return new Date(y, mo - 1, d);
}

/** 달력에서 고른 로컬 Date → 저장 문자열. 사용자가 탭한 달력 날짜를 그대로 보존한다. */
export function opsEventDateToString(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

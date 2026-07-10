/**
 * weekRange — 주간 액션 대상 주 계산 SSOT(P0-4) 테스트
 *
 * 지난주 복사/배치 확인 알림이 대상으로 삼는 "선택일이 속한 주(월~일)"의 경계와 라벨을 고정한다.
 * label 은 기존 알림 형식("M월 d일 주간") 회귀 고정(weeklyBatchNotification.weekLabel 계약).
 * 앵커 요일은 시스템 date 로 실측: 2026-06-29(월)·2026-07-02(목)·2026-07-05(일)·
 * 2026-12-28(월)·2027-01-03(일).
 */
import { getWeekRange } from '../weekRange';
import { toDateString } from '@/utils/date';

it('주중(목) 입력 → 그 주 월요일 시작·일요일 끝', () => {
  const range = getWeekRange(new Date(2026, 6, 2)); // 2026-07-02(목)

  expect(toDateString(range.start)).toBe('2026-06-29');
  expect(toDateString(range.end)).toBe('2026-07-05');
});

it('월요일 입력 → 시작이 그 날 자신', () => {
  const range = getWeekRange(new Date(2026, 5, 29)); // 2026-06-29(월)

  expect(toDateString(range.start)).toBe('2026-06-29');
});

it('연 경계: 일요일 입력 → 시작이 이전 해 12월 월요일', () => {
  const range = getWeekRange(new Date(2027, 0, 3)); // 2027-01-03(일)

  expect(toDateString(range.start)).toBe('2026-12-28');
  expect(toDateString(range.end)).toBe('2027-01-03');
});

it('label: 기존 알림 형식("M월 d일 주간") 유지', () => {
  const range = getWeekRange(new Date(2026, 6, 2));

  expect(range.label).toBe('6월 29일 주간');
});

it('rangeLabel: 화면 표기 "M/d(요일) ~ M/d(요일)"', () => {
  const range = getWeekRange(new Date(2026, 6, 2));

  expect(range.rangeLabel).toBe('6/29(월) ~ 7/5(일)');
});

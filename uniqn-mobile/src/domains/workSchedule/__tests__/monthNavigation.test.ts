/**
 * monthNavigation — 월 이동 시 선택 날짜 보정
 *
 * 회귀: 월만 이동하고 selectedDate 를 그대로 두면 캘린더는 새 달을 그리는데 하단 상세 패널은
 * 이전 달 날짜를 붙들어, 같은 화면이 한 날짜에 대해 두 값을 동시에 말한다. 그 상태로 목표
 * 인원을 저장하면 화면에 보이지도 않는 이전 달 날짜에 저장된다.
 */
import { resolveSelectedDateForMonth } from '../monthNavigation';

const TODAY = new Date(2026, 6, 27); // 2026-07-27

it('이미 그 달 안의 날짜를 고른 상태면 선택을 보존한다', () => {
  const current = new Date(2026, 6, 15);
  const visibleMonth = new Date(2026, 6, 1);

  expect(resolveSelectedDateForMonth(current, visibleMonth, TODAY)).toBe(current);
});

it('오늘이 속한 달로 이동하면 오늘을 고른다', () => {
  const current = new Date(2026, 8, 3); // 9월에 있던 선택
  const visibleMonth = new Date(2026, 6, 1); // 7월로 복귀

  expect(resolveSelectedDateForMonth(current, visibleMonth, TODAY)).toBe(TODAY);
});

it('오늘과 다른 달로 이동하면 그 달 1일을 고른다', () => {
  const current = new Date(2026, 6, 27);
  const visibleMonth = new Date(2026, 7, 1); // 8월

  const result = resolveSelectedDateForMonth(current, visibleMonth, TODAY);

  expect(result.getFullYear()).toBe(2026);
  expect(result.getMonth()).toBe(7);
  expect(result.getDate()).toBe(1);
});

it('과거 달로 이동해도 선택이 그 달 안으로 들어온다(이전 달 잔존 금지)', () => {
  const current = new Date(2026, 6, 27);
  const visibleMonth = new Date(2026, 5, 1); // 6월

  const result = resolveSelectedDateForMonth(current, visibleMonth, TODAY);

  expect(result.getMonth()).toBe(5);
  expect(result.getDate()).toBe(1);
});

it('연도가 다르면 같은 월이어도 그 달로 끌어온다', () => {
  const current = new Date(2025, 6, 27); // 2025-07
  const visibleMonth = new Date(2026, 6, 1); // 2026-07 (오늘의 달)

  expect(resolveSelectedDateForMonth(current, visibleMonth, TODAY)).toBe(TODAY);
});

import type { KeyboardEvent } from 'react';

/**
 * 라디오 그룹 키보드 조작 — WAI-ARIA 라디오 패턴(리뷰 W5·W6 LOW).
 * 화살표=이웃 칸으로 이동하며 선택(끝에서 돈다 — 즉시 저장 그룹은 이동만), Home·End=처음·끝. Tab 으로 들어오는 칸은 선택된 하나뿐.
 * 판정은 DOM 에 묶이지 않은 순수 함수로 두어 테스트한다(keyGuards 와 같은 방식).
 */

const NEXT_KEYS = new Set(['ArrowRight', 'ArrowDown']);
const PREV_KEYS = new Set(['ArrowLeft', 'ArrowUp']);

/** 눌린 키로 옮겨 갈 칸. 움직이지 않으면 null. current=−1 은 선택 없음. */
export function nextRadioIndex(key: string, current: number, count: number): number | null {
  if (count < 2) return null;
  let next: number;
  if (NEXT_KEYS.has(key)) next = current < 0 ? 0 : (current + 1) % count;
  else if (PREV_KEYS.has(key)) next = current < 0 ? count - 1 : (current - 1 + count) % count;
  else if (key === 'Home') next = 0;
  else if (key === 'End') next = count - 1;
  else return null;
  return next === current ? null : next;
}

/** 선택된 칸(없으면 첫 칸)만 Tab 순서에 넣는다. */
export function radioTabIndex(index: number, selected: number): 0 | -1 {
  return index === (selected < 0 ? 0 : selected) ? 0 : -1;
}

/**
 * radiogroup 요소에 붙일 keydown 처리기. 옮겨 간 칸으로 포커스를 옮긴다.
 * @param options 화면에 그리는 순서 그대로의 값 목록
 * @param value 지금 선택(null = 선택 없음)
 * @param selectOnMove false 면 화살표는 포커스만 옮기고 확정은 Space/Enter(네이티브 click)로 —
 *   고르는 즉시 서버에 쓰는 그룹용. 훑기만 해도 기록이 나가면 안 된다(리뷰: 테이블 상태 '마감' 오조작).
 */
export function radioGroupKeyDown<T>(
  options: readonly T[],
  value: T | null,
  onChange: (next: T) => void,
  { selectOnMove = true }: { selectOnMove?: boolean } = {}
): (event: KeyboardEvent<HTMLElement>) => void {
  return (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const radios = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]'));
    const focused = radios.indexOf(event.currentTarget.ownerDocument.activeElement as HTMLElement);
    const current = !selectOnMove && focused >= 0 ? focused : options.findIndex((o) => o === value);
    const next = nextRadioIndex(event.key, current, options.length);
    if (next === null) return;
    event.preventDefault();
    if (selectOnMove) onChange(options[next] as T);
    radios[next]?.focus();
  };
}

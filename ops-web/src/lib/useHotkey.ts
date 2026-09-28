import { useEffect, useLayoutEffect, useRef } from 'react';
import { shouldHandleHotkey } from './keyGuards';

const EDITABLE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';

/**
 * 단일 키 단축키(예: X 탈락). 입력 중·조합 중·수정키 조합·다른 대화상자 열림·자동반복이면 무시.
 * @param code 물리 키 코드(KeyboardEvent.code) — 예: 'KeyX'
 */
export function useHotkey(code: string, handler: () => void, enabled = true): void {
  useHotkeyMap({ [code]: handler }, enabled);
}

/**
 * 여러 단축키를 리스너 하나로 — 반복문에서 useHotkey 를 부르지 않도록(훅 규칙).
 * 가드는 useHotkey 와 같다(입력 중·조합 중·수정키·대화상자 열림·자동반복 무시).
 * @param handlers 물리 키 코드 → 동작. 매 렌더 새 객체여도 된다(최신 값을 ref 로 읽는다).
 */
export function useHotkeyMap(handlers: Record<string, () => void>, enabled = true): void {
  const handlersRef = useRef(handlers);
  // 레이아웃 단계에서 갱신 — 행 클릭 직후 곧바로 누른 키가 이전 선택에 적용되지 않게(리뷰 W4).
  useLayoutEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    if (!enabled) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      const handler = handlersRef.current[event.code];
      if (!handler) return;
      const target = event.target instanceof Element ? event.target : null;
      const handled = shouldHandleHotkey(
        {
          code: event.code,
          repeat: event.repeat,
          isComposing: event.isComposing,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          altKey: event.altKey,
          editableTarget: Boolean(target?.closest(EDITABLE)),
          dialogOpen: document.querySelector('[role="dialog"]') !== null,
        },
        event.code
      );
      if (handled) {
        event.preventDefault();
        handler();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}

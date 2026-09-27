import { useEffect, useRef } from 'react';
import { shouldHandleHotkey } from './keyGuards';

const EDITABLE = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';

/**
 * 단일 키 단축키(예: X 탈락). 입력 중·조합 중·수정키 조합·다른 대화상자 열림·자동반복이면 무시.
 * @param code 물리 키 코드(KeyboardEvent.code) — 예: 'KeyX'
 */
export function useHotkey(code: string, handler: () => void, enabled = true): void {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!enabled) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
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
        code
      );
      if (handled) {
        event.preventDefault();
        handlerRef.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [code, enabled]);
}

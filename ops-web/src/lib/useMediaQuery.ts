import { useCallback, useSyncExternalStore } from 'react';

/** CSS 미디어 쿼리 일치 여부(예: '(min-width: 1024px)'). */
export function useMediaQuery(query: string): boolean {
  // subscribe 를 고정해야 매 렌더마다 matchMedia 를 다시 구독하지 않는다(리뷰 W4).
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query]
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  );
}

import { useEffect } from 'react';

/**
 * 전광판은 항상 다크(TV·대형 화면, 모바일과 같다). 사용자 테마 설정은 건드리지 않고
 * 이 화면이 떠 있는 동안만 덮었다가 떠날 때 되돌린다.
 */
export function useForceDark(): void {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.dataset.theme;
    root.dataset.theme = 'dark';
    return () => {
      if (previous === undefined) delete root.dataset.theme;
      else root.dataset.theme = previous;
    };
  }, []);
}

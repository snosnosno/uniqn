import { useState, useEffect } from 'react';

/**
 * A custom React hook that tracks whether a media query is met.
 * It includes debouncing to optimize performance during window resizing.
 *
 * @param query The media query string to watch (e.g., '(max-width: 768px)').
 * @returns `true` if the media query is met, otherwise `false`.
 */
export function useMediaQuery(query: string): boolean {
  const getMatches = (query: string): boolean => {
    // Prevents SSR issues
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  };

  const [matches, setMatches] = useState<boolean>(getMatches(query));

  useEffect(() => {
    const media = window.matchMedia(query);

    let timeoutId: NodeJS.Timeout;

    const listener = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => setMatches(media.matches), 150);
    };

    // Set the initial state directly without triggering listener
    setMatches(media.matches);

    // Add listener for media query changes
    media.addEventListener('change', listener);

    return () => {
      media.removeEventListener('change', listener);
      clearTimeout(timeoutId);
    };
  }, [query]);

  return matches;
}

/**
 * 사전 정의된 브레이크포인트 훅
 */
export const useBreakpoint = () => {
  const isMobile = useMediaQuery('(max-width: 640px)');
  const isTablet = useMediaQuery('(min-width: 641px) and (max-width: 1024px)');
  const isDesktop = useMediaQuery('(min-width: 1025px)');
  const isLargeDesktop = useMediaQuery('(min-width: 1280px)');

  return {
    isMobile,
    isTablet,
    isDesktop,
    isLargeDesktop,
    // 유용한 조합
    isMobileOrTablet: isMobile || isTablet,
    isTabletOrDesktop: isTablet || isDesktop,
  };
};

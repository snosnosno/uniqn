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

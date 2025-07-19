import { useEffect, useRef, useCallback } from 'react';

interface UseInfiniteScrollProps {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  rootMargin?: string;
  threshold?: number;
}

/**
 * Custom hook for infinite scroll using Intersection Observer API
 * Automatically triggers fetchNextPage when the target element comes into view
 */
export const useInfiniteScroll = ({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  rootMargin = '100px',
  threshold = 0.1
}: UseInfiniteScrollProps) => {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      
      // Trigger fetch when element is visible and conditions are met
      if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage]
  );

  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(handleIntersection, {
      rootMargin,
      threshold
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [handleIntersection, rootMargin, threshold]);

  return {
    loadMoreRef
  };
};
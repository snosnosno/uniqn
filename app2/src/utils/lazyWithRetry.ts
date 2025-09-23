import { lazy, ComponentType } from 'react';

/**
 * Enhanced lazy loading with retry mechanism for better reliability
 * Handles chunk loading failures gracefully
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  retries = 3,
  delay = 1000
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    let lastError: Error | null = null;

    for (let i = 0; i < retries; i++) {
      try {
        return await importFn();
      } catch (error) {
        lastError = error as Error;

        // If it's a chunk load error and we have retries left
        if (i < retries - 1 && error instanceof Error &&
            error.message.includes('Loading chunk')) {
          await new Promise(resolve => setTimeout(resolve, delay));
          // Exponential backoff
          delay *= 2;
        } else {
          throw error;
        }
      }
    }

    throw lastError;
  });
}

/**
 * Preload a lazy component to improve perceived performance
 */
export function preloadComponent(
  importFn: () => Promise<any>
): void {
  // Fire and forget - preload in background
  importFn().catch(() => {
    // Silently fail preloading - component will load when needed
  });
}
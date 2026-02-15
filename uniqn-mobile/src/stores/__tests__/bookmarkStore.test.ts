/**
 * UNIQN Mobile - Bookmark Store Tests
 *
 * @description Tests for bookmark (favorites) state management (Zustand)
 */

import { act } from '@testing-library/react-native';
import {
  useBookmarkStore,
  selectBookmarkCount,
  selectBookmarks,
  selectIsBookmarked,
  selectToggleBookmark,
  selectAddBookmark,
  selectRemoveBookmark,
  selectClearAllBookmarks,
  selectBookmarkIds,
  type BookmarkedJob,
} from '../bookmarkStore';

// ============================================================================
// Helpers
// ============================================================================

const createJob = (overrides: Partial<Omit<BookmarkedJob, 'bookmarkedAt'>> = {}) => ({
  id: `job-${Math.random().toString(36).slice(2, 8)}`,
  title: '테스트 공고',
  location: '서울',
  ...overrides,
});

function resetStore() {
  act(() => {
    useBookmarkStore.getState().clearAllBookmarks();
    useBookmarkStore.setState({ _hasHydrated: false });
  });
}

// ============================================================================
// Tests
// ============================================================================

describe('BookmarkStore', () => {
  beforeEach(() => {
    resetStore();
  });

  // ============================================================================
  // Initial State
  // ============================================================================

  describe('Initial State', () => {
    it('should start with empty bookmarks', () => {
      const state = useBookmarkStore.getState();
      expect(state.bookmarks).toEqual([]);
    });
  });

  // ============================================================================
  // addBookmark
  // ============================================================================

  describe('addBookmark', () => {
    it('should add a bookmark with bookmarkedAt timestamp', () => {
      const job = createJob({ id: 'job-1', title: '딜러 모집' });

      act(() => {
        useBookmarkStore.getState().addBookmark(job);
      });

      const { bookmarks } = useBookmarkStore.getState();
      expect(bookmarks).toHaveLength(1);
      expect(bookmarks[0].id).toBe('job-1');
      expect(bookmarks[0].title).toBe('딜러 모집');
      expect(bookmarks[0].bookmarkedAt).toBeDefined();
      expect(typeof bookmarks[0].bookmarkedAt).toBe('number');
    });

    it('should not add duplicate bookmark', () => {
      const job = createJob({ id: 'job-1' });

      act(() => {
        useBookmarkStore.getState().addBookmark(job);
      });
      act(() => {
        useBookmarkStore.getState().addBookmark(job);
      });

      expect(useBookmarkStore.getState().bookmarks).toHaveLength(1);
    });

    it('should add multiple different bookmarks', () => {
      act(() => {
        useBookmarkStore.getState().addBookmark(createJob({ id: 'job-1' }));
      });
      act(() => {
        useBookmarkStore.getState().addBookmark(createJob({ id: 'job-2' }));
      });
      act(() => {
        useBookmarkStore.getState().addBookmark(createJob({ id: 'job-3' }));
      });

      expect(useBookmarkStore.getState().bookmarks).toHaveLength(3);
    });

    it('should enforce max bookmarks limit (100) by removing oldest', () => {
      // Add 100 bookmarks
      for (let i = 0; i < 100; i++) {
        act(() => {
          useBookmarkStore
            .getState()
            .addBookmark(createJob({ id: `job-${i}`, title: `공고 ${i}` }));
        });
      }

      expect(useBookmarkStore.getState().bookmarks).toHaveLength(100);

      // Adding 101st should remove oldest and keep count at 100
      act(() => {
        useBookmarkStore.getState().addBookmark(createJob({ id: 'job-new', title: '새 공고' }));
      });

      const { bookmarks } = useBookmarkStore.getState();
      expect(bookmarks).toHaveLength(100);
      // Oldest should be removed
      expect(bookmarks.find((b) => b.id === 'job-0')).toBeUndefined();
      // New one should be present
      expect(bookmarks.find((b) => b.id === 'job-new')).toBeDefined();
    });

    it('should include optional workDate', () => {
      const job = createJob({ id: 'job-1', workDate: '2025-06-15' });

      act(() => {
        useBookmarkStore.getState().addBookmark(job);
      });

      expect(useBookmarkStore.getState().bookmarks[0].workDate).toBe('2025-06-15');
    });
  });

  // ============================================================================
  // removeBookmark
  // ============================================================================

  describe('removeBookmark', () => {
    it('should remove bookmark by id', () => {
      act(() => {
        useBookmarkStore.getState().addBookmark(createJob({ id: 'job-1' }));
      });
      act(() => {
        useBookmarkStore.getState().addBookmark(createJob({ id: 'job-2' }));
      });

      act(() => {
        useBookmarkStore.getState().removeBookmark('job-1');
      });

      const { bookmarks } = useBookmarkStore.getState();
      expect(bookmarks).toHaveLength(1);
      expect(bookmarks[0].id).toBe('job-2');
    });

    it('should do nothing for non-existent id', () => {
      act(() => {
        useBookmarkStore.getState().addBookmark(createJob({ id: 'job-1' }));
      });

      act(() => {
        useBookmarkStore.getState().removeBookmark('non-existent');
      });

      expect(useBookmarkStore.getState().bookmarks).toHaveLength(1);
    });
  });

  // ============================================================================
  // toggleBookmark
  // ============================================================================

  describe('toggleBookmark', () => {
    it('should add bookmark when not bookmarked', () => {
      const job = createJob({ id: 'job-1' });

      act(() => {
        useBookmarkStore.getState().toggleBookmark(job);
      });

      expect(useBookmarkStore.getState().bookmarks).toHaveLength(1);
    });

    it('should remove bookmark when already bookmarked', () => {
      const job = createJob({ id: 'job-1' });

      act(() => {
        useBookmarkStore.getState().addBookmark(job);
      });

      act(() => {
        useBookmarkStore.getState().toggleBookmark(job);
      });

      expect(useBookmarkStore.getState().bookmarks).toHaveLength(0);
    });

    it('should toggle back and forth', () => {
      const job = createJob({ id: 'job-1' });

      // Add
      act(() => {
        useBookmarkStore.getState().toggleBookmark(job);
      });
      expect(useBookmarkStore.getState().bookmarks).toHaveLength(1);

      // Remove
      act(() => {
        useBookmarkStore.getState().toggleBookmark(job);
      });
      expect(useBookmarkStore.getState().bookmarks).toHaveLength(0);

      // Add again
      act(() => {
        useBookmarkStore.getState().toggleBookmark(job);
      });
      expect(useBookmarkStore.getState().bookmarks).toHaveLength(1);
    });
  });

  // ============================================================================
  // isBookmarked
  // ============================================================================

  describe('isBookmarked', () => {
    it('should return true for bookmarked job', () => {
      act(() => {
        useBookmarkStore.getState().addBookmark(createJob({ id: 'job-1' }));
      });

      expect(useBookmarkStore.getState().isBookmarked('job-1')).toBe(true);
    });

    it('should return false for non-bookmarked job', () => {
      expect(useBookmarkStore.getState().isBookmarked('job-1')).toBe(false);
    });

    it('should return false after removing bookmark', () => {
      act(() => {
        useBookmarkStore.getState().addBookmark(createJob({ id: 'job-1' }));
      });
      act(() => {
        useBookmarkStore.getState().removeBookmark('job-1');
      });

      expect(useBookmarkStore.getState().isBookmarked('job-1')).toBe(false);
    });
  });

  // ============================================================================
  // clearAllBookmarks
  // ============================================================================

  describe('clearAllBookmarks', () => {
    it('should remove all bookmarks', () => {
      act(() => {
        useBookmarkStore.getState().addBookmark(createJob({ id: 'job-1' }));
      });
      act(() => {
        useBookmarkStore.getState().addBookmark(createJob({ id: 'job-2' }));
      });

      act(() => {
        useBookmarkStore.getState().clearAllBookmarks();
      });

      expect(useBookmarkStore.getState().bookmarks).toEqual([]);
    });

    it('should not throw when already empty', () => {
      act(() => {
        useBookmarkStore.getState().clearAllBookmarks();
      });

      expect(useBookmarkStore.getState().bookmarks).toEqual([]);
    });
  });

  // ============================================================================
  // setHasHydrated
  // ============================================================================

  describe('setHasHydrated', () => {
    it('should set hydration state to true', () => {
      act(() => {
        useBookmarkStore.getState().setHasHydrated(true);
      });

      expect(useBookmarkStore.getState()._hasHydrated).toBe(true);
    });

    it('should set hydration state to false', () => {
      act(() => {
        useBookmarkStore.getState().setHasHydrated(true);
      });
      act(() => {
        useBookmarkStore.getState().setHasHydrated(false);
      });

      expect(useBookmarkStore.getState()._hasHydrated).toBe(false);
    });
  });

  // ============================================================================
  // Selectors
  // ============================================================================

  describe('Selectors', () => {
    it('selectBookmarkCount should return correct count', () => {
      act(() => {
        useBookmarkStore.getState().addBookmark(createJob({ id: 'job-1' }));
      });
      act(() => {
        useBookmarkStore.getState().addBookmark(createJob({ id: 'job-2' }));
      });

      expect(selectBookmarkCount(useBookmarkStore.getState())).toBe(2);
    });

    it('selectBookmarkCount should return 0 when empty', () => {
      expect(selectBookmarkCount(useBookmarkStore.getState())).toBe(0);
    });

    it('selectBookmarks should return bookmarks array', () => {
      act(() => {
        useBookmarkStore.getState().addBookmark(createJob({ id: 'job-1' }));
      });

      const bookmarks = selectBookmarks(useBookmarkStore.getState());
      expect(bookmarks).toHaveLength(1);
      expect(bookmarks[0].id).toBe('job-1');
    });

    it('selectIsBookmarked should return the isBookmarked function', () => {
      const isBookmarkedFn = selectIsBookmarked(useBookmarkStore.getState());
      expect(typeof isBookmarkedFn).toBe('function');
    });

    it('selectToggleBookmark should return the toggleBookmark function', () => {
      const toggleFn = selectToggleBookmark(useBookmarkStore.getState());
      expect(typeof toggleFn).toBe('function');
    });

    it('selectAddBookmark should return the addBookmark function', () => {
      const addFn = selectAddBookmark(useBookmarkStore.getState());
      expect(typeof addFn).toBe('function');
    });

    it('selectRemoveBookmark should return the removeBookmark function', () => {
      const removeFn = selectRemoveBookmark(useBookmarkStore.getState());
      expect(typeof removeFn).toBe('function');
    });

    it('selectClearAllBookmarks should return the clearAllBookmarks function', () => {
      const clearFn = selectClearAllBookmarks(useBookmarkStore.getState());
      expect(typeof clearFn).toBe('function');
    });

    it('selectBookmarkIds should return array of bookmark IDs', () => {
      act(() => {
        useBookmarkStore.getState().addBookmark(createJob({ id: 'job-1' }));
      });
      act(() => {
        useBookmarkStore.getState().addBookmark(createJob({ id: 'job-2' }));
      });

      const ids = selectBookmarkIds(useBookmarkStore.getState());
      expect(ids).toEqual(['job-1', 'job-2']);
    });

    it('selectBookmarkIds should return empty array when no bookmarks', () => {
      const ids = selectBookmarkIds(useBookmarkStore.getState());
      expect(ids).toEqual([]);
    });
  });
});

/**
 * UNIQN Mobile - 북마크 스토어
 *
 * @description 공고 북마크(즐겨찾기) 상태 관리
 * @version 1.0.0
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from '@/lib/mmkvStorage';
import { logger } from '@/utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface BookmarkedJob {
  /** 공고 ID */
  id: string;
  /** 공고 제목 */
  title: string;
  /** 근무 장소 */
  location: string;
  /** 근무 날짜 */
  workDate?: string;
  /** 북마크 저장 시간 */
  bookmarkedAt: number;
}

interface BookmarkState {
  /** 북마크된 공고 목록 */
  bookmarks: BookmarkedJob[];
  /** Hydration 완료 여부 */
  _hasHydrated: boolean;
}

interface BookmarkActions {
  /** 북마크 추가 */
  addBookmark: (job: Omit<BookmarkedJob, 'bookmarkedAt'>) => void;
  /** 북마크 제거 */
  removeBookmark: (jobId: string) => void;
  /** 북마크 토글 */
  toggleBookmark: (job: Omit<BookmarkedJob, 'bookmarkedAt'>) => void;
  /** 북마크 여부 확인 */
  isBookmarked: (jobId: string) => boolean;
  /** 전체 북마크 삭제 */
  clearAllBookmarks: () => void;
  /** Hydration 설정 */
  setHasHydrated: (state: boolean) => void;
}

type BookmarkStore = BookmarkState & BookmarkActions;

// ============================================================================
// Constants
// ============================================================================

/** 최대 북마크 수 */
const MAX_BOOKMARKS = 100;

// ============================================================================
// Store Implementation
// ============================================================================

export const useBookmarkStore = create<BookmarkStore>()(
  persist(
    (set, get) => ({
      // State
      bookmarks: [],
      _hasHydrated: false,

      // Actions
      addBookmark: (job) => {
        const { bookmarks } = get();

        // 이미 북마크된 경우 무시
        if (bookmarks.some((b) => b.id === job.id)) {
          logger.debug('이미 북마크된 공고', { jobId: job.id });
          return;
        }

        // 최대 개수 제한
        if (bookmarks.length >= MAX_BOOKMARKS) {
          logger.warn('북마크 최대 개수 초과', { max: MAX_BOOKMARKS });
          // 가장 오래된 북마크 제거
          const sortedBookmarks = [...bookmarks].sort(
            (a, b) => a.bookmarkedAt - b.bookmarkedAt
          );
          sortedBookmarks.shift();
          set({
            bookmarks: [
              ...sortedBookmarks,
              { ...job, bookmarkedAt: Date.now() },
            ],
          });
          return;
        }

        set({
          bookmarks: [...bookmarks, { ...job, bookmarkedAt: Date.now() }],
        });

        logger.info('공고 북마크 추가', { jobId: job.id, title: job.title });
      },

      removeBookmark: (jobId) => {
        const { bookmarks } = get();
        set({
          bookmarks: bookmarks.filter((b) => b.id !== jobId),
        });
        logger.info('공고 북마크 제거', { jobId });
      },

      toggleBookmark: (job) => {
        const { isBookmarked, addBookmark, removeBookmark } = get();
        if (isBookmarked(job.id)) {
          removeBookmark(job.id);
        } else {
          addBookmark(job);
        }
      },

      isBookmarked: (jobId) => {
        return get().bookmarks.some((b) => b.id === jobId);
      },

      clearAllBookmarks: () => {
        set({ bookmarks: [] });
        logger.info('전체 북마크 삭제');
      },

      setHasHydrated: (state) => {
        set({ _hasHydrated: state });
      },
    }),
    {
      name: 'bookmark-storage',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        bookmarks: state.bookmarks,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
        logger.debug('북마크 스토어 복원 완료', {
          count: state?.bookmarks.length ?? 0,
        });
      },
    }
  )
);

// ============================================================================
// Selectors
// ============================================================================

/**
 * 북마크 개수 선택자
 */
export const selectBookmarkCount = (state: BookmarkStore) =>
  state.bookmarks.length;

/**
 * 북마크 목록 선택자 (캐싱됨)
 */
export const selectBookmarks = (state: BookmarkStore) => state.bookmarks;

/**
 * 북마크 여부 확인 액션 선택자
 */
export const selectIsBookmarked = (state: BookmarkStore) => state.isBookmarked;

/**
 * 북마크 토글 액션 선택자
 */
export const selectToggleBookmark = (state: BookmarkStore) =>
  state.toggleBookmark;

/**
 * 북마크 추가 액션 선택자
 */
export const selectAddBookmark = (state: BookmarkStore) => state.addBookmark;

/**
 * 북마크 제거 액션 선택자
 */
export const selectRemoveBookmark = (state: BookmarkStore) =>
  state.removeBookmark;

/**
 * 전체 북마크 삭제 액션 선택자
 */
export const selectClearAllBookmarks = (state: BookmarkStore) =>
  state.clearAllBookmarks;

/**
 * 북마크 ID 목록 선택자
 * @deprecated 매번 새 배열 생성으로 인해 selectBookmarks 사용 권장
 */
export const selectBookmarkIds = (state: BookmarkStore) =>
  state.bookmarks.map((b) => b.id);

// ============================================================================
// Export
// ============================================================================

export default useBookmarkStore;

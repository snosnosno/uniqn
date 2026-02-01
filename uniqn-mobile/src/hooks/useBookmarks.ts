/**
 * UNIQN Mobile - 북마크 훅
 *
 * @description 공고 북마크(즐겨찾기) 기능 제공
 * @version 1.1.0
 */

import { useCallback, useMemo } from 'react';
import {
  useBookmarkStore,
  selectBookmarkCount,
  selectBookmarks,
  selectIsBookmarked,
  selectToggleBookmark,
  selectAddBookmark,
  selectRemoveBookmark,
  selectClearAllBookmarks,
  type BookmarkedJob,
} from '@/stores/bookmarkStore';
import { useToastStore } from '@/stores/toastStore';
import { trackEvent } from '@/services/analyticsService';

// ============================================================================
// Types
// ============================================================================

export interface BookmarkJobParams {
  id: string;
  title: string;
  location: string;
  workDate?: string;
}

export interface UseBookmarksReturn {
  /** 전체 북마크 목록 */
  bookmarks: BookmarkedJob[];
  /** 북마크 개수 */
  bookmarkCount: number;
  /** 최근 북마크 (최대 10개) */
  recentBookmarks: BookmarkedJob[];
  /** 북마크 여부 확인 */
  isBookmarked: (jobId: string) => boolean;
  /** 북마크 토글 */
  toggleBookmark: (job: BookmarkJobParams) => void;
  /** 북마크 추가 */
  addBookmark: (job: BookmarkJobParams) => void;
  /** 북마크 제거 */
  removeBookmark: (jobId: string) => void;
  /** 전체 삭제 */
  clearBookmarks: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * 북마크 훅
 *
 * @example
 * ```tsx
 * const { isBookmarked, toggleBookmark, bookmarkCount } = useBookmarks();
 *
 * <Pressable onPress={() => toggleBookmark(job)}>
 *   <BookmarkIcon filled={isBookmarked(job.id)} />
 * </Pressable>
 * ```
 */
export function useBookmarks(): UseBookmarksReturn {
  const { addToast } = useToastStore();

  // 개별 selector 사용으로 불필요한 리렌더링 방지
  const bookmarks = useBookmarkStore(selectBookmarks);
  const bookmarkCount = useBookmarkStore(selectBookmarkCount);
  const storeIsBookmarked = useBookmarkStore(selectIsBookmarked);
  const storeToggleBookmark = useBookmarkStore(selectToggleBookmark);
  const storeAddBookmark = useBookmarkStore(selectAddBookmark);
  const storeRemoveBookmark = useBookmarkStore(selectRemoveBookmark);
  const storeClearAllBookmarks = useBookmarkStore(selectClearAllBookmarks);

  // 최근 북마크 메모이제이션 (매번 새 배열 생성 방지)
  const recentBookmarks = useMemo(
    () => [...bookmarks].sort((a, b) => b.bookmarkedAt - a.bookmarkedAt).slice(0, 10),
    [bookmarks]
  );

  /**
   * 북마크 여부 확인
   */
  const isBookmarked = useCallback(
    (jobId: string) => {
      return storeIsBookmarked(jobId);
    },
    [storeIsBookmarked]
  );

  /**
   * 북마크 추가
   */
  const addBookmark = useCallback(
    (job: BookmarkJobParams) => {
      storeAddBookmark(job);
      addToast({
        type: 'success',
        message: '북마크에 추가되었습니다',
      });
      trackEvent('bookmark_added', { job_id: job.id });
    },
    [storeAddBookmark, addToast]
  );

  /**
   * 북마크 제거
   */
  const removeBookmark = useCallback(
    (jobId: string) => {
      storeRemoveBookmark(jobId);
      addToast({
        type: 'info',
        message: '북마크에서 제거되었습니다',
      });
      trackEvent('bookmark_removed', { job_id: jobId });
    },
    [storeRemoveBookmark, addToast]
  );

  /**
   * 북마크 토글
   */
  const toggleBookmark = useCallback(
    (job: BookmarkJobParams) => {
      const wasBookmarked = storeIsBookmarked(job.id);

      storeToggleBookmark(job);

      if (wasBookmarked) {
        addToast({
          type: 'info',
          message: '북마크에서 제거되었습니다',
        });
        trackEvent('bookmark_removed', { job_id: job.id });
      } else {
        addToast({
          type: 'success',
          message: '북마크에 추가되었습니다',
        });
        trackEvent('bookmark_added', { job_id: job.id });
      }
    },
    [storeIsBookmarked, storeToggleBookmark, addToast]
  );

  /**
   * 전체 삭제
   */
  const clearBookmarks = useCallback(() => {
    storeClearAllBookmarks();
    addToast({
      type: 'info',
      message: '모든 북마크가 삭제되었습니다',
    });
  }, [storeClearAllBookmarks, addToast]);

  return {
    bookmarks,
    bookmarkCount,
    recentBookmarks,
    isBookmarked,
    toggleBookmark,
    addBookmark,
    removeBookmark,
    clearBookmarks,
  };
}

export default useBookmarks;

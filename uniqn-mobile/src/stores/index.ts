/**
 * UNIQN Mobile - Stores Index
 *
 * @description Zustand 스토어 중앙 인덱스
 * @version 1.0.0
 */

// Auth Store
export {
  useAuthStore,
  useIsAuthenticated,
  useUser,
  useProfile,
  useHasRole,
  selectUser,
  selectProfile,
  selectIsAuthenticated,
  selectIsLoading,
  selectIsAdmin,
  selectIsEmployer,
  selectIsStaff,
  selectAuthStatus,
  selectAuthError,
} from './authStore';
export type { AuthUser, UserProfile, AuthStatus } from './authStore';

// Toast Store
export { useToastStore, useToast, selectToasts, selectHasToasts } from './toastStore';
export type { Toast, ToastType } from './toastStore';

// Modal Store
export {
  useModalStore,
  useModal,
  selectModals,
  selectCurrentModal,
  selectIsAnyModalOpen,
} from './modalStore';
export type { ModalConfig, ModalType, ModalButton } from './modalStore';

// Theme Store
export { useThemeStore } from './themeStore';
export type { ThemeMode } from './themeStore';

// Notification Store
// Note: isLoading 관련 export 제거됨 (v1.2.0) - React Query가 로딩 상태 관리
export {
  useNotificationStore,
  useUnreadCount,
  useNotifications,
  useNotificationSettings,
  useUnreadByCategory,
  selectNotifications,
  selectUnreadCount,
  selectHasMore,
  selectSettings,
  selectFilter,
  selectUnreadByCategory,
} from './notificationStore';

// Bookmark Store
export {
  useBookmarkStore,
  selectBookmarkCount,
  selectBookmarks,
  selectIsBookmarked,
  selectToggleBookmark,
  selectAddBookmark,
  selectRemoveBookmark,
  selectClearAllBookmarks,
  selectBookmarkIds,
} from './bookmarkStore';
export type { BookmarkedJob } from './bookmarkStore';

// Tab Filters Store
export {
  useTabFiltersStore,
  useJobFilters,
  useEmployerFilters,
  useScheduleFilters,
} from './tabFiltersStore';
export type { JobTabFilters, EmployerTabFilters, ScheduleTabFilters } from './tabFiltersStore';

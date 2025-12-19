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
  hasPermission,
  ROLE_HIERARCHY,
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
export {
  useToastStore,
  useToast,
  selectToasts,
  selectHasToasts,
} from './toastStore';
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

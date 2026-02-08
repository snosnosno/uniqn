/**
 * UNIQN Mobile - Modal Store
 *
 * @description 모달 상태 관리 (Zustand)
 * @version 1.0.0
 */

import { create } from 'zustand';
import { generateId } from '@/utils/generateId';

// ============================================================================
// Types
// ============================================================================

export type ModalType = 'confirm' | 'alert' | 'custom' | 'bottomSheet' | 'loading';

export interface ModalButton {
  label: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  onPress?: () => void | Promise<void>;
}

export interface ModalConfig {
  id: string;
  type: ModalType;
  title?: string;
  message?: string;
  content?: React.ReactNode;
  confirmButton?: ModalButton;
  cancelButton?: ModalButton;
  dismissible?: boolean;
  onClose?: () => void;
}

interface ModalState {
  modals: ModalConfig[];
  isAnyModalOpen: boolean;

  // 액션
  openModal: (config: Omit<ModalConfig, 'id'>) => string;
  closeModal: (id?: string) => void;
  closeAllModals: () => void;

  // 편의 메서드
  showAlert: (title: string, message: string, onConfirm?: () => void) => string;
  showConfirm: (
    title: string,
    message: string,
    onConfirm: () => void | Promise<void>,
    onCancel?: () => void
  ) => string;
  showLoading: (message?: string) => string;
  hideLoading: () => void;
}

// ============================================================================
// Store
// ============================================================================

export const useModalStore = create<ModalState>((set, get) => ({
  modals: [],
  isAnyModalOpen: false,

  openModal: (config) => {
    const id = generateId('modal');
    const modal: ModalConfig = {
      id,
      dismissible: true,
      ...config,
    };

    set((state) => ({
      modals: [...state.modals, modal],
      isAnyModalOpen: true,
    }));

    return id;
  },

  closeModal: (id) => {
    set((state) => {
      // id가 없으면 가장 최근 모달 닫기
      const modalToClose = id
        ? state.modals.find((m) => m.id === id)
        : state.modals[state.modals.length - 1];

      if (modalToClose?.onClose) {
        modalToClose.onClose();
      }

      const newModals = id ? state.modals.filter((m) => m.id !== id) : state.modals.slice(0, -1);

      return {
        modals: newModals,
        isAnyModalOpen: newModals.length > 0,
      };
    });
  },

  closeAllModals: () => {
    const { modals } = get();
    modals.forEach((modal) => {
      if (modal.onClose) {
        modal.onClose();
      }
    });
    set({ modals: [], isAnyModalOpen: false });
  },

  // 알림 모달 (확인 버튼만)
  showAlert: (title, message, onConfirm) => {
    return get().openModal({
      type: 'alert',
      title,
      message,
      confirmButton: {
        label: '확인',
        variant: 'primary',
        onPress: onConfirm,
      },
      dismissible: true,
    });
  },

  // 확인 모달 (확인/취소 버튼)
  showConfirm: (title, message, onConfirm, onCancel) => {
    return get().openModal({
      type: 'confirm',
      title,
      message,
      confirmButton: {
        label: '확인',
        variant: 'primary',
        onPress: onConfirm,
      },
      cancelButton: {
        label: '취소',
        variant: 'ghost',
        onPress: onCancel,
      },
      dismissible: true,
    });
  },

  // 로딩 모달
  showLoading: (message = '로딩 중...') => {
    return get().openModal({
      type: 'loading',
      message,
      dismissible: false,
    });
  },

  hideLoading: () => {
    set((state) => {
      const newModals = state.modals.filter((m) => m.type !== 'loading');
      return {
        modals: newModals,
        isAnyModalOpen: newModals.length > 0,
      };
    });
  },
}));

// ============================================================================
// Selectors
// ============================================================================

export const selectModals = (state: ModalState) => state.modals;
export const selectCurrentModal = (state: ModalState) =>
  state.modals[state.modals.length - 1] ?? null;
export const selectIsAnyModalOpen = (state: ModalState) => state.isAnyModalOpen;

// ============================================================================
// Hook for components
// ============================================================================

/**
 * 모달 컨트롤 훅
 * @example
 * const modal = useModal();
 * modal.showAlert('알림', '저장되었습니다');
 * modal.showConfirm('확인', '삭제하시겠습니까?', handleDelete);
 */
export const useModal = () => {
  const {
    showAlert,
    showConfirm,
    showLoading,
    hideLoading,
    openModal,
    closeModal,
    closeAllModals,
  } = useModalStore();
  return {
    showAlert,
    showConfirm,
    showLoading,
    hideLoading,
    open: openModal,
    close: closeModal,
    closeAll: closeAllModals,
  };
};

export default useModalStore;

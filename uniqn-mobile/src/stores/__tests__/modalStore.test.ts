/**
 * UNIQN Mobile - Modal Store Tests
 *
 * @description Tests for modal state management (Zustand)
 */

import { act } from '@testing-library/react-native';
import {
  useModalStore,
  selectModals,
  selectCurrentModal,
  selectIsAnyModalOpen,
} from '../modalStore';

// Mock generateId to return deterministic IDs
let mockIdCounter = 0;
jest.mock('@/utils/generateId', () => ({
  generateId: jest.fn((prefix?: string) => {
    mockIdCounter++;
    return prefix ? `${prefix}-mock-${mockIdCounter}` : `mock-${mockIdCounter}`;
  }),
}));

describe('ModalStore', () => {
  beforeEach(() => {
    mockIdCounter = 0;
    act(() => {
      useModalStore.getState().closeAllModals();
    });
  });

  // ============================================================================
  // Initial State
  // ============================================================================

  describe('Initial State', () => {
    it('should start with empty modals', () => {
      const state = useModalStore.getState();

      expect(state.modals).toEqual([]);
      expect(state.isAnyModalOpen).toBe(false);
    });
  });

  // ============================================================================
  // openModal
  // ============================================================================

  describe('openModal', () => {
    it('should open a modal and return its id', () => {
      let modalId: string;

      act(() => {
        modalId = useModalStore.getState().openModal({
          type: 'alert',
          title: '알림',
          message: '테스트 메시지',
        });
      });

      const state = useModalStore.getState();
      expect(state.modals).toHaveLength(1);
      expect(state.modals[0].id).toBe(modalId!);
      expect(state.modals[0].type).toBe('alert');
      expect(state.modals[0].title).toBe('알림');
      expect(state.isAnyModalOpen).toBe(true);
    });

    it('should default dismissible to true', () => {
      act(() => {
        useModalStore.getState().openModal({
          type: 'alert',
          title: 'Test',
        });
      });

      expect(useModalStore.getState().modals[0].dismissible).toBe(true);
    });

    it('should respect dismissible: false', () => {
      act(() => {
        useModalStore.getState().openModal({
          type: 'loading',
          message: '로딩 중...',
          dismissible: false,
        });
      });

      expect(useModalStore.getState().modals[0].dismissible).toBe(false);
    });

    it('should support modal stack (multiple modals)', () => {
      act(() => {
        useModalStore.getState().openModal({ type: 'alert', title: '첫번째' });
      });
      act(() => {
        useModalStore.getState().openModal({ type: 'confirm', title: '두번째' });
      });

      const { modals } = useModalStore.getState();
      expect(modals).toHaveLength(2);
      expect(modals[0].title).toBe('첫번째');
      expect(modals[1].title).toBe('두번째');
    });

    it('should store confirmButton and cancelButton', () => {
      const onConfirm = jest.fn();
      const onCancel = jest.fn();

      act(() => {
        useModalStore.getState().openModal({
          type: 'confirm',
          title: '확인',
          message: '진행하시겠습니까?',
          confirmButton: { label: '확인', variant: 'primary', onPress: onConfirm },
          cancelButton: { label: '취소', variant: 'ghost', onPress: onCancel },
        });
      });

      const modal = useModalStore.getState().modals[0];
      expect(modal.confirmButton?.label).toBe('확인');
      expect(modal.cancelButton?.label).toBe('취소');
    });
  });

  // ============================================================================
  // closeModal
  // ============================================================================

  describe('closeModal', () => {
    it('should close modal by id', () => {
      let id1: string;
      let id2: string;

      act(() => {
        id1 = useModalStore.getState().openModal({ type: 'alert', title: '첫번째' });
      });
      act(() => {
        id2 = useModalStore.getState().openModal({ type: 'alert', title: '두번째' });
      });

      act(() => {
        useModalStore.getState().closeModal(id1!);
      });

      const { modals } = useModalStore.getState();
      expect(modals).toHaveLength(1);
      expect(modals[0].id).toBe(id2!);
    });

    it('should close most recent modal when no id provided', () => {
      act(() => {
        useModalStore.getState().openModal({ type: 'alert', title: '첫번째' });
      });
      act(() => {
        useModalStore.getState().openModal({ type: 'alert', title: '두번째' });
      });

      act(() => {
        useModalStore.getState().closeModal();
      });

      const { modals } = useModalStore.getState();
      expect(modals).toHaveLength(1);
      expect(modals[0].title).toBe('첫번째');
    });

    it('should call onClose callback when closing', () => {
      const onClose = jest.fn();

      act(() => {
        useModalStore.getState().openModal({
          type: 'alert',
          title: 'Test',
          onClose,
        });
      });

      act(() => {
        useModalStore.getState().closeModal();
      });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should update isAnyModalOpen correctly', () => {
      act(() => {
        useModalStore.getState().openModal({ type: 'alert', title: '1' });
      });
      act(() => {
        useModalStore.getState().openModal({ type: 'alert', title: '2' });
      });

      expect(useModalStore.getState().isAnyModalOpen).toBe(true);

      act(() => {
        useModalStore.getState().closeModal();
      });

      expect(useModalStore.getState().isAnyModalOpen).toBe(true); // still 1 modal

      act(() => {
        useModalStore.getState().closeModal();
      });

      expect(useModalStore.getState().isAnyModalOpen).toBe(false);
    });
  });

  // ============================================================================
  // closeAllModals
  // ============================================================================

  describe('closeAllModals', () => {
    it('should close all modals', () => {
      act(() => {
        useModalStore.getState().openModal({ type: 'alert', title: '1' });
      });
      act(() => {
        useModalStore.getState().openModal({ type: 'confirm', title: '2' });
      });

      act(() => {
        useModalStore.getState().closeAllModals();
      });

      expect(useModalStore.getState().modals).toEqual([]);
      expect(useModalStore.getState().isAnyModalOpen).toBe(false);
    });

    it('should call onClose for all modals', () => {
      const onClose1 = jest.fn();
      const onClose2 = jest.fn();

      act(() => {
        useModalStore.getState().openModal({ type: 'alert', title: '1', onClose: onClose1 });
      });
      act(() => {
        useModalStore.getState().openModal({ type: 'alert', title: '2', onClose: onClose2 });
      });

      act(() => {
        useModalStore.getState().closeAllModals();
      });

      expect(onClose1).toHaveBeenCalledTimes(1);
      expect(onClose2).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================================================
  // showAlert
  // ============================================================================

  describe('showAlert', () => {
    it('should create alert modal with correct config', () => {
      const onConfirm = jest.fn();

      act(() => {
        useModalStore.getState().showAlert('알림', '저장되었습니다', onConfirm);
      });

      const modal = useModalStore.getState().modals[0];
      expect(modal.type).toBe('alert');
      expect(modal.title).toBe('알림');
      expect(modal.message).toBe('저장되었습니다');
      expect(modal.confirmButton?.label).toBe('확인');
      expect(modal.confirmButton?.variant).toBe('primary');
      expect(modal.confirmButton?.onPress).toBe(onConfirm);
      expect(modal.dismissible).toBe(true);
    });

    it('should work without onConfirm callback', () => {
      act(() => {
        useModalStore.getState().showAlert('알림', '메시지');
      });

      const modal = useModalStore.getState().modals[0];
      expect(modal.type).toBe('alert');
      expect(modal.confirmButton?.onPress).toBeUndefined();
    });

    it('should return modal id', () => {
      let modalId: string;

      act(() => {
        modalId = useModalStore.getState().showAlert('알림', '메시지');
      });

      expect(modalId!).toBeDefined();
      expect(typeof modalId!).toBe('string');
    });
  });

  // ============================================================================
  // showConfirm
  // ============================================================================

  describe('showConfirm', () => {
    it('should create confirm modal with confirm and cancel buttons', () => {
      const onConfirm = jest.fn();
      const onCancel = jest.fn();

      act(() => {
        useModalStore.getState().showConfirm('확인', '삭제하시겠습니까?', onConfirm, onCancel);
      });

      const modal = useModalStore.getState().modals[0];
      expect(modal.type).toBe('confirm');
      expect(modal.title).toBe('확인');
      expect(modal.message).toBe('삭제하시겠습니까?');
      expect(modal.confirmButton?.label).toBe('확인');
      expect(modal.confirmButton?.variant).toBe('primary');
      expect(modal.confirmButton?.onPress).toBe(onConfirm);
      expect(modal.cancelButton?.label).toBe('취소');
      expect(modal.cancelButton?.variant).toBe('ghost');
      expect(modal.cancelButton?.onPress).toBe(onCancel);
    });

    it('should work without onCancel callback', () => {
      const onConfirm = jest.fn();

      act(() => {
        useModalStore.getState().showConfirm('확인', '메시지', onConfirm);
      });

      const modal = useModalStore.getState().modals[0];
      expect(modal.cancelButton?.onPress).toBeUndefined();
    });
  });

  // ============================================================================
  // showLoading / hideLoading
  // ============================================================================

  describe('showLoading / hideLoading', () => {
    it('should show loading modal with default message', () => {
      act(() => {
        useModalStore.getState().showLoading();
      });

      const modal = useModalStore.getState().modals[0];
      expect(modal.type).toBe('loading');
      expect(modal.message).toBe('로딩 중...');
      expect(modal.dismissible).toBe(false);
    });

    it('should show loading modal with custom message', () => {
      act(() => {
        useModalStore.getState().showLoading('저장 중...');
      });

      const modal = useModalStore.getState().modals[0];
      expect(modal.message).toBe('저장 중...');
    });

    it('should hide loading modal', () => {
      act(() => {
        useModalStore.getState().showLoading();
      });

      expect(useModalStore.getState().modals).toHaveLength(1);

      act(() => {
        useModalStore.getState().hideLoading();
      });

      expect(useModalStore.getState().modals).toHaveLength(0);
      expect(useModalStore.getState().isAnyModalOpen).toBe(false);
    });

    it('should only hide loading modals, keep others', () => {
      act(() => {
        useModalStore.getState().openModal({ type: 'alert', title: '알림' });
      });
      act(() => {
        useModalStore.getState().showLoading();
      });

      expect(useModalStore.getState().modals).toHaveLength(2);

      act(() => {
        useModalStore.getState().hideLoading();
      });

      const { modals } = useModalStore.getState();
      expect(modals).toHaveLength(1);
      expect(modals[0].type).toBe('alert');
      expect(useModalStore.getState().isAnyModalOpen).toBe(true);
    });

    it('should hide multiple loading modals at once', () => {
      act(() => {
        useModalStore.getState().showLoading('첫번째');
      });
      act(() => {
        useModalStore.getState().showLoading('두번째');
      });

      expect(useModalStore.getState().modals).toHaveLength(2);

      act(() => {
        useModalStore.getState().hideLoading();
      });

      expect(useModalStore.getState().modals).toHaveLength(0);
    });
  });

  // ============================================================================
  // Selectors
  // ============================================================================

  describe('Selectors', () => {
    it('selectModals should return modals array', () => {
      act(() => {
        useModalStore.getState().openModal({ type: 'alert', title: 'Test' });
      });

      const state = useModalStore.getState();
      expect(selectModals(state)).toHaveLength(1);
    });

    it('selectCurrentModal should return the most recent modal', () => {
      act(() => {
        useModalStore.getState().openModal({ type: 'alert', title: '첫번째' });
      });
      act(() => {
        useModalStore.getState().openModal({ type: 'confirm', title: '두번째' });
      });

      const state = useModalStore.getState();
      expect(selectCurrentModal(state)?.title).toBe('두번째');
    });

    it('selectCurrentModal should return null when no modals', () => {
      const state = useModalStore.getState();
      expect(selectCurrentModal(state)).toBeNull();
    });

    it('selectIsAnyModalOpen should return correct value', () => {
      expect(selectIsAnyModalOpen(useModalStore.getState())).toBe(false);

      act(() => {
        useModalStore.getState().openModal({ type: 'alert', title: 'Test' });
      });

      expect(selectIsAnyModalOpen(useModalStore.getState())).toBe(true);
    });
  });
});

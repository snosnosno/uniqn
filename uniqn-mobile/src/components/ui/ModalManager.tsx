/**
 * UNIQN Mobile - ModalManager 컴포넌트
 *
 * @description 전역 모달 관리 컴포넌트
 * @version 1.0.0
 */

import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { PRIMARY_COLORS } from '@/constants/colors';
import { useModalStore, type ModalConfig } from '@/stores/modalStore';
import { Modal, AlertModal, ConfirmModal } from './Modal';
import { Button } from './Button';

// ============================================================================
// Loading Modal Component
// ============================================================================

function LoadingModalContent({ message }: { message?: string }) {
  return (
    <View className="items-center py-4">
      <ActivityIndicator size="large" color={PRIMARY_COLORS[300]} />
      {message && (
        <Text className="text-content-muted dark:text-secondary-300 mt-4 text-center font-sans">
          {message}
        </Text>
      )}
    </View>
  );
}

// ============================================================================
// Individual Modal Renderer
// ============================================================================

function ModalRenderer({ modal }: { modal: ModalConfig }) {
  const { closeModal } = useModalStore();

  const handleClose = () => {
    closeModal(modal.id);
  };

  const handleConfirm = async () => {
    if (modal.confirmButton?.onPress) {
      await modal.confirmButton.onPress();
    }
    handleClose();
  };

  const handleCancel = async () => {
    if (modal.cancelButton?.onPress) {
      await modal.cancelButton.onPress();
    }
    handleClose();
  };

  switch (modal.type) {
    case 'loading':
      return (
        <Modal
          visible={true}
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          onClose={() => {}} // 로딩 모달은 닫을 수 없음
          closeOnBackdrop={false}
          showCloseButton={false}
          size="sm"
        >
          <LoadingModalContent message={modal.message} />
        </Modal>
      );

    case 'alert':
      return (
        <AlertModal
          visible={true}
          onClose={handleClose}
          title={modal.title}
          message={modal.message || ''}
          confirmText={modal.confirmButton?.label || '확인'}
        />
      );

    case 'confirm':
      return (
        <ConfirmModal
          visible={true}
          onClose={handleCancel}
          onConfirm={handleConfirm}
          title={modal.title}
          message={modal.message || ''}
          confirmText={modal.confirmButton?.label || '확인'}
          cancelText={modal.cancelButton?.label || '취소'}
          isDestructive={modal.confirmButton?.variant === 'danger'}
        />
      );

    case 'custom':
      return (
        <Modal
          visible={true}
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          onClose={modal.dismissible ? handleClose : () => {}} // dismissible이 false면 빈 함수
          title={modal.title}
          closeOnBackdrop={modal.dismissible}
          showCloseButton={modal.dismissible}
          // footer prop 으로 — modal.content 는 호출부 자유형 ReactNode 라 길이 상한이 없다.
          // children 끝에 두면 긴 콘텐츠에서 버튼이 스크롤 아래로 밀린다(2026-07-25).
          footer={
            modal.confirmButton || modal.cancelButton ? (
              <View className="flex-row justify-end gap-2">
                {modal.cancelButton && (
                  <Button variant={modal.cancelButton.variant || 'ghost'} onPress={handleCancel}>
                    {modal.cancelButton.label}
                  </Button>
                )}
                {modal.confirmButton && (
                  <Button
                    variant={modal.confirmButton.variant || 'primary'}
                    onPress={handleConfirm}
                  >
                    {modal.confirmButton.label}
                  </Button>
                )}
              </View>
            ) : undefined
          }
        >
          {modal.content}
        </Modal>
      );

    case 'bottomSheet':
      return (
        <Modal
          visible={true}
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          onClose={modal.dismissible ? handleClose : () => {}} // dismissible이 false면 빈 함수
          title={modal.title}
          position="bottom"
          closeOnBackdrop={modal.dismissible}
          showCloseButton={modal.dismissible}
        >
          {modal.content}
        </Modal>
      );

    default:
      return null;
  }
}

// ============================================================================
// Main Component
// ============================================================================

export function ModalManager() {
  const { modals } = useModalStore();

  // 모달이 없으면 렌더링하지 않음
  if (modals.length === 0) {
    return null;
  }

  return (
    <>
      {modals.map((modal) => (
        <ModalRenderer key={modal.id} modal={modal} />
      ))}
    </>
  );
}

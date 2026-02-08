/**
 * UNIQN Mobile - 모달 Footer 버튼 컴포넌트
 *
 * @description 모달/시트 하단의 취소/확인 버튼 패턴을 공통화
 * @version 1.0.0
 */

import React, { memo } from 'react';
import { View } from 'react-native';
import { Button } from './Button';

// ============================================================================
// Types
// ============================================================================

export interface ModalFooterButtonsProps {
  /** 취소 버튼 클릭 핸들러 */
  onCancel: () => void;
  /** 확인/저장 버튼 클릭 핸들러 */
  onSubmit: () => void;
  /** 로딩 상태 (취소 비활성화 + 확인 로딩 표시) */
  isLoading?: boolean;
  /** 취소 버튼 텍스트 */
  cancelText?: string;
  /** 확인 버튼 텍스트 */
  submitText?: string;
  /** 확인 버튼 비활성화 여부 */
  submitDisabled?: boolean;
  /** 확인 버튼 스타일 변형 */
  submitVariant?: 'primary' | 'danger';
  /** 확인 버튼 아이콘 */
  submitIcon?: React.ReactNode;
}

// ============================================================================
// Component
// ============================================================================

export const ModalFooterButtons = memo(function ModalFooterButtons({
  onCancel,
  onSubmit,
  isLoading = false,
  cancelText = '취소',
  submitText = '확인',
  submitDisabled = false,
  submitVariant = 'primary',
  submitIcon,
}: ModalFooterButtonsProps) {
  return (
    <View className="flex-row gap-3">
      <Button
        variant="secondary"
        onPress={onCancel}
        disabled={isLoading}
        className="flex-1"
        accessibilityLabel={cancelText}
      >
        {cancelText}
      </Button>
      <Button
        variant={submitVariant}
        onPress={onSubmit}
        loading={isLoading}
        disabled={submitDisabled}
        className="flex-1"
        icon={submitIcon}
        accessibilityLabel={submitText}
      >
        {submitText}
      </Button>
    </View>
  );
});

export default ModalFooterButtons;

/**
 * UNIQN Mobile - 대회공고 재제출 버튼
 *
 * @description 거부된 대회공고를 재제출하는 버튼 컴포넌트
 * @version 1.0.0
 */

import React, { useState, useCallback } from 'react';
import { Text, Pressable, ActivityIndicator } from 'react-native';
import { RefreshIcon } from '@/components/icons';
import { ConfirmModal } from '@/components/ui/Modal';
import { useTournamentApproval } from '@/hooks/useTournamentApproval';

// ============================================================================
// Types
// ============================================================================

interface ResubmitButtonProps {
  /** 공고 ID */
  postingId: string;
  /** 버튼 크기 */
  size?: 'sm' | 'md' | 'lg';
  /** 전체 너비 사용 */
  fullWidth?: boolean;
  /** 재제출 성공 시 콜백 */
  onSuccess?: () => void;
  /** 추가 className */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function ResubmitButton({
  postingId,
  size = 'md',
  fullWidth = false,
  onSuccess,
  className = '',
}: ResubmitButtonProps) {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const { resubmit } = useTournamentApproval();

  // 사이즈별 스타일
  const sizeStyles = {
    sm: {
      paddingClass: 'px-3 py-2',
      textClass: 'text-sm',
      iconSize: 16,
    },
    md: {
      paddingClass: 'px-4 py-3',
      textClass: 'text-base',
      iconSize: 18,
    },
    lg: {
      paddingClass: 'px-5 py-4',
      textClass: 'text-lg',
      iconSize: 20,
    },
  };

  const { paddingClass, textClass, iconSize } = sizeStyles[size];

  // 재제출 버튼 클릭
  const handlePress = useCallback(() => {
    setShowConfirmModal(true);
  }, []);

  // 재제출 확인
  const handleConfirm = useCallback(() => {
    resubmit
      .mutateAsync({ postingId })
      .then(() => {
        setShowConfirmModal(false);
        onSuccess?.();
      })
      .catch(() => {
        // 에러는 useTournamentApproval에서 토스트로 처리됨
        setShowConfirmModal(false);
      });
  }, [postingId, resubmit, onSuccess]);

  // 모달 닫기
  const handleClose = useCallback(() => {
    setShowConfirmModal(false);
  }, []);

  return (
    <>
      <Pressable
        onPress={handlePress}
        disabled={resubmit.isPending}
        className={`
          flex-row items-center justify-center rounded-xl
          bg-primary-600 dark:bg-primary-500
          active:bg-primary-700 dark:active:bg-primary-600
          ${paddingClass}
          ${fullWidth ? 'w-full' : ''}
          ${resubmit.isPending ? 'opacity-50' : ''}
          ${className}
        `}
      >
        {resubmit.isPending ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <>
            <RefreshIcon size={iconSize} color="#ffffff" />
            <Text className={`ml-2 font-medium text-white ${textClass}`}>재제출</Text>
          </>
        )}
      </Pressable>

      {/* 확인 모달 */}
      <ConfirmModal
        visible={showConfirmModal}
        onClose={handleClose}
        onConfirm={handleConfirm}
        title="대회공고 재제출"
        message="공고를 다시 승인 심사에 제출하시겠습니까? 관리자의 검토 후 승인/거부가 결정됩니다."
        confirmText="재제출"
        cancelText="취소"
      />
    </>
  );
}

export default ResubmitButton;

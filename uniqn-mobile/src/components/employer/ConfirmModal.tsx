/**
 * UNIQN Mobile - 확인/거절 모달 컴포넌트
 *
 * @description 지원자 확정 또는 거절 시 사용하는 모달
 * @version 1.0.0
 */

import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { CheckIcon, XMarkIcon, AlertCircleIcon } from '../icons';
import type { ApplicantWithDetails } from '@/services';
import type { StaffRole } from '@/types';

// ============================================================================
// Types
// ============================================================================

export type ConfirmModalAction = 'confirm' | 'reject' | 'waitlist';

export interface ApplicantConfirmModalProps {
  visible: boolean;
  onClose: () => void;
  applicant: ApplicantWithDetails | null;
  action: ConfirmModalAction;
  onConfirm: (notes?: string) => void;
  onReject: (reason?: string) => void;
  onWaitlist: () => void;
  isLoading?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const ACTION_CONFIG: Record<ConfirmModalAction, {
  title: string;
  description: string;
  buttonText: string;
  buttonVariant: 'primary' | 'danger' | 'secondary';
  showTextInput: boolean;
  inputLabel: string;
  inputPlaceholder: string;
}> = {
  confirm: {
    title: '지원자 확정',
    description: '이 지원자를 확정하시겠습니까?',
    buttonText: '확정하기',
    buttonVariant: 'primary',
    showTextInput: true,
    inputLabel: '메모 (선택)',
    inputPlaceholder: '추가 메모를 입력하세요',
  },
  reject: {
    title: '지원자 거절',
    description: '이 지원자를 거절하시겠습니까?',
    buttonText: '거절하기',
    buttonVariant: 'danger',
    showTextInput: true,
    inputLabel: '거절 사유 (선택)',
    inputPlaceholder: '거절 사유를 입력하세요',
  },
  waitlist: {
    title: '대기열 추가',
    description: '이 지원자를 대기열에 추가하시겠습니까?',
    buttonText: '대기열 추가',
    buttonVariant: 'secondary',
    showTextInput: false,
    inputLabel: '',
    inputPlaceholder: '',
  },
};

const ROLE_LABELS: Record<StaffRole, string> = {
  dealer: '딜러',
  manager: '매니저',
  chiprunner: '칩러너',
  admin: '관리자',
};

// ============================================================================
// Component
// ============================================================================

export function ApplicantConfirmModal({
  visible,
  onClose,
  applicant,
  action,
  onConfirm,
  onReject,
  onWaitlist,
  isLoading = false,
}: ApplicantConfirmModalProps) {
  const [inputValue, setInputValue] = useState('');
  const config = ACTION_CONFIG[action];

  // 모달 닫기 시 입력값 초기화
  const handleClose = useCallback(() => {
    setInputValue('');
    onClose();
  }, [onClose]);

  // 액션 실행
  const handleAction = useCallback(() => {
    switch (action) {
      case 'confirm':
        onConfirm(inputValue.trim() || undefined);
        break;
      case 'reject':
        onReject(inputValue.trim() || undefined);
        break;
      case 'waitlist':
        onWaitlist();
        break;
    }
    setInputValue('');
  }, [action, inputValue, onConfirm, onReject, onWaitlist]);

  if (!applicant) return null;

  return (
    <Modal
      visible={visible}
      onClose={handleClose}
      title={config.title}
      position="center"
    >
      <View className="p-4">
        {/* 지원자 정보 */}
        <View className="flex-row items-center p-4 bg-gray-50 dark:bg-gray-800 rounded-xl mb-4">
          <Avatar
            name={applicant.applicantName}
            size="lg"
            className="mr-4"
          />
          <View className="flex-1">
            <Text className="text-lg font-semibold text-gray-900 dark:text-white">
              {applicant.applicantName}
            </Text>
            <Text className="text-sm text-gray-500 dark:text-gray-400">
              {ROLE_LABELS[applicant.appliedRole] || applicant.appliedRole} 지원
            </Text>
            {applicant.applicantPhone && (
              <Text className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {applicant.applicantPhone}
              </Text>
            )}
          </View>
        </View>

        {/* 지원 메시지 */}
        {applicant.message && (
          <View className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg mb-4">
            <Text className="text-sm text-gray-600 dark:text-gray-300 mb-1 font-medium">
              지원 메시지
            </Text>
            <Text className="text-sm text-gray-700 dark:text-gray-200">
              {applicant.message}
            </Text>
          </View>
        )}

        {/* 설명 */}
        <View className="flex-row items-center mb-4">
          <AlertCircleIcon
            size={20}
            color={action === 'reject' ? '#EF4444' : action === 'confirm' ? '#2563EB' : '#7C3AED'}
          />
          <Text className="ml-2 text-sm text-gray-600 dark:text-gray-300">
            {config.description}
          </Text>
        </View>

        {/* 확정 시 안내 */}
        {action === 'confirm' && (
          <View className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg mb-4">
            <Text className="text-sm text-green-700 dark:text-green-300">
              확정 시 해당 지원자의 근무 일지(WorkLog)가 자동 생성됩니다.
            </Text>
          </View>
        )}

        {/* 대기열 안내 */}
        {action === 'waitlist' && (
          <View className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg mb-4">
            <Text className="text-sm text-purple-700 dark:text-purple-300">
              대기열에 추가된 지원자는 정원에 공석이 생기면 확정으로 승격할 수 있습니다.
            </Text>
          </View>
        )}

        {/* 입력 필드 */}
        {config.showTextInput && (
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {config.inputLabel}
            </Text>
            <TextInput
              value={inputValue}
              onChangeText={setInputValue}
              placeholder={config.inputPlaceholder}
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white min-h-[80px]"
            />
          </View>
        )}

        {/* 버튼 */}
        <View className="flex-row gap-3">
          <Button
            variant="secondary"
            onPress={handleClose}
            disabled={isLoading}
            className="flex-1"
          >
            취소
          </Button>
          <Button
            variant={config.buttonVariant}
            onPress={handleAction}
            loading={isLoading}
            className="flex-1"
          >
            {config.buttonText}
          </Button>
        </View>
      </View>
    </Modal>
  );
}

export default ApplicantConfirmModal;

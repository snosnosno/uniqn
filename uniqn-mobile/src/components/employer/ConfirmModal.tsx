/**
 * UNIQN Mobile - 확인/거절 모달 컴포넌트
 *
 * @description 지원자 확정 또는 거절 시 사용하는 모달
 * @version 1.1.0
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, TextInput, ScrollView } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { AlertCircleIcon, CalendarIcon, ClockIcon, BriefcaseIcon } from '../icons';
import { getUserProfile } from '@/services';
import { formatDateShort } from '@/utils/dateUtils';
import { getAssignmentRoles } from '@/types/assignment';
import type { ApplicantWithDetails } from '@/services';
import type { Assignment } from '@/types';
import { getRoleDisplayName } from '@/types/unified';

// ============================================================================
// Types
// ============================================================================

export type ConfirmModalAction = 'confirm' | 'reject';

export interface ApplicantConfirmModalProps {
  visible: boolean;
  onClose: () => void;
  applicant: ApplicantWithDetails | null;
  action: ConfirmModalAction;
  onConfirm: (notes?: string) => void;
  onReject: (reason?: string) => void;
  isLoading?: boolean;
  /** 선택된 일정 (확정 시 표시) */
  selectedAssignments?: Assignment[];
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
  isLoading = false,
  selectedAssignments,
}: ApplicantConfirmModalProps) {
  const [inputValue, setInputValue] = useState('');
  const config = ACTION_CONFIG[action];
  // 다크모드 감지 (앱 테마 스토어 사용)
  const { isDarkMode: isDark } = useThemeStore();

  // 지원자 프로필 사진 조회
  const { data: userProfile } = useQuery({
    queryKey: queryKeys.user.profile(applicant?.applicantId ?? ''),
    queryFn: () => getUserProfile(applicant!.applicantId),
    enabled: !!applicant?.applicantId && visible,
    staleTime: 5 * 60 * 1000,
  });

  // 선택된 일정 포맷팅
  const formattedAssignments = useMemo(() => {
    if (!selectedAssignments || selectedAssignments.length === 0) {
      return [];
    }

    return selectedAssignments.map((assignment, idx) => {
      const roleList = getAssignmentRoles(assignment);
      const roles = roleList.map(r => getRoleDisplayName(r)).join(', ');
      // dates 배열에서 첫 번째 날짜 사용 (또는 날짜 범위 표시)
      const dateStr = assignment.dates?.length > 0
        ? assignment.dates.length === 1
          ? formatDateShort(assignment.dates[0]!)
          : `${formatDateShort(assignment.dates[0]!)} ~ ${formatDateShort(assignment.dates[assignment.dates.length - 1]!)}`
        : '';
      const timeSlot = assignment.timeSlot || '';

      return {
        id: `${idx}-${assignment.dates?.join('-')}-${assignment.timeSlot}-${roleList.join('-')}`,
        date: dateStr,
        timeSlot,
        roles,
      };
    });
  }, [selectedAssignments]);

  // 표시 이름: 프로필 이름 우선, 닉네임이 있으면 "이름(닉네임)" 형식
  const displayName = useMemo(() => {
    const baseName = userProfile?.name || applicant?.applicantName || '';
    if (userProfile?.nickname && userProfile.nickname !== baseName) {
      return `${baseName}(${userProfile.nickname})`;
    }
    return baseName;
  }, [userProfile, applicant?.applicantName]);

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
    }
    setInputValue('');
  }, [action, inputValue, onConfirm, onReject]);

  if (!applicant) return null;

  return (
    <Modal
      visible={visible}
      onClose={handleClose}
      title={config.title}
      position="center"
    >
      <View>
        {/* 지원자 정보 */}
        <View className="flex-row items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-xl mb-3">
          <Avatar
            source={userProfile?.photoURL}
            name={displayName}
            size="lg"
            className="mr-4"
          />
          <View className="flex-1">
            <Text className="text-lg font-semibold text-gray-900 dark:text-white">
              {displayName}
            </Text>
            <Text className="text-sm text-gray-500 dark:text-gray-400">
              {getRoleDisplayName(applicant.appliedRole, applicant.customRole)} 지원
            </Text>
            {applicant.applicantPhone && (
              <Text className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {applicant.applicantPhone}
              </Text>
            )}
          </View>
        </View>

        {/* 선택된 일정 표시 (확정 시) */}
        {action === 'confirm' && formattedAssignments.length > 0 && (
          <View className="mb-3">
            <Text className={`text-sm font-medium mb-1.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              확정할 일정 ({formattedAssignments.length}건)
            </Text>
            <ScrollView
              className="max-h-36"
              showsVerticalScrollIndicator={true}
            >
              {formattedAssignments.map((item) => (
                <View
                  key={item.id}
                  className={`flex-row items-center p-3 rounded-lg mb-2 ${
                    isDark ? 'bg-blue-900 border border-blue-700' : 'bg-blue-50 border border-blue-200'
                  }`}
                >
                  <CalendarIcon
                    size={16}
                    color={isDark ? '#93C5FD' : '#2563EB'}
                  />
                  <Text className={`ml-2 text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {item.date}
                  </Text>
                  {item.timeSlot && (
                    <View className="flex-row items-center ml-3">
                      <ClockIcon
                        size={14}
                        color={isDark ? '#9CA3AF' : '#6B7280'}
                      />
                      <Text className={`ml-1 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        {item.timeSlot}
                      </Text>
                    </View>
                  )}
                  {item.roles && (
                    <View className="flex-row items-center ml-3">
                      <BriefcaseIcon
                        size={14}
                        color={isDark ? '#9CA3AF' : '#6B7280'}
                      />
                      <Text className={`ml-1 text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        {item.roles}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* 지원 메시지 */}
        {applicant.message && (
          <View className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg mb-3">
            <Text className="text-xs text-gray-600 dark:text-gray-300 mb-0.5 font-medium">
              지원 메시지
            </Text>
            <Text className="text-sm text-gray-700 dark:text-gray-200">
              {applicant.message}
            </Text>
          </View>
        )}

        {/* 설명 */}
        <View className="flex-row items-center mb-3">
          <AlertCircleIcon
            size={20}
            color={action === 'reject' ? '#EF4444' : '#2563EB'}
          />
          <Text className="ml-2 text-sm text-gray-600 dark:text-gray-300">
            {config.description}
          </Text>
        </View>

        {/* 입력 필드 */}
        {config.showTextInput && (
          <View className="mb-3">
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {config.inputLabel}
            </Text>
            <TextInput
              value={inputValue}
              onChangeText={setInputValue}
              placeholder={config.inputPlaceholder}
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={2}
              textAlignVertical="top"
              className="p-2.5 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white min-h-[60px]"
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

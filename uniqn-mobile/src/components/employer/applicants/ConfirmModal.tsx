/**
 * UNIQN Mobile - 확인/거절 모달 컴포넌트
 *
 * @description 지원자 확정 또는 거절 시 사용하는 모달
 * @version 1.1.0
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, TextInput, ScrollView } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { AlertCircleIcon, CalendarIcon, ClockIcon, BriefcaseIcon } from '@/components/icons';
import { useUserProfile } from '@/hooks/useUserProfile';
import { formatDateShort } from '@/utils/date';
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
  /**
   * 지원자가 원래 신청한 전체 일정 수. 선택분보다 많으면 부분 확정 경고를 띄운다(APPL-1).
   * 부분 확정은 UI 의 기본 경로(초기 선택 0건)라, 사장이 의도를 모른 채 축소 확정하기 쉽다.
   */
  totalAssignmentCount?: number;
}

// ============================================================================
// Constants
// ============================================================================

const ACTION_CONFIG: Record<
  ConfirmModalAction,
  {
    title: string;
    description: string;
    buttonText: string;
    buttonVariant: 'primary' | 'danger' | 'secondary';
    showTextInput: boolean;
    inputLabel: string;
    inputPlaceholder: string;
    /** 서버 zod 한도와 동일 — 초과 입력 자체를 막는다. TextInput 하나가 두 액션을 겸하므로 액션별로 갈린다. */
    inputMaxLength: number;
  }
> = {
  confirm: {
    title: '지원자 확정',
    description: '이 지원자를 확정하시겠습니까?',
    buttonText: '확정하기',
    buttonVariant: 'primary',
    showTextInput: true,
    inputLabel: '메모 (선택)',
    inputPlaceholder: '추가 메모를 입력하세요',
    // application.schema.ts:76 notes max(500)
    inputMaxLength: 500,
  },
  reject: {
    title: '지원자 거절',
    description: '이 지원자를 거절하시겠습니까?',
    buttonText: '거절하기',
    buttonVariant: 'danger',
    showTextInput: true,
    inputLabel: '거절 사유 (선택)',
    inputPlaceholder: '거절 사유를 입력하세요',
    // application.schema.ts:90 reject reason max(200)
    inputMaxLength: 200,
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
  totalAssignmentCount,
}: ApplicantConfirmModalProps) {
  const [inputValue, setInputValue] = useState('');
  const config = ACTION_CONFIG[action];
  // 다크모드 감지 (앱 테마 스토어 사용)
  const { isDarkMode: isDark } = useThemeStore();

  // 지원자 프로필 조회
  const { displayName, profilePhotoURL, profilePhotoURLBlurhash } = useUserProfile({
    userId: applicant?.applicantId,
    enabled: visible,
    fallbackName: applicant?.applicantName,
    fallbackNickname: applicant?.applicantNickname,
    fallbackPhotoURL: applicant?.applicantPhotoURL,
    fallbackPhotoURLBlurhash: applicant?.applicantPhotoURLBlurhash,
  });

  // 선택된 일정 포맷팅
  const formattedAssignments = useMemo(() => {
    if (!selectedAssignments || selectedAssignments.length === 0) {
      return [];
    }

    return selectedAssignments.map((assignment, idx) => {
      const roleList = getAssignmentRoles(assignment);
      const roles = roleList.map((r) => getRoleDisplayName(r)).join(', ');
      // dates 배열에서 첫 번째 날짜 사용 (또는 날짜 범위 표시)
      const firstDate = assignment.dates?.[0];
      const lastDate = assignment.dates?.[assignment.dates.length - 1];
      const formattedFirstDate = formatDateShort(firstDate ?? null);
      const formattedLastDate = formatDateShort(lastDate ?? null);
      const dateStr =
        assignment.dates?.length > 0
          ? assignment.dates.length === 1
            ? formattedFirstDate
            : `${formattedFirstDate} ~ ${formattedLastDate}`
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

  // 모달 닫기 시 입력값 초기화
  const handleClose = useCallback(() => {
    setInputValue('');
    onClose();
  }, [onClose]);

  // ⚠️ 이 모달은 조건부 렌더가 아니라 **상시 마운트**다(visible=false 도 언마운트가 아니다).
  //    성공 경로는 호출부가 부모 state 만 내리므로 handleClose 를 타지 않아, 닫힐 때 여기서
  //    지우지 않으면 지원자 A 의 거절 사유가 지원자 B 의 확정 메모로 이월된다.
  //    TextInput 하나가 두 액션을 겸하므로 액션 축까지 넘어간다.
  useEffect(() => {
    if (!visible) setInputValue('');
  }, [visible]);

  // 액션 실행 — 여기서 입력을 지우지 않는다. 옛 코드는 제출 직후 `setInputValue('')` 로
  // 비웠고 호출부는 동기적으로 모달을 닫아, 실패하면 사용자가 쓴 사유가 통째로 사라졌다.
  // 초기화는 실제로 닫힐 때(handleClose)만 한다.
  const handleAction = useCallback(() => {
    switch (action) {
      case 'confirm':
        onConfirm(inputValue.trim() || undefined);
        break;
      case 'reject':
        onReject(inputValue.trim() || undefined);
        break;
    }
  }, [action, inputValue, onConfirm, onReject]);

  if (!applicant) return null;

  // 액션은 footer prop 으로 — 지원자 메시지 길이가 가변이라 children 끝에 두면
  // 본문이 길 때 버튼이 스크롤 아래로 밀린다(2026-07-25).
  const actionFooter = (
    <View className="flex-row gap-3">
      <Button variant="secondary" onPress={handleClose} disabled={isLoading} className="flex-1">
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
  );

  return (
    <Modal
      visible={visible}
      onClose={handleClose}
      title={config.title}
      position="center"
      footer={actionFooter}
    >
      <View>
        {/* 지원자 정보 */}
        <View className="flex-row items-center p-3 bg-surface-page dark:bg-surface rounded-md mb-3">
          <Avatar
            source={profilePhotoURL}
            name={displayName}
            size="lg"
            className="mr-4"
            blurhash={profilePhotoURLBlurhash}
          />
          <View className="flex-1">
            <Text className="text-lg font-display-semibold text-content-primary dark:text-off-white">
              {displayName}
            </Text>
            <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
              {getRoleDisplayName(
                applicant.assignments[0]?.roleIds?.[0] || 'other',
                applicant.customRole
              )}{' '}
              지원
            </Text>
            {applicant.applicantPhone && (
              <Text className="text-sm text-secondary-500 dark:text-secondary-400 mt-1 font-sans">
                {applicant.applicantPhone}
              </Text>
            )}
          </View>
        </View>

        {/* 선택된 일정 표시 (확정 시) */}
        {action === 'confirm' && formattedAssignments.length > 0 && (
          <View className="mb-3">
            <Text
              className={`text-sm font-sans-medium mb-1.5 ${isDark ? 'text-secondary-300' : 'text-secondary-700'}`}
            >
              확정할 일정 ({formattedAssignments.length}건)
            </Text>
            {/* 부분 확정 경고 — 선택하지 않은 일정은 확정에서 빠지고, 확정 해제 전까지
                지원자에게도 그 자리가 남지 않는다. 기본 경로라 침묵하면 사고가 된다. */}
            {typeof totalAssignmentCount === 'number' &&
              totalAssignmentCount > formattedAssignments.length && (
                <Text className="mb-1.5 text-xs text-warning-700 dark:text-warning-400 font-sans">
                  선택하지 않은 {totalAssignmentCount - formattedAssignments.length}개 일정은
                  확정에서 제외돼요. 나중에 확정을 해제하면 다시 선택할 수 있어요.
                </Text>
              )}
            <ScrollView className="max-h-36" showsVerticalScrollIndicator={true}>
              {formattedAssignments.map((item) => (
                <View
                  key={item.id}
                  className={`flex-row items-center p-3 rounded-lg mb-2 ${
                    isDark
                      ? 'bg-primary-900 border border-primary-700'
                      : 'bg-primary-50 border border-primary-200'
                  }`}
                >
                  <CalendarIcon size={16} color={isDark ? '#E8C84E' : '#B8962E'} />
                  <Text
                    className={`ml-2 text-sm font-sans-medium ${isDark ? 'text-white' : 'text-secondary-900'}`}
                  >
                    {item.date}
                  </Text>
                  {item.timeSlot && (
                    <View className="flex-row items-center ml-3">
                      <ClockIcon
                        size={14}
                        color={isDark ? SECONDARY_PALETTE[400] : SECONDARY_PALETTE[500]}
                      />
                      <Text
                        className={`ml-1 text-sm ${isDark ? 'text-secondary-300' : 'text-secondary-600'} font-sans`}
                      >
                        {item.timeSlot}
                      </Text>
                    </View>
                  )}
                  {item.roles && (
                    <View className="flex-row items-center ml-3">
                      <BriefcaseIcon
                        size={14}
                        color={isDark ? SECONDARY_PALETTE[400] : SECONDARY_PALETTE[500]}
                      />
                      <Text
                        className={`ml-1 text-sm ${isDark ? 'text-secondary-300' : 'text-secondary-600'} font-sans`}
                      >
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
          <View className="p-2.5 bg-primary-50 dark:bg-primary-900/20 rounded-lg mb-3">
            <Text className="text-xs text-content-muted dark:text-secondary-300 mb-0.5 font-sans-medium">
              지원 메시지
            </Text>
            <Text className="text-sm text-content-secondary dark:text-secondary-200 font-sans">
              {applicant.message}
            </Text>
          </View>
        )}

        {/* 설명 */}
        <View className="flex-row items-center mb-3">
          <AlertCircleIcon size={20} color={action === 'reject' ? '#DC2626' : '#B8962E'} />
          <Text className="ml-2 text-sm text-content-muted dark:text-secondary-300 font-sans">
            {config.description}
          </Text>
        </View>

        {/* 입력 필드 */}
        {config.showTextInput && (
          <View className="mb-3">
            <Text className="text-sm font-sans-medium text-content-secondary mb-1.5">
              {config.inputLabel}
            </Text>
            <TextInput
              value={inputValue}
              onChangeText={setInputValue}
              placeholder={config.inputPlaceholder}
              placeholderTextColor={SECONDARY_PALETTE[400]}
              multiline
              numberOfLines={2}
              maxLength={config.inputMaxLength}
              editable={!isLoading}
              textAlignVertical="top"
              className="p-2.5 border border-divider rounded-lg bg-surface-card text-content-primary dark:text-off-white min-h-[60px]"
            />
            <Text className="text-xs text-content-placeholder text-right mt-1 font-sans">
              {inputValue.length}/{config.inputMaxLength}
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

/**
 * UNIQN Mobile - 지원자 카드 컴포넌트
 *
 * @description 구인자가 지원자 정보를 확인하는 카드
 * @version 1.0.0
 */

import React, { useMemo, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import { PhoneIcon, ClockIcon, MessageIcon, CheckIcon, XMarkIcon, UserPlusIcon } from '../icons';
import { ConfirmationHistoryTimeline } from '../applicant/ConfirmationHistoryTimeline';
import { APPLICATION_STATUS_LABELS } from '@/types';
import { formatRelativeTime } from '@/utils/dateUtils';
import type { ApplicantWithDetails } from '@/services';
import type { ApplicationStatus, StaffRole } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface ApplicantCardProps {
  applicant: ApplicantWithDetails;
  onPress?: (applicant: ApplicantWithDetails) => void;
  onConfirm?: (applicant: ApplicantWithDetails) => void;
  onReject?: (applicant: ApplicantWithDetails) => void;
  onWaitlist?: (applicant: ApplicantWithDetails) => void;
  /** 확정 취소 (confirmed 상태에서만 사용) */
  onCancelConfirmation?: (applicant: ApplicantWithDetails) => void;
  /** 스태프로 변환 (confirmed 상태에서만 사용) */
  onConvertToStaff?: (applicant: ApplicantWithDetails) => void;
  showActions?: boolean;
  /** 확정 이력 표시 여부 */
  showConfirmationHistory?: boolean;
  isSelected?: boolean;
  selectionMode?: boolean;
  onSelect?: (applicant: ApplicantWithDetails) => void;
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_BADGE_VARIANT: Record<ApplicationStatus, 'default' | 'primary' | 'success' | 'warning' | 'error'> = {
  applied: 'primary',
  pending: 'warning',
  confirmed: 'success',
  rejected: 'error',
  cancelled: 'default',
  waitlisted: 'primary',
  completed: 'success',
  cancellation_pending: 'warning',
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

export const ApplicantCard = React.memo(function ApplicantCard({
  applicant,
  onPress,
  onConfirm,
  onReject,
  onWaitlist,
  onCancelConfirmation,
  onConvertToStaff,
  showActions = true,
  showConfirmationHistory = true,
  isSelected = false,
  selectionMode = false,
  onSelect,
}: ApplicantCardProps) {
  // 지원일 계산
  const appliedTimeAgo = useMemo(() => {
    if (!applicant.createdAt) return '';

    const date = typeof applicant.createdAt === 'string'
      ? new Date(applicant.createdAt)
      : applicant.createdAt instanceof Date
        ? applicant.createdAt
        : applicant.createdAt.toDate();

    return formatRelativeTime(date);
  }, [applicant.createdAt]);

  // 카드 클릭 핸들러
  const handlePress = useCallback(() => {
    if (selectionMode && onSelect) {
      onSelect(applicant);
    } else if (onPress) {
      onPress(applicant);
    }
  }, [applicant, onPress, onSelect, selectionMode]);

  // 확정 핸들러
  const handleConfirm = useCallback(() => {
    onConfirm?.(applicant);
  }, [applicant, onConfirm]);

  // 거절 핸들러
  const handleReject = useCallback(() => {
    onReject?.(applicant);
  }, [applicant, onReject]);

  // 대기열 핸들러
  const handleWaitlist = useCallback(() => {
    onWaitlist?.(applicant);
  }, [applicant, onWaitlist]);

  // 확정 취소 핸들러
  const handleCancelConfirmation = useCallback(() => {
    onCancelConfirmation?.(applicant);
  }, [applicant, onCancelConfirmation]);

  // 스태프 변환 핸들러
  const handleConvertToStaff = useCallback(() => {
    onConvertToStaff?.(applicant);
  }, [applicant, onConvertToStaff]);

  // 확정 상태 액션 표시 여부
  const canShowConfirmedActions = showActions &&
    applicant.status === 'confirmed' &&
    (onCancelConfirmation || onConvertToStaff);

  // 액션 버튼 표시 여부
  const canShowActions = showActions &&
    (applicant.status === 'applied' || applicant.status === 'pending');

  return (
    <Card
      variant={isSelected ? 'outlined' : 'elevated'}
      padding="md"
      onPress={handlePress}
      className={isSelected ? 'border-primary-500' : ''}
    >
      {/* 선택 모드 체크박스 */}
      {selectionMode && (
        <View className="absolute right-3 top-3">
          <View className={`
            h-5 w-5 rounded-full border-2 items-center justify-center
            ${isSelected
              ? 'bg-primary-500 border-primary-500'
              : 'border-gray-300 dark:border-gray-600'}
          `}>
            {isSelected && <CheckIcon size={12} color="#fff" />}
          </View>
        </View>
      )}

      {/* 헤더: 프로필 + 이름 + 상태 */}
      <View className="flex-row items-center mb-3">
        <Avatar
          name={applicant.applicantName}
          size="md"
          className="mr-3"
        />
        <View className="flex-1">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-semibold text-gray-900 dark:text-white">
              {applicant.applicantName}
            </Text>
            <Badge
              variant={STATUS_BADGE_VARIANT[applicant.status]}
              size="sm"
              dot
            >
              {APPLICATION_STATUS_LABELS[applicant.status]}
            </Badge>
          </View>
          <Text className="text-sm text-gray-500 dark:text-gray-400">
            {ROLE_LABELS[applicant.appliedRole] || applicant.appliedRole} 지원
          </Text>
        </View>
      </View>

      {/* 정보 섹션 */}
      <View className="space-y-2 mb-3">
        {/* 연락처 */}
        {applicant.applicantPhone && (
          <View className="flex-row items-center">
            <PhoneIcon size={14} color="#9CA3AF" />
            <Text className="ml-2 text-sm text-gray-600 dark:text-gray-400">
              {applicant.applicantPhone}
            </Text>
          </View>
        )}

        {/* 지원일 */}
        <View className="flex-row items-center">
          <ClockIcon size={14} color="#9CA3AF" />
          <Text className="ml-2 text-sm text-gray-600 dark:text-gray-400">
            {appliedTimeAgo}
          </Text>
          {!applicant.isRead && (
            <View className="ml-2 h-2 w-2 rounded-full bg-primary-500" />
          )}
        </View>

        {/* 지원 메시지 */}
        {applicant.message && (
          <View className="flex-row items-start mt-2">
            <MessageIcon size={14} color="#9CA3AF" />
            <Text
              className="ml-2 text-sm text-gray-600 dark:text-gray-400 flex-1"
              numberOfLines={2}
            >
              {applicant.message}
            </Text>
          </View>
        )}
      </View>

      {/* 대기자 순번 */}
      {applicant.status === 'waitlisted' && applicant.waitlistOrder && (
        <View className="bg-purple-50 dark:bg-purple-900/20 rounded-lg px-3 py-2 mb-3">
          <Text className="text-sm text-purple-700 dark:text-purple-300">
            대기 순번: {applicant.waitlistOrder}번
          </Text>
        </View>
      )}

      {/* 거절 사유 */}
      {applicant.status === 'rejected' && applicant.rejectionReason && (
        <View className="bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2 mb-3">
          <Text className="text-sm text-red-700 dark:text-red-300">
            거절 사유: {applicant.rejectionReason}
          </Text>
        </View>
      )}

      {/* 확정 이력 타임라인 (confirmed 상태일 때만) */}
      {showConfirmationHistory &&
        applicant.status === 'confirmed' &&
        applicant.confirmationHistory &&
        applicant.confirmationHistory.length > 0 && (
          <View className="mb-3">
            <ConfirmationHistoryTimeline
              history={applicant.confirmationHistory}
              compact
            />
          </View>
        )}

      {/* 확정 상태 액션 버튼 */}
      {canShowConfirmedActions && !selectionMode && (
        <View className="flex-row mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          {/* 확정 취소 버튼 */}
          {onCancelConfirmation && (
            <Pressable
              onPress={handleCancelConfirmation}
              className="flex-1 flex-row items-center justify-center py-2 mr-2 rounded-lg bg-gray-100 dark:bg-gray-700 active:opacity-70"
            >
              <XMarkIcon size={16} color="#EF4444" />
              <Text className="ml-1 text-sm font-medium text-error-600 dark:text-error-400">
                확정 취소
              </Text>
            </Pressable>
          )}

          {/* 스태프 변환 버튼 */}
          {onConvertToStaff && (
            <Pressable
              onPress={handleConvertToStaff}
              className="flex-1 flex-row items-center justify-center py-2 rounded-lg bg-primary-500 active:opacity-70"
            >
              <UserPlusIcon size={16} color="#fff" />
              <Text className="ml-1 text-sm font-medium text-white">
                스태프 변환
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {/* 액션 버튼 */}
      {canShowActions && !selectionMode && (
        <View className="flex-row mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          {/* 거절 버튼 */}
          <Pressable
            onPress={handleReject}
            className="flex-1 flex-row items-center justify-center py-2 mr-2 rounded-lg bg-gray-100 dark:bg-gray-700 active:opacity-70"
          >
            <XMarkIcon size={16} color="#EF4444" />
            <Text className="ml-1 text-sm font-medium text-error-600 dark:text-error-400">
              거절
            </Text>
          </Pressable>

          {/* 대기열 버튼 */}
          {onWaitlist && (
            <Pressable
              onPress={handleWaitlist}
              className="flex-1 flex-row items-center justify-center py-2 mr-2 rounded-lg bg-purple-50 dark:bg-purple-900/20 active:opacity-70"
            >
              <Text className="text-sm font-medium text-purple-600 dark:text-purple-400">
                대기열
              </Text>
            </Pressable>
          )}

          {/* 확정 버튼 */}
          <Pressable
            onPress={handleConfirm}
            className="flex-1 flex-row items-center justify-center py-2 rounded-lg bg-primary-500 active:opacity-70"
          >
            <CheckIcon size={16} color="#fff" />
            <Text className="ml-1 text-sm font-medium text-white">
              확정
            </Text>
          </Pressable>
        </View>
      )}
    </Card>
  );
});

export default ApplicantCard;

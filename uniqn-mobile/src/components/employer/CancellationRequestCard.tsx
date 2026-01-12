/**
 * UNIQN Mobile - 취소 요청 카드 컴포넌트
 *
 * @description 구인자가 스태프의 취소 요청을 검토하는 카드 (v2.0 - 날짜/시간대 표시)
 * @version 2.0.0
 */

import React, { useMemo, useCallback, useState } from 'react';
import { View, Text, Pressable, TextInput, Modal } from 'react-native';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { ClockIcon, MessageIcon, CheckIcon, XMarkIcon, CalendarIcon } from '../icons';
import { formatRelativeTime } from '@/utils/dateUtils';
import type { Application, CancellationRequestStatus } from '@/types';
import { ROLE_LABELS } from '@/constants';

// ============================================================================
// Types
// ============================================================================

export interface CancellationRequestCardProps {
  /** 취소 요청이 있는 지원서 */
  application: Application;
  /** 승인 버튼 클릭 */
  onApprove: (applicationId: string) => void;
  /** 거절 버튼 클릭 (거절 사유 포함) */
  onReject: (applicationId: string, reason: string) => void;
  /** 처리 중 여부 */
  isProcessing?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * 역할 라벨 가져오기 (커스텀 역할 지원 v2.0)
 */
function getRoleLabel(role: string, customRole?: string): string {
  if (role === 'other' && customRole) {
    return customRole;
  }
  return ROLE_LABELS[role] || role;
}

/**
 * 지원 날짜 포맷 (M/D 형식 v2.0)
 */
function formatAppliedDate(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
  return `${month}/${day}(${dayOfWeek})`;
}

const STATUS_COLORS: Record<CancellationRequestStatus, { bg: string; text: string }> = {
  pending: { bg: 'bg-warning-100 dark:bg-warning-900/30', text: 'text-warning-700 dark:text-warning-300' },
  approved: { bg: 'bg-success-100 dark:bg-success-900/30', text: 'text-success-700 dark:text-success-300' },
  rejected: { bg: 'bg-error-100 dark:bg-error-900/30', text: 'text-error-700 dark:text-error-300' },
};

const STATUS_LABELS: Record<CancellationRequestStatus, string> = {
  pending: '검토 대기',
  approved: '승인됨',
  rejected: '거절됨',
};

// ============================================================================
// Component
// ============================================================================

export const CancellationRequestCard = React.memo(function CancellationRequestCard({
  application,
  onApprove,
  onReject,
  isProcessing = false,
}: CancellationRequestCardProps) {
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const cancellationRequest = application.cancellationRequest;

  // 요청 시간 계산
  const requestTimeAgo = useMemo(() => {
    if (!cancellationRequest?.requestedAt) return '';
    return formatRelativeTime(new Date(cancellationRequest.requestedAt));
  }, [cancellationRequest?.requestedAt]);

  // 승인 핸들러
  const handleApprove = useCallback(() => {
    onApprove(application.id);
  }, [application.id, onApprove]);

  // 거절 모달 열기
  const handleOpenRejectModal = useCallback(() => {
    setShowRejectModal(true);
  }, []);

  // 거절 모달 닫기
  const handleCloseRejectModal = useCallback(() => {
    setShowRejectModal(false);
    setRejectionReason('');
  }, []);

  // 거절 제출
  const handleSubmitReject = useCallback(() => {
    if (rejectionReason.trim().length >= 3) {
      onReject(application.id, rejectionReason.trim());
      handleCloseRejectModal();
    }
  }, [application.id, rejectionReason, onReject, handleCloseRejectModal]);

  // 취소 요청이 없으면 렌더링하지 않음
  if (!cancellationRequest) {
    return null;
  }

  const isPending = cancellationRequest.status === 'pending';
  const statusColors = STATUS_COLORS[cancellationRequest.status];

  return (
    <>
      <Card variant="elevated" padding="md">
        {/* 헤더: 지원자 정보 + 상태 */}
        <View className="flex-row items-center mb-3">
          <Avatar
            name={application.applicantName}
            size="md"
            className="mr-3"
          />
          <View className="flex-1">
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-semibold text-gray-900 dark:text-white">
                {application.applicantName}
              </Text>
              <Badge
                variant={isPending ? 'warning' : cancellationRequest.status === 'approved' ? 'success' : 'error'}
                size="sm"
                dot
              >
                {STATUS_LABELS[cancellationRequest.status]}
              </Badge>
            </View>
            <Text className="text-sm text-gray-500 dark:text-gray-400">
              {getRoleLabel(application.appliedRole, application.customRole)} 역할
            </Text>
          </View>
        </View>

        {/* 취소 대상 일정 표시 (v2.0) */}
        {(application.appliedDate || application.appliedTimeSlot) && (
          <View className="flex-row items-center bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2 mb-3">
            <CalendarIcon size={14} color="#DC2626" />
            <Text className="ml-2 text-sm text-red-700 dark:text-red-300">
              취소 대상: {formatAppliedDate(application.appliedDate)}
              {application.appliedTimeSlot && ` ${application.appliedTimeSlot}`}
            </Text>
          </View>
        )}

        {/* 공고 정보 */}
        <View className="bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2 mb-3">
          <Text className="text-sm text-gray-600 dark:text-gray-400">
            {application.jobPostingTitle ?? application.jobPosting?.title ?? '공고'}
          </Text>
          <Text className="text-xs text-gray-400 dark:text-gray-500">
            {application.jobPostingDate ?? application.jobPosting?.workDate ?? '-'}
          </Text>
        </View>

        {/* 취소 요청 사유 */}
        <View className="mb-3">
          <View className="flex-row items-center mb-1">
            <MessageIcon size={14} color="#9CA3AF" />
            <Text className="ml-1 text-xs font-medium text-gray-500 dark:text-gray-400">
              취소 사유
            </Text>
          </View>
          <View className="bg-orange-50 dark:bg-orange-900/20 rounded-lg px-3 py-2">
            <Text className="text-sm text-orange-800 dark:text-orange-200">
              {cancellationRequest.reason}
            </Text>
          </View>
        </View>

        {/* 요청 시간 */}
        <View className="flex-row items-center mb-3">
          <ClockIcon size={14} color="#9CA3AF" />
          <Text className="ml-2 text-sm text-gray-500 dark:text-gray-400">
            {requestTimeAgo}
          </Text>
        </View>

        {/* 검토 결과 표시 (처리 완료 시) */}
        {!isPending && cancellationRequest.rejectionReason && (
          <View className={`${statusColors.bg} rounded-lg px-3 py-2 mb-3`}>
            <Text className={`text-sm ${statusColors.text}`}>
              거절 사유: {cancellationRequest.rejectionReason}
            </Text>
          </View>
        )}

        {/* 액션 버튼 (pending 상태일 때만) */}
        {isPending && (
          <View className="flex-row mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            {/* 거절 버튼 */}
            <Pressable
              onPress={handleOpenRejectModal}
              disabled={isProcessing}
              className={`
                flex-1 flex-row items-center justify-center py-2 mr-2
                rounded-lg bg-gray-100 dark:bg-gray-700 active:opacity-70
                ${isProcessing ? 'opacity-50' : ''}
              `}
            >
              <XMarkIcon size={16} color="#EF4444" />
              <Text className="ml-1 text-sm font-medium text-error-600 dark:text-error-400">
                거절
              </Text>
            </Pressable>

            {/* 승인 버튼 */}
            <Pressable
              onPress={handleApprove}
              disabled={isProcessing}
              className={`
                flex-1 flex-row items-center justify-center py-2
                rounded-lg bg-primary-500 active:opacity-70
                ${isProcessing ? 'opacity-50' : ''}
              `}
            >
              <CheckIcon size={16} color="#fff" />
              <Text className="ml-1 text-sm font-medium text-white">
                승인
              </Text>
            </Pressable>
          </View>
        )}
      </Card>

      {/* 거절 사유 입력 모달 */}
      <Modal
        visible={showRejectModal}
        animationType="fade"
        transparent
        onRequestClose={handleCloseRejectModal}
      >
        <View className="flex-1 bg-black/50 items-center justify-center p-4">
          <View className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm p-5">
            {/* 모달 헤더 */}
            <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              취소 요청 거절
            </Text>
            <Text className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              거절 사유를 입력해주세요.
            </Text>

            {/* 거절 사유 입력 */}
            <TextInput
              value={rejectionReason}
              onChangeText={setRejectionReason}
              placeholder="최소 3자 이상 입력해주세요"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={3}
              maxLength={200}
              className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-gray-900 dark:text-white text-base min-h-[80px] mb-4"
              textAlignVertical="top"
            />
            <Text className="text-xs text-gray-400 dark:text-gray-500 text-right mb-4">
              {rejectionReason.length}/200
            </Text>

            {/* 버튼 */}
            <View className="flex-row gap-3">
              <Button
                onPress={handleCloseRejectModal}
                variant="outline"
                className="flex-1"
              >
                취소
              </Button>
              <Button
                onPress={handleSubmitReject}
                disabled={rejectionReason.trim().length < 3}
                className="flex-1"
              >
                거절하기
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
});

export default CancellationRequestCard;

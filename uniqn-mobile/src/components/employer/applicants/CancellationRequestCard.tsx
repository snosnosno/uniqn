/**
 * UNIQN Mobile - 취소 요청 카드 컴포넌트
 *
 * @description 구인자가 스태프의 취소 요청을 검토하는 카드 (v2.0 - 날짜/시간대 표시)
 * @version 2.0.0
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { useMemo, useCallback, useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { Card } from '../../ui/Card';
import { CardStripe } from '../../ui/CardStripe';
import { Modal } from '../../ui/Modal';
import { Badge } from '../../ui/Badge';
import { Avatar } from '../../ui/Avatar';
import { ModalFooterButtons } from '../../ui/ModalFooterButtons';
import { NumericText } from '../../ui/NumericText';
import { ClockIcon, MessageIcon, CheckIcon, XMarkIcon, CalendarIcon } from '../../icons';
import { STATUS } from '@/constants';
import { useUserProfile } from '@/hooks/useUserProfile';
import { formatAppliedDate, formatRelativeTime } from '@/utils/date';
import { getRoleDisplayName } from '@/types/unified';
import type { Application, CancellationRequestStatus } from '@/types';
import type { BadgeVariant } from '@/components/ui/Badge';

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

const STATUS_COLORS: Record<CancellationRequestStatus, { bg: string; text: string }> = {
  pending: {
    bg: 'bg-warning-100 dark:bg-warning-900/30',
    text: 'text-warning-700 dark:text-warning-300',
  },
  approved: {
    bg: 'bg-success-100 dark:bg-success-900/30',
    text: 'text-success-700 dark:text-success-300',
  },
  rejected: { bg: 'bg-error-100 dark:bg-error-900/30', text: 'text-error-700 dark:text-error-300' },
};

const STATUS_LABELS: Record<CancellationRequestStatus, string> = {
  pending: '검토 대기',
  approved: '승인됨',
  rejected: '거절됨',
};

/**
 * 상태별 Badge variant.
 * - pending: chip (stripe=warning이 신호를 담당, chip은 분류 라벨)
 * - approved/rejected: semantic variant (결정 완료 → 정보 밀도 유지)
 */
const STATUS_BADGE_VARIANT: Record<CancellationRequestStatus, BadgeVariant> = {
  pending: 'chip',
  approved: 'success',
  rejected: 'error',
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
  const { displayName, profilePhotoURL } = useUserProfile({
    userId: application.applicantId,
    fallbackName: application.applicantName,
    fallbackNickname: application.applicantNickname,
    fallbackPhotoURL: application.applicantPhotoURL,
  });

  const cancellationRequest = application.cancellationRequest;

  // 요청 시간 계산
  const requestTimeAgo = useMemo(() => {
    if (!cancellationRequest?.requestedAt) return '';
    return formatRelativeTime(cancellationRequest.requestedAt);
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

  const isPending = cancellationRequest.status === STATUS.CANCELLATION_REQUEST.PENDING;
  const statusColors = STATUS_COLORS[cancellationRequest.status];

  return (
    <>
      <Card variant="elevated" padding="none">
        <CardStripe tone="warning">
          <View className="p-4 pl-5">
            {/* 헤더: 지원자 정보 + 상태 */}
            <View className="flex-row items-center mb-3">
              <Avatar source={profilePhotoURL} name={displayName} size="md" className="mr-3" />
              <View className="flex-1">
                <View className="flex-row items-center justify-between">
                  <Text
                    className="text-base font-sans-bold text-content-primary dark:text-off-white"
                    style={{ letterSpacing: -0.32 }}
                  >
                    {displayName}
                  </Text>
                  <Badge variant={STATUS_BADGE_VARIANT[cancellationRequest.status]} size="sm">
                    {STATUS_LABELS[cancellationRequest.status]}
                  </Badge>
                </View>
                <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                  {getRoleDisplayName(
                    application.assignments[0]?.roleIds?.[0] || 'other',
                    application.customRole
                  )}{' '}
                  역할
                </Text>
              </View>
            </View>

            {/* 취소 대상 일정 표시 (assignments 기반) */}
            {application.assignments.length > 0 && (
              <View className="flex-row items-center bg-error-50 dark:bg-error-900/20 rounded-lg px-3 py-2 mb-3">
                <CalendarIcon size={14} color="#DC2626" />
                <NumericText className="ml-2 text-sm text-error-700 dark:text-error-300 font-sans">
                  취소 대상: {formatAppliedDate(application.assignments[0]?.dates?.[0])}
                  {application.assignments[0]?.timeSlot &&
                    ` ${application.assignments[0].timeSlot}`}
                </NumericText>
              </View>
            )}

            {/* 공고 정보 */}
            <View className="bg-surface-page rounded-lg px-3 py-2 mb-3">
              <Text className="text-sm text-content-muted dark:text-secondary-400 font-sans">
                {application.jobPostingTitle ?? application.jobPosting?.title ?? '공고'}
              </Text>
              <NumericText className="text-xs text-content-placeholder font-sans">
                {application.jobPostingDate ?? application.jobPosting?.workDate ?? '-'}
              </NumericText>
            </View>

            {/* 취소 요청 사유 */}
            <View className="mb-3">
              <View className="flex-row items-center mb-1">
                <MessageIcon size={14} color={SECONDARY_PALETTE[400]} />
                <Text className="ml-1 text-xs font-sans-medium text-secondary-500 dark:text-secondary-400">
                  취소 사유
                </Text>
              </View>
              <View className="bg-orange-50 dark:bg-orange-900/20 rounded-lg px-3 py-2">
                <Text className="text-sm text-orange-800 dark:text-orange-200 font-sans">
                  {cancellationRequest.reason}
                </Text>
              </View>
            </View>

            {/* 요청 시간 */}
            <View className="flex-row items-center mb-3">
              <ClockIcon size={14} color={SECONDARY_PALETTE[400]} />
              <NumericText className="ml-2 text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                {requestTimeAgo}
              </NumericText>
            </View>

            {/* 검토 결과 표시 (처리 완료 시) */}
            {!isPending && cancellationRequest.rejectionReason && (
              <View className={`${statusColors.bg} rounded-lg px-3 py-2 mb-3`}>
                <Text className={`text-sm ${statusColors.text} font-sans`}>
                  거절 사유: {cancellationRequest.rejectionReason}
                </Text>
              </View>
            )}

            {/* 액션 버튼 (pending 상태일 때만) */}
            {isPending && (
              <View className="flex-row mt-3 pt-3 border-t border-secondary-100 dark:border-surface-overlay">
                {/* 거절 버튼 */}
                <Pressable
                  onPress={handleOpenRejectModal}
                  disabled={isProcessing}
                  className={`
                    flex-1 flex-row items-center justify-center py-2 mr-2
                    rounded-lg bg-surface-card dark:bg-surface active:opacity-70
                    ${isProcessing ? 'opacity-50' : ''}
                  `}
                >
                  <XMarkIcon size={16} color="#DC2626" />
                  <Text className="ml-1 text-sm font-sans-medium text-error-600 dark:text-error-400">
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
                  <Text className="ml-1 text-sm font-sans-medium text-surface-dark">승인</Text>
                </Pressable>
              </View>
            )}
          </View>
        </CardStripe>
      </Card>

      {/* 거절 사유 입력 모달 */}
      <Modal
        visible={showRejectModal}
        onClose={handleCloseRejectModal}
        title="취소 요청 거절"
        size="sm"
        position="center"
      >
        <View className="-mt-2">
          <Text className="text-sm text-secondary-500 dark:text-secondary-400 mb-4 font-sans">
            거절 사유를 입력해주세요.
          </Text>

          {/* 거절 사유 입력 */}
          <TextInput
            value={rejectionReason}
            onChangeText={setRejectionReason}
            placeholder="최소 3자 이상 입력해주세요"
            placeholderTextColor={SECONDARY_PALETTE[400]}
            multiline
            numberOfLines={3}
            maxLength={200}
            className="bg-surface-page rounded-lg p-3 text-content-primary dark:text-off-white text-base font-sans min-h-[80px] mb-4"
            textAlignVertical="top"
          />
          <Text className="text-xs text-content-placeholder text-right mb-4 font-sans">
            {rejectionReason.length}/200
          </Text>

          {/* 버튼 */}
          <ModalFooterButtons
            onCancel={handleCloseRejectModal}
            onSubmit={handleSubmitReject}
            submitText="거절하기"
            submitDisabled={rejectionReason.trim().length < 3}
          />
        </View>
      </Modal>
    </>
  );
});

export default CancellationRequestCard;

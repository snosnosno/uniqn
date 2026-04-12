/**
 * UNIQN Mobile - 대회공고 승인 상태 배지
 *
 * @description 대회공고의 승인 상태를 시각적으로 표시
 * - pending: 승인 대기 (노란색)
 * - approved: 승인 완료 (초록색)
 * - rejected: 승인 거부 (빨간색, 탭하면 거부 사유 표시)
 *
 * @version 1.0.0
 */

import React, { memo, useState, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { format } from 'date-fns';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { ko } from 'date-fns/locale/ko';
import { router } from 'expo-router';
import { RefreshIcon } from '@/components/icons';
import { useTournamentApproval } from '@/hooks/useTournamentApproval';
import { TimeNormalizer, type TimeInput } from '@/shared/time';
import type { TournamentConfig } from '@/types';
import { STATUS } from '@/constants';

// ============================================================================
// Types
// ============================================================================

type ApprovalStatus = 'pending' | 'approved' | 'rejected';

interface TournamentStatusBadgePropsWithConfig {
  /** 대회공고 설정 (전체) */
  tournamentConfig: TournamentConfig;
  status?: never;
  rejectionReason?: never;
}

interface TournamentStatusBadgePropsWithStatus {
  /** 승인 상태 */
  status: ApprovalStatus;
  /** 거부 사유 */
  rejectionReason?: string;
  tournamentConfig?: never;
}

type TournamentStatusBadgeProps = (
  | TournamentStatusBadgePropsWithConfig
  | TournamentStatusBadgePropsWithStatus
) & {
  /** 거부 사유 표시 여부 (기본: true) */
  showRejectionReason?: boolean;
  /** 크기 */
  size?: 'sm' | 'md';
  /** 추가 className */
  className?: string;
  /** 공고 ID (재제출 기능 활성화용) */
  postingId?: string;
  /** 재제출 성공 시 콜백 */
  onResubmitSuccess?: () => void;
};

interface StatusConfig {
  label: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
}

// ============================================================================
// Constants
// ============================================================================

const STATUS_CONFIG: Record<ApprovalStatus, StatusConfig> = {
  pending: {
    label: '승인 대기',
    bgClass: 'bg-warning-50 dark:bg-warning-50',
    textClass: 'text-warning-600 dark:text-warning-500',
    borderClass: 'border-warning-600/20 dark:border-warning-500/20',
  },
  approved: {
    label: '승인 완료',
    bgClass: 'bg-success-50 dark:bg-success-50',
    textClass: 'text-success-600 dark:text-success-500',
    borderClass: 'border-success-600/20 dark:border-success-500/20',
  },
  rejected: {
    label: '승인 거부',
    bgClass: 'bg-error-50 dark:bg-error-50',
    textClass: 'text-error-600 dark:text-error-500',
    borderClass: 'border-error-600/20 dark:border-error-500/20',
  },
};

const SIZE_CONFIG = {
  sm: {
    paddingClass: 'px-2 py-0.5',
    textClass: 'text-xs font-sans',
  },
  md: {
    paddingClass: 'px-2.5 py-1',
    textClass: 'text-xs font-sans',
  },
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * TimeInput을 Date 객체로 변환
 */
function toDate(value: TimeInput): Date | null {
  return TimeNormalizer.parseTime(value);
}

/**
 * 날짜 포맷팅
 */
function formatDateTime(date: Date | null): string {
  if (!date) return '';
  return format(date, 'yyyy.MM.dd HH:mm', { locale: ko });
}

// ============================================================================
// Component
// ============================================================================

export const TournamentStatusBadge = memo(function TournamentStatusBadge(
  props: TournamentStatusBadgeProps
) {
  const {
    showRejectionReason = true,
    size = 'md',
    className = '',
    postingId,
    onResubmitSuccess,
  } = props;

  const [showModal, setShowModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const { resubmit } = useTournamentApproval();

  // tournamentConfig 또는 status/rejectionReason에서 값 추출
  const approvalStatus: ApprovalStatus =
    'tournamentConfig' in props && props.tournamentConfig
      ? props.tournamentConfig.approvalStatus
      : (props.status ?? STATUS.TOURNAMENT.PENDING);

  const rejectionReason =
    'tournamentConfig' in props && props.tournamentConfig
      ? props.tournamentConfig.rejectionReason
      : props.rejectionReason;

  const rejectedAt =
    'tournamentConfig' in props && props.tournamentConfig
      ? props.tournamentConfig.rejectedAt
      : undefined;

  const resubmittedAt =
    'tournamentConfig' in props && props.tournamentConfig
      ? props.tournamentConfig.resubmittedAt
      : undefined;

  const config = STATUS_CONFIG[approvalStatus];
  const sizeConfig = SIZE_CONFIG[size];

  // 거부 상태이고 사유가 있을 때만 모달 표시 가능
  const canShowReason =
    showRejectionReason && approvalStatus === STATUS.TOURNAMENT.REJECTED && rejectionReason;

  const rejectedDate = toDate(rejectedAt);
  const formattedDate = formatDateTime(rejectedDate);

  // 재제출 여부
  const isResubmitted = !!resubmittedAt;

  const handlePress = useCallback(() => {
    if (canShowReason) {
      setShowModal(true);
    }
  }, [canShowReason]);

  const handleClose = useCallback(() => {
    setShowModal(false);
  }, []);

  // 수정하기 버튼
  const handleEdit = useCallback(() => {
    if (postingId) {
      setShowModal(false);
      router.push(`/(employer)/my-postings/${postingId}/edit`);
    }
  }, [postingId]);

  // 재제출 버튼 클릭
  const handleResubmitPress = useCallback(() => {
    setShowConfirmModal(true);
  }, []);

  // 재제출 확인
  const handleResubmitConfirm = useCallback(() => {
    if (!postingId) return;

    resubmit
      .mutateAsync({ postingId })
      .then(() => {
        setShowConfirmModal(false);
        setShowModal(false);
        onResubmitSuccess?.();
      })
      .catch(() => {
        setShowConfirmModal(false);
      });
  }, [postingId, resubmit, onResubmitSuccess]);

  // 재제출 확인 모달 닫기
  const handleConfirmClose = useCallback(() => {
    setShowConfirmModal(false);
  }, []);

  // 배지 내용 (공통)
  const badgeContent = (
    <>
      <Text className={`font-sans-semibold ${config.textClass} ${sizeConfig.textClass}`}>
        {config.label}
      </Text>
      {isResubmitted && approvalStatus === STATUS.TOURNAMENT.PENDING && (
        <RefreshIcon size={12} color="#D4AF37" />
      )}
    </>
  );

  const badgeClassName = `flex-row items-center rounded-sm border ${config.bgClass} ${config.borderClass} ${sizeConfig.paddingClass} ${className}`;

  return (
    <>
      {/* 클릭 가능한 경우 Pressable, 아닌 경우 View 사용 (웹 버튼 중첩 방지) */}
      {canShowReason ? (
        <Pressable
          onPress={handlePress}
          accessibilityRole="button"
          accessibilityLabel={`${config.label}, 탭하여 거부 사유 보기`}
          className={badgeClassName}
        >
          {badgeContent}
        </Pressable>
      ) : (
        <View accessibilityRole="text" accessibilityLabel={config.label} className={badgeClassName}>
          {badgeContent}
        </View>
      )}

      {/* 거부 사유 모달 */}
      {canShowReason && (
        <Modal
          visible={showModal}
          onClose={handleClose}
          title="승인이 거부되었습니다"
          size="sm"
          position="center"
        >
          <View className="-mt-2">
            {formattedDate && (
              <Text className="text-xs text-secondary-500 dark:text-secondary-400 mb-3 font-sans">
                {formattedDate}
              </Text>
            )}

            {/* 거부 사유 */}
            <View className="p-3 bg-secondary-50 dark:bg-surface rounded-lg mb-3">
              <Text className="text-sm font-sans-medium text-secondary-500 dark:text-secondary-400 mb-1">
                거부 사유
              </Text>
              <Text className="text-base text-secondary-700 dark:text-secondary-300 font-sans">
                {rejectionReason}
              </Text>
            </View>

            <Text className="text-sm text-secondary-600 dark:text-secondary-400 mb-4 font-sans">
              공고 내용을 수정한 후 재제출하시면 다시 검토됩니다.
            </Text>

            {/* 액션 버튼 (postingId가 있을 때만 표시) */}
            {postingId && (
              <View className="flex-row">
                <Pressable
                  onPress={handleEdit}
                  className="flex-1 mr-2 py-3 rounded-md border border-primary-600 dark:border-primary-500 items-center justify-center active:opacity-70"
                >
                  <Text className="text-base font-sans-medium text-primary-600 dark:text-primary-400">
                    수정하기
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleResubmitPress}
                  disabled={resubmit.isPending}
                  className="flex-1 ml-2 py-3 rounded-md bg-primary-600 dark:bg-primary-500 flex-row items-center justify-center active:opacity-80"
                >
                  {resubmit.isPending ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <RefreshIcon size={18} color="#ffffff" />
                      <Text className="ml-2 text-base font-sans-medium text-surface-dark">
                        재제출
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            )}
          </View>
        </Modal>
      )}

      {/* 재제출 확인 모달 */}
      <ConfirmModal
        visible={showConfirmModal}
        onClose={handleConfirmClose}
        onConfirm={handleResubmitConfirm}
        title="대회공고 재제출"
        message="공고를 다시 승인 심사에 제출하시겠습니까? 관리자의 검토 후 승인/거부가 결정됩니다."
        confirmText="재제출"
        cancelText="취소"
      />
    </>
  );
});

export default TournamentStatusBadge;

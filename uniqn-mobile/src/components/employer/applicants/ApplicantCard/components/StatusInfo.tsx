/**
 * UNIQN Mobile - 상태 정보 컴포넌트
 *
 * @description 거절 사유, 확정 이력 표시
 * @version 1.0.0
 */

import React from 'react';
import { View, Text } from 'react-native';

import { ConfirmationHistoryTimeline } from '@/components/applicant/ConfirmationHistoryTimeline';

import type { ApplicationStatus, ConfirmationHistoryEntry } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface StatusInfoProps {
  /** 지원 상태 */
  status: ApplicationStatus;
  /** 거절 사유 */
  rejectionReason?: string;
  /** 확정 이력 */
  confirmationHistory?: ConfirmationHistoryEntry[];
  /** 확정 이력 표시 여부 */
  showConfirmationHistory?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const StatusInfo = React.memo(function StatusInfo({
  status,
  rejectionReason,
  confirmationHistory,
  showConfirmationHistory = true,
}: StatusInfoProps) {
  return (
    <>
      {/* 거절 사유 */}
      {status === 'rejected' && rejectionReason && (
        <View className="bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2 mb-2">
          <Text className="text-sm text-red-700 dark:text-red-300">
            거절 사유: {rejectionReason}
          </Text>
        </View>
      )}

      {/* 확정 이력 타임라인 */}
      {showConfirmationHistory &&
        status === 'confirmed' &&
        confirmationHistory &&
        confirmationHistory.length > 0 && (
          <View className="mb-2">
            <ConfirmationHistoryTimeline history={confirmationHistory} compact />
          </View>
        )}
    </>
  );
});

export default StatusInfo;

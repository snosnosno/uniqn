/**
 * UNIQN Mobile - QRCodeDisplay 컴포넌트
 *
 * @description 출퇴근용 QR 코드 표시
 * @version 2.0.0 - EventQRDisplayData 타입으로 마이그레이션
 *
 * @note 구인자용 QR 표시는 EventQRModal 사용 권장
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Modal, Button } from '@/components/ui';
import { RefreshIcon, ClockIcon, CheckCircleIcon } from '@/components/icons';
import { stringifyQRData } from '@/services/work/eventQRService';
import type { QRCodeAction, EventQRDisplayData } from '@/types';
import { toDate } from '@/utils/date';

// ============================================================================
// Types
// ============================================================================

interface QRCodeDisplayProps {
  visible: boolean;
  onClose: () => void;
  /** EventQRDisplayData 사용 (Event QR 시스템) */
  displayData: EventQRDisplayData | null;
  isLoading?: boolean;
  onRefresh?: () => void;
  action?: QRCodeAction;
}

// ============================================================================
// Constants
// ============================================================================

const QR_SIZE = 200;
// QR 갱신 주기는 eventQRService.QR_REFRESH_INTERVAL_MS 사용

// ============================================================================
// Helper Functions
// ============================================================================

function formatRemainingTime(expiresAt: Date): string {
  const now = new Date();
  const remaining = expiresAt.getTime() - now.getTime();

  if (remaining <= 0) return '만료됨';

  const minutes = Math.floor(remaining / (1000 * 60));
  const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

  if (minutes > 0) {
    return `${minutes}분 ${seconds}초 남음`;
  }
  return `${seconds}초 남음`;
}

// ============================================================================
// Component
// ============================================================================

export function QRCodeDisplay({
  visible,
  onClose,
  displayData,
  isLoading = false,
  onRefresh,
  action,
}: QRCodeDisplayProps) {
  const [remainingTime, setRemainingTime] = useState<string>('');
  const [isExpired, setIsExpired] = useState(false);

  // 남은 시간 업데이트
  useEffect(() => {
    if (!displayData?.expiresAt) return;

    const updateTime = () => {
      const expiresAt = toDate(displayData.expiresAt);
      const now = new Date();

      if (!expiresAt || now.getTime() >= expiresAt.getTime()) {
        setIsExpired(true);
        setRemainingTime('만료됨');
      } else {
        setIsExpired(false);
        setRemainingTime(formatRemainingTime(expiresAt));
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, [displayData]);

  // QR 코드 값 생성 (EventQRDisplayData → JSON 문자열)
  const qrValue = displayData ? stringifyQRData(displayData) : '';

  // 새로고침 핸들러
  const handleRefresh = useCallback(() => {
    if (onRefresh) {
      onRefresh();
    }
  }, [onRefresh]);

  const actionLabel = action === 'checkIn' ? '출근' : action === 'checkOut' ? '퇴근' : '';

  return (
    <Modal visible={visible} onClose={onClose} position="center" showCloseButton>
      <View className="items-center px-4 py-6">
        {/* 제목 */}
        <View className="flex-row items-center mb-2">
          <CheckCircleIcon size={24} color="#D4AF37" />
          <Text className="text-xl font-display text-content-primary dark:text-secondary-100 ml-2">
            {actionLabel} QR 코드
          </Text>
        </View>

        <Text className="text-secondary-500 dark:text-secondary-400 text-center mb-6 font-sans">
          QR 코드를 스캔하여 {actionLabel}을 완료하세요
        </Text>

        {/* QR 코드 영역 - 다크모드에서도 QR 스캐너 가독성을 위해 흰색 배경 강제 유지 */}
        <View className="bg-white rounded-lg p-6 shadow-lg dark:shadow-gray-800/50">
          {isLoading ? (
            <View
              style={{ width: QR_SIZE, height: QR_SIZE }}
              className="items-center justify-center"
            >
              <ActivityIndicator size="large" color="#D4AF37" />
              <Text className="text-secondary-500 mt-4 font-sans">QR 코드 생성 중...</Text>
            </View>
          ) : isExpired || !displayData ? (
            <View
              style={{ width: QR_SIZE, height: QR_SIZE }}
              className="items-center justify-center bg-surface-card dark:bg-surface rounded-md"
            >
              <Text className="text-content-placeholder text-center mb-4 font-sans">
                {isExpired ? 'QR 코드가 만료되었습니다' : 'QR 코드를 생성해주세요'}
              </Text>
              {onRefresh && (
                <Button
                  variant="primary"
                  size="sm"
                  onPress={handleRefresh}
                  icon={<RefreshIcon size={16} color="#FFFFFF" />}
                >
                  새로 생성
                </Button>
              )}
            </View>
          ) : (
            <QRCode value={qrValue} size={QR_SIZE} backgroundColor="white" color="black" />
          )}
        </View>

        {/* 남은 시간 */}
        {displayData && !isLoading && (
          <View className="flex-row items-center mt-4">
            <ClockIcon size={16} color={isExpired ? '#DC2626' : SECONDARY_PALETTE[500]} />
            <Text
              className={`ml-1 text-sm ${
                isExpired ? 'text-error-500' : 'text-secondary-500 dark:text-secondary-400'
              } font-sans`}
            >
              {remainingTime}
            </Text>
          </View>
        )}

        {/* 안내 문구 */}
        <View className="mt-6 bg-primary-50 dark:bg-primary-900/20 rounded-md p-4 w-full">
          <Text className="text-sm text-primary-700 dark:text-primary-300 text-center font-sans">
            • QR 코드는 3분간 유효합니다{'\n'}• 만료 시 새로고침하여 재생성해주세요{'\n'}• 스태프가
            스캔하면 자동으로 출퇴근 처리
          </Text>
        </View>

        {/* 새로고침 버튼 */}
        {onRefresh && displayData && !isExpired && (
          <Pressable
            onPress={handleRefresh}
            className="flex-row items-center mt-4 p-2"
            accessibilityLabel="QR 코드 새로고침"
          >
            <RefreshIcon size={16} color={SECONDARY_PALETTE[500]} />
            <Text className="ml-1 text-sm text-secondary-500 dark:text-secondary-400 font-sans">
              새로고침
            </Text>
          </Pressable>
        )}
      </View>
    </Modal>
  );
}

export default QRCodeDisplay;

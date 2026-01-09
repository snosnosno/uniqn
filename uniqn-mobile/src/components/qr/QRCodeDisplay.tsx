/**
 * UNIQN Mobile - QRCodeDisplay 컴포넌트
 *
 * @description 출퇴근용 QR 코드 표시
 * @version 1.0.0
 */

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Modal, Button } from '@/components/ui';
import { RefreshIcon, ClockIcon, CheckCircleIcon } from '@/components/icons';
import type { QRCodeAction, QRCodeData } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface QRCodeDisplayProps {
  visible: boolean;
  onClose: () => void;
  qrData: QRCodeData | null;
  isLoading?: boolean;
  onRefresh?: () => void;
  action?: QRCodeAction;
}

// ============================================================================
// Constants
// ============================================================================

const QR_SIZE = 200;
// QR 남은 시간 자동 갱신 주기 (향후 useEffect에서 활용)
// export for future use - suppresses unused warning
export const QR_REFRESH_INTERVAL = 60 * 1000; // 1분마다 남은 시간 업데이트

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
  qrData,
  isLoading = false,
  onRefresh,
  action,
}: QRCodeDisplayProps) {
  const [remainingTime, setRemainingTime] = useState<string>('');
  const [isExpired, setIsExpired] = useState(false);

  // 남은 시간 업데이트
  useEffect(() => {
    if (!qrData?.expiresAt) return;

    const updateTime = () => {
      const expiresAt = qrData.expiresAt.toDate();
      const now = new Date();

      if (now.getTime() >= expiresAt.getTime()) {
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
  }, [qrData]);

  // QR 코드 값 생성
  const qrValue = qrData
    ? JSON.stringify({
        qrCodeId: qrData.id,
        eventId: qrData.eventId,
        action: qrData.action,
      })
    : '';

  // 새로고침 핸들러
  const handleRefresh = useCallback(() => {
    if (onRefresh) {
      onRefresh();
    }
  }, [onRefresh]);

  const actionLabel = action === 'checkIn' ? '출근' : action === 'checkOut' ? '퇴근' : '';

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      position="center"
      showCloseButton
    >
      <View className="items-center px-4 py-6">
        {/* 제목 */}
        <View className="flex-row items-center mb-2">
          <CheckCircleIcon size={24} color="#3B82F6" />
          <Text className="text-xl font-bold text-gray-900 dark:text-gray-100 ml-2">
            {actionLabel} QR 코드
          </Text>
        </View>

        <Text className="text-gray-500 dark:text-gray-400 text-center mb-6">
          QR 코드를 스캔하여 {actionLabel}을 완료하세요
        </Text>

        {/* QR 코드 영역 */}
        <View className="bg-white rounded-2xl p-6 shadow-lg">
          {isLoading ? (
            <View
              style={{ width: QR_SIZE, height: QR_SIZE }}
              className="items-center justify-center"
            >
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text className="text-gray-500 mt-4">QR 코드 생성 중...</Text>
            </View>
          ) : isExpired || !qrData ? (
            <View
              style={{ width: QR_SIZE, height: QR_SIZE }}
              className="items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-xl"
            >
              <Text className="text-gray-400 dark:text-gray-500 text-center mb-4">
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
            <QRCode
              value={qrValue}
              size={QR_SIZE}
              backgroundColor="white"
              color="black"
            />
          )}
        </View>

        {/* 남은 시간 */}
        {qrData && !isLoading && (
          <View className="flex-row items-center mt-4">
            <ClockIcon size={16} color={isExpired ? '#EF4444' : '#6B7280'} />
            <Text
              className={`ml-1 text-sm ${
                isExpired
                  ? 'text-red-500'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {remainingTime}
            </Text>
          </View>
        )}

        {/* 안내 문구 */}
        <View className="mt-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 w-full">
          <Text className="text-sm text-blue-700 dark:text-blue-300 text-center">
            • QR 코드는 5분간 유효합니다{'\n'}
            • 만료 시 새로고침하여 재생성해주세요{'\n'}
            • 한 번 사용된 QR 코드는 재사용 불가
          </Text>
        </View>

        {/* 새로고침 버튼 */}
        {onRefresh && qrData && !isExpired && (
          <Pressable
            onPress={handleRefresh}
            className="flex-row items-center mt-4 p-2"
            accessibilityLabel="QR 코드 새로고침"
          >
            <RefreshIcon size={16} color="#6B7280" />
            <Text className="ml-1 text-sm text-gray-500 dark:text-gray-400">
              새로고침
            </Text>
          </Pressable>
        )}
      </View>
    </Modal>
  );
}

export default QRCodeDisplay;

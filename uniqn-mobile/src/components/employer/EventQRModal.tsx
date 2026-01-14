/**
 * UNIQN Mobile - 현장 QR 코드 모달 (구인자용)
 *
 * @description 구인자가 스태프에게 보여줄 출퇴근 QR 코드
 * @version 1.0.0
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, ActivityIndicator, Dimensions } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import {
  QrCodeIcon,
  RefreshIcon,
  ClockIcon,
  CheckCircleIcon,
  AlertCircleIcon,
} from '../icons';
import { useEventQR } from '@/hooks/useEventQR';
import { useAuth } from '@/hooks/useAuth';
import { formatDate } from '@/utils/dateUtils';

// ============================================================================
// Types
// ============================================================================

export interface EventQRModalProps {
  visible: boolean;
  onClose: () => void;
  jobPostingId: string;
  jobTitle?: string;
  eventDate?: string; // YYYY-MM-DD
}

type QRMode = 'checkIn' | 'checkOut';

// ============================================================================
// Constants
// ============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const QR_SIZE = Math.min(SCREEN_WIDTH * 0.6, 250);

// ============================================================================
// Sub-components
// ============================================================================

interface ModeToggleProps {
  mode: QRMode;
  onModeChange: (mode: QRMode) => void;
}

function ModeToggle({ mode, onModeChange }: ModeToggleProps) {
  return (
    <View
      className="flex-row bg-gray-100 dark:bg-gray-800 rounded-xl p-1 mb-6"
      accessibilityRole="tablist"
      accessibilityLabel="출퇴근 모드 선택"
    >
      <Pressable
        onPress={() => onModeChange('checkIn')}
        className={`flex-1 items-center py-3 rounded-lg ${
          mode === 'checkIn'
            ? 'bg-green-600 dark:bg-green-700'
            : 'bg-transparent'
        }`}
        accessibilityRole="tab"
        accessibilityState={{ selected: mode === 'checkIn' }}
        accessibilityLabel="출근 모드"
      >
        <Text
          className={`text-base font-semibold ${
            mode === 'checkIn'
              ? 'text-white'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          출근
        </Text>
      </Pressable>

      <Pressable
        onPress={() => onModeChange('checkOut')}
        className={`flex-1 items-center py-3 rounded-lg ${
          mode === 'checkOut'
            ? 'bg-blue-600 dark:bg-blue-700'
            : 'bg-transparent'
        }`}
        accessibilityRole="tab"
        accessibilityState={{ selected: mode === 'checkOut' }}
        accessibilityLabel="퇴근 모드"
      >
        <Text
          className={`text-base font-semibold ${
            mode === 'checkOut'
              ? 'text-white'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          퇴근
        </Text>
      </Pressable>
    </View>
  );
}

interface CountdownProps {
  remainingSeconds: number;
  isExpired: boolean;
}

function Countdown({ remainingSeconds, isExpired }: CountdownProps) {
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;

  const timeString = useMemo(() => {
    if (isExpired) return '만료됨';
    if (minutes > 0) {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${seconds}초`;
  }, [minutes, seconds, isExpired]);

  const isWarning = remainingSeconds < 30 && !isExpired;

  return (
    <View className={`flex-row items-center px-4 py-2 rounded-full ${
      isExpired
        ? 'bg-red-100 dark:bg-red-900/30'
        : isWarning
        ? 'bg-orange-100 dark:bg-orange-900/30'
        : 'bg-gray-100 dark:bg-gray-800'
    }`}>
      <ClockIcon
        size={16}
        color={isExpired ? '#EF4444' : isWarning ? '#F59E0B' : '#6B7280'}
      />
      <Text className={`ml-1 text-sm font-medium ${
        isExpired
          ? 'text-red-600 dark:text-red-400'
          : isWarning
          ? 'text-orange-600 dark:text-orange-400'
          : 'text-gray-600 dark:text-gray-400'
      }`}>
        {timeString}
      </Text>
    </View>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function EventQRModal({
  visible,
  onClose,
  jobPostingId,
  jobTitle,
  eventDate,
}: EventQRModalProps) {
  // 오늘 날짜 기본값
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const targetDate = eventDate || today;

  // 현재 사용자 (QR 생성자)
  const { user } = useAuth();
  const createdBy = user?.uid || '';

  // 모드 상태
  const [mode, setMode] = useState<QRMode>('checkIn');

  // QR 훅 (positional params)
  const {
    qrValue,
    displayData,
    remainingSeconds,
    isActive,
    isLoading,
    generate,
    refresh,
  } = useEventQR(jobPostingId, targetDate, createdBy, {
    autoRefresh: visible, // 모달이 열려있을 때만 자동 갱신
  });

  // QR 데이터 유무 확인
  const hasQRData = !!displayData && isActive;
  // 만료 여부 (remainingSeconds가 0 이하면 만료)
  const isExpired = remainingSeconds <= 0 && hasQRData;

  // 모드 변경 핸들러
  const handleModeChange = useCallback((newMode: QRMode) => {
    setMode(newMode);
    // 모드 변경 시 새 QR 생성
    generate(newMode);
  }, [generate]);

  // 새로고침 핸들러
  const handleRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  // 포맷된 날짜
  const formattedDate = useMemo(() => {
    const date = new Date(targetDate);
    return formatDate(date);
  }, [targetDate]);

  // 모드별 색상
  const modeColor = mode === 'checkIn' ? '#16A34A' : '#2563EB';
  const modeLabel = mode === 'checkIn' ? '출근' : '퇴근';

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      position="center"
      showCloseButton
    >
      <View className="items-center px-4 py-6">
        {/* 헤더 */}
        <View className="flex-row items-center mb-2">
          <QrCodeIcon size={24} color={modeColor} />
          <Text className="text-xl font-bold text-gray-900 dark:text-gray-100 ml-2">
            현장 {modeLabel} QR
          </Text>
        </View>

        {/* 공고 정보 */}
        {jobTitle && (
          <Text className="text-sm text-gray-500 dark:text-gray-400 mb-1">
            {jobTitle}
          </Text>
        )}
        <Text className="text-sm text-gray-400 dark:text-gray-500 mb-4">
          {formattedDate}
        </Text>

        {/* 모드 토글 */}
        <ModeToggle mode={mode} onModeChange={handleModeChange} />

        {/* QR 코드 영역 */}
        <View className="bg-white rounded-2xl p-6 shadow-lg mb-4">
          {isLoading ? (
            <View
              style={{ width: QR_SIZE, height: QR_SIZE }}
              className="items-center justify-center"
            >
              <ActivityIndicator size="large" color={modeColor} />
              <Text className="text-gray-500 mt-4">QR 코드 생성 중...</Text>
            </View>
          ) : isExpired || !hasQRData ? (
            <View
              style={{ width: QR_SIZE, height: QR_SIZE }}
              className="items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-xl"
            >
              <AlertCircleIcon size={48} color="#9CA3AF" />
              <Text className="text-gray-400 text-center mt-4 mb-4">
                {isExpired
                  ? 'QR 코드가 만료되었습니다'
                  : 'QR 코드를 생성해주세요'}
              </Text>
              <Button
                variant="primary"
                size="sm"
                onPress={() => generate(mode)}
                icon={<RefreshIcon size={16} color="#FFFFFF" />}
              >
                {isExpired ? 'QR 재생성' : 'QR 생성'}
              </Button>
            </View>
          ) : (
            <QRCode
              value={qrValue || ''}
              size={QR_SIZE}
              backgroundColor="white"
              color="black"
            />
          )}
        </View>

        {/* 남은 시간 & 새로고침 */}
        {hasQRData && !isLoading && (
          <View className="flex-row items-center gap-4 mb-4">
            <Countdown remainingSeconds={remainingSeconds} isExpired={isExpired} />

            {!isExpired && (
              <Pressable
                onPress={handleRefresh}
                disabled={isLoading}
                className="flex-row items-center p-2 active:opacity-70"
              >
                <RefreshIcon size={16} color="#6B7280" />
                <Text className="ml-1 text-sm text-gray-500 dark:text-gray-400">
                  새로고침
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {/* 안내 문구 */}
        <Card
          variant="filled"
          padding="md"
          className="w-full bg-blue-50 dark:bg-blue-900/20"
        >
          <View className="flex-row items-start mb-2">
            <CheckCircleIcon size={16} color="#2563EB" />
            <Text className="ml-2 text-sm font-medium text-blue-800 dark:text-blue-300">
              스태프 {modeLabel} 방법
            </Text>
          </View>

          <View className="ml-6">
            <View className="flex-row items-center mb-1">
              <Text className="text-xs text-blue-600 dark:text-blue-400">
                1. 스태프가 자신의 앱에서 QR 스캔 메뉴 실행
              </Text>
            </View>
            <View className="flex-row items-center mb-1">
              <Text className="text-xs text-blue-600 dark:text-blue-400">
                2. 이 화면의 QR 코드를 스캔
              </Text>
            </View>
            <View className="flex-row items-center">
              <Text className="text-xs text-blue-600 dark:text-blue-400">
                3. {modeLabel} 처리 완료
              </Text>
            </View>
          </View>
        </Card>

        {/* 주의 사항 */}
        <View className="mt-4 flex-row items-start">
          <AlertCircleIcon size={14} color="#9CA3AF" />
          <Text className="ml-1 text-xs text-gray-400 dark:text-gray-500 flex-1">
            QR 코드는 3분간 유효합니다. 만료 시 새로고침하여 재생성하세요.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

export default EventQRModal;

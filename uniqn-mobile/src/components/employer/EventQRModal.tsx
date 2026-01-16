/**
 * UNIQN Mobile - 현장 QR 코드 모달 (구인자용)
 *
 * @description 구인자가 스태프에게 보여줄 출퇴근 QR 코드
 * @version 2.0.0
 *
 * 개선 사항:
 * - 모달 열릴 때 QR 자동 생성
 * - 원형 프로그레스 바로 남은 시간 시각화
 * - 모드 토글 아이콘 추가
 * - 갱신 인디케이터 추가
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Dimensions,
  Animated,
  Easing,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { CircularProgress } from '../ui/CircularProgress';
import {
  QrCodeIcon,
  RefreshIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  XMarkIcon,
  LogInIcon,
  LogOutIcon,
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
const QR_SIZE = Math.min(SCREEN_WIDTH * 0.55, 220);
const TOTAL_SECONDS = 180; // 3분

// ============================================================================
// Sub-components
// ============================================================================

interface ModeToggleProps {
  mode: QRMode;
  onModeChange: (mode: QRMode) => void;
  disabled?: boolean;
}

function ModeToggle({ mode, onModeChange, disabled }: ModeToggleProps) {
  const checkInActive = mode === 'checkIn';
  const checkOutActive = mode === 'checkOut';

  return (
    <View
      className="flex-row bg-gray-100 dark:bg-gray-800 rounded-2xl p-1.5"
      accessibilityRole="tablist"
      accessibilityLabel="출퇴근 모드 선택"
    >
      <Pressable
        onPress={() => onModeChange('checkIn')}
        disabled={disabled}
        className={`flex-1 flex-row items-center justify-center py-3.5 rounded-xl ${
          checkInActive
            ? 'bg-green-600 dark:bg-green-700 shadow-md'
            : 'bg-transparent'
        } ${disabled ? 'opacity-50' : ''}`}
        accessibilityRole="tab"
        accessibilityState={{ selected: checkInActive }}
        accessibilityLabel="출근 모드"
      >
        <LogInIcon
          size={18}
          color={checkInActive ? '#FFFFFF' : '#9CA3AF'}
        />
        <Text
          className={`ml-2 text-base font-semibold ${
            checkInActive
              ? 'text-white'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          출근
        </Text>
      </Pressable>

      <Pressable
        onPress={() => onModeChange('checkOut')}
        disabled={disabled}
        className={`flex-1 flex-row items-center justify-center py-3.5 rounded-xl ${
          checkOutActive
            ? 'bg-blue-600 dark:bg-blue-700 shadow-md'
            : 'bg-transparent'
        } ${disabled ? 'opacity-50' : ''}`}
        accessibilityRole="tab"
        accessibilityState={{ selected: checkOutActive }}
        accessibilityLabel="퇴근 모드"
      >
        <LogOutIcon
          size={18}
          color={checkOutActive ? '#FFFFFF' : '#9CA3AF'}
        />
        <Text
          className={`ml-2 text-base font-semibold ${
            checkOutActive
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

interface QRRefreshOverlayProps {
  visible: boolean;
}

function QRRefreshOverlay({ visible }: QRRefreshOverlayProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // 페이드 인
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();

      // 회전 애니메이션
      const rotateLoop = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      rotateLoop.start();

      return () => rotateLoop.stop();
    } else {
      // 페이드 아웃
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start();
      rotateAnim.setValue(0);
    }
  }, [visible, fadeAnim, rotateAnim]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (!visible) return null;

  return (
    <Animated.View
      style={{ opacity: fadeAnim }}
      className="absolute inset-0 bg-white/80 dark:bg-gray-800/80 rounded-2xl items-center justify-center z-10"
    >
      <Animated.View style={{ transform: [{ rotate }] }}>
        <RefreshIcon size={32} color="#3B82F6" />
      </Animated.View>
      <Text className="mt-3 text-sm text-gray-600 dark:text-gray-400 font-medium">
        QR 갱신 중...
      </Text>
    </Animated.View>
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

  // 자동 생성 실행 여부 추적
  const hasAutoGenerated = useRef(false);

  // QR 훅
  const {
    qrValue,
    displayData,
    remainingSeconds,
    isActive,
    isLoading,
    isRefreshing,
    generate,
    refresh,
  } = useEventQR(jobPostingId, targetDate, createdBy, {
    autoRefresh: visible,
  });

  // 모달 열릴 때 자동 QR 생성
  useEffect(() => {
    if (visible && createdBy && !hasAutoGenerated.current) {
      hasAutoGenerated.current = true;
      generate(mode);
    }

    // 모달 닫힐 때 플래그 리셋
    if (!visible) {
      hasAutoGenerated.current = false;
    }
  }, [visible, createdBy, mode, generate]);

  // QR 데이터 유무 확인
  const hasQRData = !!displayData && isActive;
  // 만료 여부
  const isExpired = remainingSeconds <= 0 && hasQRData;

  // 모드 변경 핸들러
  const handleModeChange = useCallback((newMode: QRMode) => {
    setMode(newMode);
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
      size="lg"
      showCloseButton={false}
    >
      <View>
        {/* 커스텀 닫기 버튼 */}
        <View className="flex-row justify-end mb-2">
          <Pressable
            onPress={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700 items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="닫기"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <XMarkIcon size={20} color="#6B7280" />
          </Pressable>
        </View>

        <View className="items-center pb-4">
          {/* 헤더 */}
          <View className="flex-row items-center mb-1">
            <QrCodeIcon size={26} color={modeColor} />
            <Text className="text-xl font-bold text-gray-900 dark:text-gray-100 ml-2">
              현장 {modeLabel} QR
            </Text>
          </View>

          {/* 공고 정보 */}
          {jobTitle && (
            <Text className="text-base text-gray-700 dark:text-gray-300 font-medium mb-0.5">
              {jobTitle}
            </Text>
          )}
          <Text className="text-sm text-gray-400 dark:text-gray-500 mb-5">
            {formattedDate}
          </Text>

          {/* 모드 토글 */}
          <View className="w-full mb-5">
            <ModeToggle
              mode={mode}
              onModeChange={handleModeChange}
              disabled={isLoading || isRefreshing}
            />
          </View>

          {/* QR 코드 영역 */}
          <View className="relative bg-white rounded-2xl p-5 shadow-lg mb-4">
            {/* 갱신 오버레이 */}
            <QRRefreshOverlay visible={isRefreshing} />

            {isLoading ? (
              <View
                style={{ width: QR_SIZE, height: QR_SIZE }}
                className="items-center justify-center"
              >
                <ActivityIndicator size="large" color={modeColor} />
                <Text className="text-gray-500 mt-4 text-sm">
                  QR 코드 생성 중...
                </Text>
              </View>
            ) : isExpired ? (
              <View
                style={{ width: QR_SIZE, height: QR_SIZE }}
                className="items-center justify-center bg-gray-50 dark:bg-gray-100 rounded-xl"
              >
                <AlertCircleIcon size={48} color="#EF4444" />
                <Text className="text-red-500 text-center mt-3 mb-4 font-medium">
                  QR 코드가 만료되었습니다
                </Text>
                <Button
                  variant="primary"
                  size="sm"
                  onPress={() => generate(mode)}
                  icon={<RefreshIcon size={16} color="#FFFFFF" />}
                >
                  QR 재생성
                </Button>
              </View>
            ) : hasQRData ? (
              <QRCode
                value={qrValue || ''}
                size={QR_SIZE}
                backgroundColor="white"
                color="black"
              />
            ) : (
              <View
                style={{ width: QR_SIZE, height: QR_SIZE }}
                className="items-center justify-center bg-gray-50 rounded-xl"
              >
                <ActivityIndicator size="large" color={modeColor} />
              </View>
            )}
          </View>

          {/* 프로그레스 바 & 새로고침 */}
          {hasQRData && !isLoading && !isExpired && (
            <View className="flex-row items-center gap-5 mb-4">
              <CircularProgress
                remainingSeconds={remainingSeconds}
                totalSeconds={TOTAL_SECONDS}
                size={70}
                strokeWidth={5}
                isExpired={isExpired}
              />

              <Pressable
                onPress={handleRefresh}
                disabled={isLoading || isRefreshing}
                className={`flex-row items-center px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 active:opacity-70 ${
                  isRefreshing ? 'opacity-50' : ''
                }`}
              >
                <RefreshIcon size={18} color="#6B7280" />
                <Text className="ml-2 text-sm text-gray-600 dark:text-gray-400 font-medium">
                  수동 갱신
                </Text>
              </Pressable>
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

            <View className="ml-6 gap-1">
              <Text className="text-xs text-blue-600 dark:text-blue-400">
                1. 스태프가 앱 하단의 QR 탭 선택
              </Text>
              <Text className="text-xs text-blue-600 dark:text-blue-400">
                2. 카메라로 이 QR 코드 스캔
              </Text>
              <Text className="text-xs text-blue-600 dark:text-blue-400">
                3. {modeLabel} 자동 처리 완료
              </Text>
            </View>
          </Card>

          {/* 주의 사항 */}
          <View className="mt-3 flex-row items-start px-1">
            <AlertCircleIcon size={14} color="#9CA3AF" />
            <Text className="ml-1.5 text-xs text-gray-400 dark:text-gray-500 flex-1">
              QR 코드는 3분간 유효하며, 자동으로 갱신됩니다.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default EventQRModal;

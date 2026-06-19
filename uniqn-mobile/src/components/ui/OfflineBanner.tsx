/**
 * UNIQN Mobile - 오프라인 배너 컴포넌트
 *
 * @description 네트워크 연결 끊김 시 표시되는 배너
 * @version 1.0.0
 */

import React, { useCallback } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { STATUS_COLORS } from '@/constants/colors';
import { WifiOff, RefreshCw } from '../icons';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

/**
 * OfflineBanner Props
 */
export interface OfflineBannerProps {
  /** 재연결 시도 버튼 표시 여부 (기본: true) */
  showRetry?: boolean;
  /** 커스텀 메시지 */
  message?: string;
  /** 재연결 성공 콜백 */
  onReconnect?: () => void;
  /** 스타일 변형 */
  variant?: 'banner' | 'fullscreen' | 'toast';
}

/**
 * 오프라인 상태 배너
 *
 * @example
 * ```tsx
 * // 기본 사용
 * <OfflineBanner />
 *
 * // 전체 화면 오버레이
 * <OfflineBanner variant="fullscreen" />
 *
 * // 커스텀 메시지
 * <OfflineBanner message="네트워크 연결을 확인해주세요" />
 * ```
 */
export const OfflineBanner: React.FC<OfflineBannerProps> = React.memo(
  ({
    showRetry = true,
    message = '인터넷 연결이 끊어졌습니다',
    onReconnect,
    variant = 'banner',
  }) => {
    const { isOffline, isChecking, checkConnection } = useNetworkStatus();
    const [isRetrying, setIsRetrying] = React.useState(false);
    const insets = useSafeAreaInsets();

    const handleRetry = useCallback(async () => {
      setIsRetrying(true);
      const isOnline = await checkConnection();
      setIsRetrying(false);

      if (isOnline) {
        onReconnect?.();
      }
    }, [checkConnection, onReconnect]);

    // 온라인 상태면 표시 안 함
    if (!isOffline) return null;

    // 토스트 스타일
    if (variant === 'toast') {
      return (
        <View
          className="absolute left-4 right-4 z-50"
          style={{ top: insets.top + 8 }}
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
        >
          <View className="flex-row items-center justify-between bg-error-600 dark:bg-error-700 px-4 py-3 rounded-lg shadow-lg">
            <View className="flex-row items-center flex-1">
              <WifiOff size={18} color="white" />
              <Text className="text-white text-sm font-sans-medium ml-2 flex-1">{message}</Text>
            </View>
            {showRetry && (
              <Pressable
                onPress={handleRetry}
                disabled={isRetrying || isChecking}
                className="ml-2 p-1"
                accessibilityRole="button"
                accessibilityLabel="네트워크 재연결 시도"
                accessibilityState={{ disabled: isRetrying || isChecking }}
              >
                {isRetrying || isChecking ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <RefreshCw size={18} color="white" />
                )}
              </Pressable>
            )}
          </View>
        </View>
      );
    }

    // 전체 화면 스타일
    if (variant === 'fullscreen') {
      return (
        <View
          className="absolute inset-0 z-50 bg-secondary-900/80 items-center justify-center px-6"
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
        >
          <View className="bg-surface-card rounded-lg p-8 items-center shadow-2xl max-w-sm w-full">
            <View className="w-20 h-20 bg-error-50 dark:bg-error-900/30 rounded-sm items-center justify-center mb-4">
              <WifiOff size={40} color={STATUS_COLORS.error} />
            </View>

            <Text className="text-xl font-display text-content-primary dark:text-off-white text-center mb-2">
              연결 끊김
            </Text>

            <Text className="text-content-muted dark:text-secondary-400 text-center mb-6 font-sans">
              {message}
            </Text>

            {showRetry && (
              <Pressable
                onPress={handleRetry}
                disabled={isRetrying || isChecking}
                className="w-full bg-primary-600 dark:bg-primary-700 py-3 px-6 rounded-md flex-row items-center justify-center active:opacity-80"
                accessibilityRole="button"
                accessibilityLabel="네트워크 재연결 시도"
                accessibilityState={{ disabled: isRetrying || isChecking }}
              >
                {isRetrying || isChecking ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <RefreshCw size={18} color="white" />
                    <Text className="text-white font-sans-semibold ml-2">다시 연결</Text>
                  </>
                )}
              </Pressable>
            )}
          </View>
        </View>
      );
    }

    // 기본 배너 스타일
    return (
      <View
        className="bg-error-600 dark:bg-error-700 px-4 pb-3"
        style={{ paddingTop: insets.top + 12 }}
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <WifiOff size={18} color="white" />
            <Text className="text-white text-sm font-sans-medium ml-2 flex-1">{message}</Text>
          </View>

          {showRetry && (
            <Pressable
              onPress={handleRetry}
              disabled={isRetrying || isChecking}
              className="flex-row items-center bg-white/20 px-3 py-1.5 rounded-sm active:opacity-80"
              accessibilityRole="button"
              accessibilityLabel="네트워크 재연결 시도"
              accessibilityState={{ disabled: isRetrying || isChecking }}
            >
              {isRetrying || isChecking ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <RefreshCw size={14} color="white" />
                  <Text className="text-white text-xs font-sans-medium ml-1">재시도</Text>
                </>
              )}
            </Pressable>
          )}
        </View>
      </View>
    );
  }
);

OfflineBanner.displayName = 'OfflineBanner';

export default OfflineBanner;

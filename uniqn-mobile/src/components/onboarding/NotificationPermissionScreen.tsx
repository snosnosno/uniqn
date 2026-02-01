/**
 * UNIQN Mobile - 알림 권한 요청 온보딩 화면
 *
 * @description 첫 로그인 후 알림 권한을 요청하는 풀스크린 화면
 * @version 1.0.0
 */

import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeInDown } from 'react-native-reanimated';
import { useCallback, useState } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface NotificationPermissionScreenProps {
  /** 권한 요청 함수 */
  onRequestPermission: () => Promise<boolean>;
  /** 나중에 하기 */
  onSkip: () => void;
  /** 로딩 상태 */
  isLoading?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const BENEFITS = [
  {
    icon: 'briefcase-outline' as const,
    title: '새 공고 알림',
    description: '관심 지역의 새 공고가 올라오면 바로 알려드려요',
  },
  {
    icon: 'checkmark-circle-outline' as const,
    title: '지원 결과 알림',
    description: '지원 확정/취소 결과를 실시간으로 받아보세요',
  },
  {
    icon: 'time-outline' as const,
    title: '출퇴근 리마인더',
    description: '근무 시작 전 알림으로 지각을 방지해요',
  },
  {
    icon: 'cash-outline' as const,
    title: '정산 알림',
    description: '정산이 완료되면 즉시 알려드려요',
  },
];

// ============================================================================
// Component
// ============================================================================

export function NotificationPermissionScreen({
  onRequestPermission,
  onSkip,
  isLoading = false,
}: NotificationPermissionScreenProps) {
  const [isRequesting, setIsRequesting] = useState(false);

  const handleRequestPermission = useCallback(async () => {
    setIsRequesting(true);
    try {
      await onRequestPermission();
    } finally {
      setIsRequesting(false);
    }
  }, [onRequestPermission]);

  const loading = isLoading || isRequesting;

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-surface-dark">
      <View className="flex-1 px-6 py-8">
        {/* 헤더 */}
        <Animated.View entering={FadeInUp.delay(100).duration(500)} className="items-center mb-8">
          <View className="w-20 h-20 rounded-full bg-purple-100 dark:bg-purple-900/30 items-center justify-center mb-4">
            <Ionicons name="notifications" size={40} color="#A855F7" />
          </View>
          <Text className="text-2xl font-bold text-gray-900 dark:text-white text-center">
            알림을 켜주세요
          </Text>
          <Text className="text-base text-gray-500 dark:text-gray-400 text-center mt-2">
            중요한 소식을 놓치지 않도록{'\n'}알림을 허용해 주세요
          </Text>
        </Animated.View>

        {/* 혜택 목록 */}
        <View className="flex-1 justify-center">
          {BENEFITS.map((benefit, index) => (
            <Animated.View
              key={benefit.title}
              entering={FadeInUp.delay(200 + index * 100).duration(500)}
              className="flex-row items-center py-4 px-4 mb-3 bg-gray-50 dark:bg-surface rounded-xl"
            >
              <View className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 items-center justify-center mr-4">
                <Ionicons name={benefit.icon} size={24} color="#A855F7" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-gray-900 dark:text-white">
                  {benefit.title}
                </Text>
                <Text className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {benefit.description}
                </Text>
              </View>
            </Animated.View>
          ))}
        </View>

        {/* 버튼 영역 */}
        <Animated.View entering={FadeInDown.delay(600).duration(500)} className="mt-auto">
          {/* 허용 버튼 */}
          <Pressable
            onPress={handleRequestPermission}
            disabled={loading}
            accessibilityLabel="알림 허용하기"
            accessibilityRole="button"
            accessibilityState={{ disabled: loading }}
            className={`py-4 rounded-xl items-center mb-3 ${
              loading
                ? 'bg-purple-400 dark:bg-purple-800'
                : 'bg-purple-600 active:bg-purple-700 dark:bg-purple-700 dark:active:bg-purple-600'
            }`}
          >
            <Text className="text-white font-semibold text-base">
              {loading ? '요청 중...' : '알림 허용하기'}
            </Text>
          </Pressable>

          {/* 나중에 버튼 */}
          <Pressable
            onPress={onSkip}
            disabled={loading}
            accessibilityLabel="나중에 하기"
            accessibilityRole="button"
            accessibilityState={{ disabled: loading }}
            className="py-4 rounded-xl items-center"
          >
            <Text className="text-gray-500 dark:text-gray-400 text-base">나중에 하기</Text>
          </Pressable>

          {/* 안내 문구 */}
          <Text className="text-xs text-gray-400 dark:text-gray-500 text-center mt-4">
            설정 {'>'} 알림에서 언제든 변경할 수 있어요
          </Text>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

export default NotificationPermissionScreen;

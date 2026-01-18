/**
 * UNIQN Mobile - TabHeader 컴포넌트
 *
 * @description 탭 페이지용 공통 헤더
 * - QR 코드 버튼
 * - 알림 버튼 (실시간 배지)
 * - 설정 버튼 (선택)
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { BellIcon, QrCodeIcon, SettingsIcon } from '@/components/icons';
import { NotificationBadge } from '@/components/notifications';
import { useUnreadCountRealtime } from '@/hooks/useNotifications';

interface TabHeaderProps {
  /** 헤더 제목 */
  title: string;
  /** QR 버튼 표시 여부 (기본: true) */
  showQR?: boolean;
  /** 알림 버튼 표시 여부 (기본: true) */
  showNotification?: boolean;
  /** 설정 버튼 표시 여부 (기본: false) */
  showSettings?: boolean;
  /** 추가 오른쪽 액션 */
  rightAction?: React.ReactNode;
}

/**
 * 탭 페이지용 공통 헤더
 *
 * 사용 예시:
 * ```tsx
 * <TabHeader title="구인구직" />
 * <TabHeader title="프로필" showSettings />
 * <TabHeader title="내 공고" rightAction={<CustomButton />} />
 * ```
 */
export function TabHeader({
  title,
  showQR = true,
  showNotification = true,
  showSettings = false,
  rightAction,
}: TabHeaderProps) {
  // 읽지 않은 알림 수 (실시간)
  const unreadCount = useUnreadCountRealtime();

  return (
    <View className="flex-row items-center justify-between bg-white px-4 py-3 dark:bg-gray-800">
      {/* 제목 */}
      <Text className="text-xl font-bold text-gray-900 dark:text-gray-100">
        {title}
      </Text>

      {/* 오른쪽 액션 버튼들 */}
      <View className="flex-row items-center gap-2">
        {/* 커스텀 액션 */}
        {rightAction}

        {/* QR 코드 버튼 */}
        {showQR && (
          <Pressable
            onPress={() => router.push('/(app)/(tabs)/qr')}
            className="p-2"
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="QR 코드"
          >
            <QrCodeIcon size={24} color="#6B7280" />
          </Pressable>
        )}

        {/* 알림 버튼 */}
        {showNotification && (
          <Pressable
            onPress={() => router.push('/(app)/notifications')}
            className="p-2"
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`알림${unreadCount > 0 ? `, ${unreadCount}개의 읽지 않은 알림` : ''}`}
          >
            <BellIcon size={24} color="#6B7280" />
            {/* 알림 배지 (실시간) */}
            <NotificationBadge count={unreadCount} size="sm" />
          </Pressable>
        )}

        {/* 설정 버튼 */}
        {showSettings && (
          <Pressable
            onPress={() => router.push('/(app)/settings')}
            className="p-2"
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="설정"
          >
            <SettingsIcon size={24} color="#6B7280" />
          </Pressable>
        )}
      </View>
    </View>
  );
}

export default TabHeader;

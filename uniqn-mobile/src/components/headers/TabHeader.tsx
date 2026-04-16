import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { router, usePathname } from 'expo-router';
import { BellIcon, QrCodeIcon, SettingsIcon } from '@/components/icons';
import { NotificationBadge } from '@/components/notifications';
import { getIconColor, getLayoutColor, HEADER_CLASSES } from '@/constants';
import { useThemeStore } from '@/stores/themeStore';
import { useUnreadCount } from '@/stores/notificationStore';

interface TabHeaderProps {
  title: string;
  showQR?: boolean;
  showNotification?: boolean;
  showSettings?: boolean;
  rightAction?: React.ReactNode;
}

export function TabHeader({
  title,
  showQR = true,
  showNotification = true,
  showSettings = false,
  rightAction,
}: TabHeaderProps) {
  const unreadCount = useUnreadCount();
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  const headerBackgroundColor = getLayoutColor(isDarkMode, 'header');
  const headerTintColor = getLayoutColor(isDarkMode, 'headerTint');
  const actionColor = getIconColor(isDarkMode, 'primary');
  const pathname = usePathname();

  const handleLogoPress = () => {
    if (pathname === '/(app)/home') {
      return;
    }
    router.push('/(app)/home');
  };

  return (
    <View
      className="h-12 flex-row items-center px-4"
      style={{ backgroundColor: headerBackgroundColor }}
    >
      {/* 중앙 로고 (absolute — 항상 화면 정중앙) */}
      <Pressable
        onPress={handleLogoPress}
        hitSlop={8}
        className={`absolute left-0 right-0 items-center ${HEADER_CLASSES.actionPressed}`}
        accessibilityRole="button"
        accessibilityLabel="UNIQN 홈으로 이동"
      >
        <Text className="font-display text-lg font-bold" style={{ color: '#D4AF37' }}>
          UNIQN
        </Text>
      </Pressable>

      {/* 좌: 탭 제목 */}
      <View className="flex-1 items-start" style={{ paddingRight: 60 }}>
        <Text
          className={`text-base font-semibold ${HEADER_CLASSES.title}`}
          numberOfLines={1}
          style={{ color: headerTintColor }}
        >
          {title}
        </Text>
      </View>

      {/* 우: actions */}
      <View className="flex-1 flex-row items-center justify-end" style={{ paddingLeft: 60 }}>
        {rightAction}

        {showQR ? (
          <Pressable
            onPress={() => router.push('/(app)/(tabs)/qr')}
            className={`rounded-sm p-2 ${HEADER_CLASSES.actionPressed}`}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="QR 코드"
          >
            <QrCodeIcon size={24} color={actionColor} />
          </Pressable>
        ) : null}

        {showNotification ? (
          <Pressable
            onPress={() => router.push('/(app)/notifications')}
            className={`relative rounded-sm p-2 ${HEADER_CLASSES.actionPressed}`}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`알림${unreadCount > 0 ? `, ${unreadCount}개의 읽지 않은 알림` : ''}`}
          >
            <BellIcon size={24} color={actionColor} />
            <NotificationBadge count={unreadCount} size="sm" />
          </Pressable>
        ) : null}

        {showSettings ? (
          <Pressable
            onPress={() => router.push('/(app)/settings')}
            className={`rounded-sm p-2 ${HEADER_CLASSES.actionPressed}`}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="설정"
          >
            <SettingsIcon size={24} color={actionColor} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default TabHeader;

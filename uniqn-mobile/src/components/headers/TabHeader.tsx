import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
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

  return (
    <View
      className="flex-row items-center justify-between px-4 py-3"
      style={{ backgroundColor: headerBackgroundColor }}
    >
      <Text className="text-xl font-display" style={{ color: headerTintColor }}>
        {title}
      </Text>

      <View className="flex-row items-center gap-2">
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

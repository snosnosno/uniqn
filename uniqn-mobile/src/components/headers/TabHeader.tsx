import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { router, usePathname } from 'expo-router';
import { BellIcon, MoonIcon, QrCodeIcon, SettingsIcon, SunIcon } from '@/components/icons';
import { NotificationBadge } from '@/components/notifications';
import { getIconColor, getLayoutColor, HEADER_CLASSES } from '@/constants';
import { useThemeStore } from '@/stores/themeStore';
import { useUnreadCount } from '@/stores/notificationStore';

interface TabHeaderProps {
  title: string;
  showQR?: boolean;
  showNotification?: boolean;
  showSettings?: boolean;
  showThemeToggle?: boolean;
  rightAction?: React.ReactNode;
}

export function TabHeader({
  title,
  showQR = true,
  showNotification = true,
  showSettings = false,
  showThemeToggle = false,
  rightAction,
}: TabHeaderProps) {
  const unreadCount = useUnreadCount();
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const headerBackgroundColor = getLayoutColor(isDarkMode, 'header');
  const headerTintColor = getLayoutColor(isDarkMode, 'headerTint');
  const actionColor = getIconColor(isDarkMode, 'primary');
  const pathname = usePathname();

  const handleLogoPress = () => {
    // pathname은 플랫폼에 따라 '/home' 또는 '/(app)/home'로 반환됨
    const isOnHome = pathname === '/home' || pathname === '/(app)/home';
    if (isOnHome) {
      return;
    }
    router.push('/(app)/home');
  };

  return (
    <View
      className="h-12 flex-row items-center px-4"
      style={{ backgroundColor: headerBackgroundColor, overflow: 'visible', zIndex: 1 }}
    >
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
      <View
        className="flex-1 flex-row items-center justify-end"
        style={{ paddingLeft: 60, overflow: 'visible', zIndex: 10 }}
      >
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
            style={{ overflow: 'visible', zIndex: 10 }}
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

        {showThemeToggle ? (
          <Pressable
            onPress={toggleTheme}
            className={`rounded-sm p-2 ${HEADER_CLASSES.actionPressed}`}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={isDarkMode ? '라이트 모드로 전환' : '다크 모드로 전환'}
          >
            {isDarkMode ? (
              <SunIcon size={24} color={actionColor} />
            ) : (
              <MoonIcon size={24} color={actionColor} />
            )}
          </Pressable>
        ) : null}
      </View>

      {/* 중앙 로고 (absolute + pointerEvents box-none — 실제 로고만 tap 영역) */}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Pressable
          onPress={handleLogoPress}
          hitSlop={8}
          className={`px-3 py-1 ${HEADER_CLASSES.actionPressed}`}
          accessibilityRole="button"
          accessibilityLabel="UNIQN 홈으로 이동"
        >
          <Text className="font-display text-lg font-bold" style={{ color: '#D4AF37' }}>
            UNIQN
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default TabHeader;

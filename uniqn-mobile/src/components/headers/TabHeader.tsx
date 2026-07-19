import React from 'react';
import { View, Text, Pressable, PixelRatio } from 'react-native';
import { router } from 'expo-router';
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
          maxFontSizeMultiplier={1.5}
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

      {/* 중앙 로고 (absolute + pointerEvents none — 표시 전용 브랜드 마크) */}
      <View
        pointerEvents="none"
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
        <Text
          className="font-display font-bold px-3 py-1"
          allowFontScaling={false}
          style={{
            color: '#D4AF37',
            // impeccable §27 — 브랜드 마크는 Dynamic Type 영향을 받되 극단 스케일
            // (예: 200%)에서 헤더 레이아웃 붕괴 방지. 기본 + 최대 1.5배까지만 확대.
            fontSize: 18 * Math.min(PixelRatio.getFontScale(), 1.5),
          }}
        >
          UNIQN
        </Text>
      </View>
    </View>
  );
}

/**
 * UNIQN Mobile - NotificationBadge 컴포넌트
 *
 * @description 읽지 않은 알림 수를 표시하는 뱃지
 * @version 1.1.0
 */

import React, { memo } from 'react';
import { Platform, View, Text } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { STATUS_COLORS } from '@/constants/colors';

export interface NotificationBadgeProps {
  /** 알림 수 */
  count: number;
  /** 최대 표시 수 (기본: 99) */
  maxCount?: number;
  /** 크기 (기본: md) */
  size?: 'sm' | 'md' | 'lg';
  /** 커스텀 스타일 */
  className?: string;
}

const sizeStyles = {
  sm: {
    container: 'min-w-[18px] h-[18px] px-1',
    text: 'text-micro',
  },
  md: {
    container: 'min-w-[20px] h-[20px] px-1.5',
    text: 'text-[11px] font-sans',
  },
  lg: {
    container: 'min-w-[24px] h-[24px] px-1.5',
    text: 'text-sm font-sans',
  },
};

const badgeShadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  android: {
    elevation: 3,
  },
  default: {},
});

const sizeInlineStyles = {
  sm: { minWidth: 18, height: 18, paddingHorizontal: 4, fontSize: 10 },
  md: { minWidth: 20, height: 20, paddingHorizontal: 6, fontSize: 11 },
  lg: { minWidth: 24, height: 24, paddingHorizontal: 6, fontSize: 14 },
};

export const NotificationBadge = memo(function NotificationBadge({
  count,
  maxCount = 99,
  size = 'md',
}: NotificationBadgeProps) {
  if (count <= 0) return null;

  const displayCount = count > maxCount ? `${maxCount}+` : String(count);
  const s = sizeInlineStyles[size];

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      accessibilityLabel={`읽지 않은 알림 ${count}개`}
      style={{
        position: 'absolute',
        top: -4,
        right: -4,
        zIndex: 20,
        minWidth: s.minWidth,
        height: s.height,
        paddingHorizontal: s.paddingHorizontal,
        backgroundColor: STATUS_COLORS.error,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#FFFFFF',
        ...badgeShadow,
      }}
    >
      <Text
        style={{
          color: '#FFFFFF',
          fontSize: s.fontSize,
          fontWeight: '700',
          lineHeight: s.fontSize + 2,
        }}
      >
        {displayCount}
      </Text>
    </Animated.View>
  );
});

/**
 * 인라인 뱃지 (절대 위치가 아닌 인라인 표시용)
 */
export const NotificationBadgeInline = memo(function NotificationBadgeInline({
  count,
  maxCount = 99,
  size = 'md',
  className = '',
}: NotificationBadgeProps) {
  if (count <= 0) return null;

  const displayCount = count > maxCount ? `${maxCount}+` : String(count);
  const styles = sizeStyles[size];

  return (
    <View
      accessibilityLabel={`읽지 않은 알림 ${count}개`}
      className={`
        bg-error-500 rounded-full
        items-center justify-center
        ${styles.container}
        ${className}
      `}
    >
      <Text className={`text-white font-sans-bold ${styles.text}`}>{displayCount}</Text>
    </View>
  );
});

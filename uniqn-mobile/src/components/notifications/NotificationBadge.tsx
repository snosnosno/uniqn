/**
 * UNIQN Mobile - NotificationBadge 컴포넌트
 *
 * @description 읽지 않은 알림 수를 표시하는 뱃지
 * @version 1.0.0
 */

import React from 'react';
import { View, Text } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

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
    container: 'min-w-[14px] h-[14px] px-0.5',
    text: 'text-[10px]',
  },
  md: {
    container: 'min-w-[18px] h-[18px] px-1',
    text: 'text-xs',
  },
  lg: {
    container: 'min-w-[22px] h-[22px] px-1.5',
    text: 'text-sm',
  },
};

export function NotificationBadge({
  count,
  maxCount = 99,
  size = 'md',
  className = '',
}: NotificationBadgeProps) {
  if (count <= 0) return null;

  const displayCount = count > maxCount ? `${maxCount}+` : String(count);
  const styles = sizeStyles[size];

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      className={`
        absolute -top-1 -right-1
        bg-error-500 rounded-full
        items-center justify-center
        ${styles.container}
        ${className}
      `}
    >
      <Text className={`text-white font-bold ${styles.text}`}>
        {displayCount}
      </Text>
    </Animated.View>
  );
}

/**
 * 인라인 뱃지 (절대 위치가 아닌 인라인 표시용)
 */
export function NotificationBadgeInline({
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
      className={`
        bg-error-500 rounded-full
        items-center justify-center
        ${styles.container}
        ${className}
      `}
    >
      <Text className={`text-white font-bold ${styles.text}`}>
        {displayCount}
      </Text>
    </View>
  );
}

export default NotificationBadge;

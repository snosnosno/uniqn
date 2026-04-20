/**
 * PressableCard — Pressed 역방향 + Focus ring(Info 블루 2px outset) 공용 Pressable
 *
 * 룰 근거:
 * - impeccable-design.md §21 Pressed 피드백 다크/라이트 반대 방향
 * - impeccable-design.md §22 Focus ring Info 블루 2px outset (layout shift 방지)
 *
 * Focus ring 패턴: `m-[-2px] + border-2 border-transparent`
 *  → 포커스 시 border만 색 바꿔 레이아웃 시프트 없이 외곽 2px 링 표현
 *
 * Pressed 피드백 역방향:
 *  - 라이트: surface-hover(어두워짐)
 *  - 다크:   surface-hover(#2E2E34, 약간 밝아짐) — active: 다크 모드에서도 동일 토큰 사용
 *    → 토큰 `surface-hover`는 다크 팔레트 기준 "한 단계 elevation up" 색이라 역방향 효과 제공
 */

import React, { useState, useCallback } from 'react';
import {
  Pressable,
  Platform,
  type PressableProps,
  type NativeSyntheticEvent,
  type TargetedEvent,
} from 'react-native';
import { useThemeStore } from '@/stores/themeStore';

export interface PressableCardProps extends PressableProps {
  children: React.ReactNode;
  className?: string;
  testID?: string;
}

export function PressableCard({
  children,
  className = '',
  onPress,
  onFocus,
  onBlur,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  testID,
  ...rest
}: PressableCardProps) {
  const isDark = useThemeStore((s) => s.isDarkMode);
  const [focused, setFocused] = useState(false);

  const handleFocus = useCallback(
    (e: NativeSyntheticEvent<TargetedEvent>) => {
      setFocused(true);
      onFocus?.(e);
    },
    [onFocus]
  );

  const handleBlur = useCallback(
    (e: NativeSyntheticEvent<TargetedEvent>) => {
      setFocused(false);
      onBlur?.(e);
    },
    [onBlur]
  );

  // outset focus ring: margin -2px + transparent 2px border → 색만 바꿔 layout shift 방지
  const baseClasses =
    'rounded-md m-[-2px] border-2 border-transparent bg-surface-card dark:bg-surface-elevated active:bg-surface-hover dark:active:bg-surface-hover';

  const focusClass = focused ? 'border-info-500' : '';

  const composedClassName = [baseClasses, focusClass, className].filter(Boolean).join(' ');

  return (
    <Pressable
      {...rest}
      onPress={onPress}
      onFocus={handleFocus}
      onBlur={handleBlur}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      testID={testID}
      android_ripple={
        Platform.OS === 'android'
          ? { color: isDark ? '#333333' : '#E5E5E5', borderless: false }
          : undefined
      }
      className={composedClassName}
    >
      {children}
    </Pressable>
  );
}

export default PressableCard;

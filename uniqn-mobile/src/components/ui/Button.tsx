/**
 * UNIQN Mobile - Button 컴포넌트
 *
 * @description 다양한 스타일과 상태를 지원하는 버튼
 * @version 1.1.0
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { memo, useCallback, useState } from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  View,
  type PressableProps,
  type NativeSyntheticEvent,
  type TargetedEvent,
} from 'react-native';
import { useThemeStore } from '@/stores/themeStore';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'accent';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'children'> {
  /** 버튼 텍스트 또는 컨텐츠 */
  children: React.ReactNode;
  /** 버튼 스타일 변형 */
  variant?: ButtonVariant;
  /** 버튼 크기 */
  size?: ButtonSize;
  /** 로딩 상태 */
  loading?: boolean;
  /** 비활성화 상태 */
  disabled?: boolean;
  /** 아이콘 요소 */
  icon?: React.ReactNode;
  /** 아이콘 위치 */
  iconPosition?: 'left' | 'right';
  /** 전체 너비 사용 */
  fullWidth?: boolean;
  /** 접근성 라벨 (미지정시 children 문자열 사용) */
  accessibilityLabel?: string;
  className?: string;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-primary-600 active:bg-primary-700 dark:bg-primary-500 dark:active:bg-primary-600',
  secondary:
    'bg-secondary-100 active:bg-secondary-200 dark:bg-surface-elevated dark:active:bg-surface-overlay',
  // 테두리는 WCAG 1.4.11(비텍스트 3:1) 충족값 사용.
  // secondary-300(1.66:1)/surface-overlay(1.31:1)는 실기기에서 테두리가 보이지 않아
  // 버튼이 버튼으로 인지되지 않았다 (2026-07-19). secondary-600 = light 4.49:1 / dark 4.00:1.
  outline:
    'bg-transparent border border-secondary-600 active:bg-secondary-50 dark:border-secondary-600 dark:active:bg-surface-elevated',
  ghost: 'bg-transparent active:bg-secondary-100 dark:active:bg-surface-elevated',
  danger: 'bg-error-600 active:bg-error-700 dark:bg-error-500 dark:active:bg-error-600',
  accent: 'bg-accent-500 active:bg-accent-600 dark:bg-accent-400 dark:active:bg-accent-500',
};

const variantTextStyles: Record<ButtonVariant, string> = {
  primary: 'text-content-onGold font-bold',
  secondary: 'text-secondary-900 dark:text-secondary-100',
  outline: 'text-secondary-900 dark:text-secondary-100',
  ghost: 'text-secondary-900 dark:text-secondary-100',
  danger: 'text-white',
  accent: 'text-content-onGold font-bold',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-2.5 min-h-[44px]', // WCAG 2.1 터치 타겟 최소 44px 준수
  md: 'px-4 py-3 min-h-[44px]',
  lg: 'px-6 py-4 min-h-[52px]',
};

const sizeTextStyles: Record<ButtonSize, string> = {
  sm: 'text-sm font-sans',
  md: 'text-base font-sans',
  lg: 'text-lg',
};

/** 로딩 인디케이터 색상 (variant별, 다크모드 지원) */
const LOADER_COLORS: Record<ButtonVariant, { light: string; dark: string }> = {
  primary: { light: '#050506', dark: '#050506' },
  secondary: { light: SECONDARY_PALETTE[500], dark: SECONDARY_PALETTE[200] },
  outline: { light: SECONDARY_PALETTE[500], dark: SECONDARY_PALETTE[200] },
  ghost: { light: SECONDARY_PALETTE[500], dark: SECONDARY_PALETTE[200] },
  danger: { light: '#FFFFFF', dark: '#FFFFFF' },
  accent: { light: '#050506', dark: '#050506' }, // 다크 텍스트
};

/**
 * 버튼 컴포넌트
 *
 * 다양한 variant, size, 아이콘 지원
 * 접근성을 위한 accessibilityLabel 자동/수동 설정 지원
 */
export const Button = memo(function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  accessibilityLabel,
  className,
  onFocus,
  onBlur,
  ...props
}: ButtonProps) {
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  const isDisabled = disabled || loading;
  const loaderColor = isDarkMode ? LOADER_COLORS[variant].dark : LOADER_COLORS[variant].light;
  const [focused, setFocused] = useState(false);

  // Focus ring — PressableCard와 동일 idiom: m-[-2px] + border-2 border-transparent
  // 포커스 시 border 색만 변경 → layout shift 없는 2px outset info-blue ring
  // impeccable-design.md §22 Focus ring Info 블루 2px outset
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

  // children이 문자열인 경우 자동으로 accessibilityLabel 생성
  const resolvedAccessibilityLabel =
    accessibilityLabel ?? (typeof children === 'string' ? children : undefined);

  // impeccable v2 §22 — 외부 키보드 사용자용 focus ring(Info 블루 #2563EB 2px).
  // NativeWind focus: modifier + outset 예약(투명 border)으로 layout shift 방지.
  const buttonClass = [
    'flex-row items-center justify-center rounded',
    'border-2 border-transparent',
    'focus:border-[#2563EB]',
    variantStyles[variant],
    sizeStyles[size],
    fullWidth ? 'w-full' : '',
    isDisabled ? 'opacity-50' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  const textClass = `font-sans-semibold ${variantTextStyles[variant]} ${sizeTextStyles[size]}`;
  // Focus ring wrapper class — variant의 기존 border(outline 등)와 충돌 방지를 위해 외부 View로 감쌈
  // fullWidth는 inner Pressable이 가져가므로 wrapper에는 self-stretch만 필요 (inline-block 방지)
  const focusRingClass = `rounded m-[-2px] border-2 ${focused ? 'border-info-500' : 'border-transparent'}`;
  // children 이 텍스트인지 판별해 <Text> 로 감싼다.
  // `부족 {n}명 모집` 같은 보간 라벨은 JSX 가 배열로 넘기므로 typeof 검사만으로는
  // 걸러지지 않아 날 문자열이 Pressable 아래로 들어가 RN 이 렌더하지 않는다
  // (실기기 2026-07-19 라벨 증발). 평탄화 후 판정한다.
  const childArray = React.Children.toArray(children);
  const isTextual = (node: React.ReactNode): node is string | number =>
    typeof node === 'string' || typeof node === 'number';

  const content =
    childArray.length > 0 && childArray.every(isTextual) ? (
      // 전부 텍스트 — 하나의 Text 로 감싸 자연스러운 줄바꿈/말줄임 유지
      <Text className={textClass}>{children}</Text>
    ) : (
      // 요소가 섞인 경우 — 요소는 보존하고 흩어진 텍스트 노드만 개별 래핑
      childArray.map((child, index) =>
        isTextual(child) ? (
          <Text key={`btn-text-${index}`} className={textClass}>
            {child}
          </Text>
        ) : (
          child
        )
      )
    );

  return (
    <View className={focusRingClass}>
      <Pressable
        {...props}
        disabled={isDisabled}
        onFocus={handleFocus}
        onBlur={handleBlur}
        accessibilityRole="button"
        accessibilityLabel={resolvedAccessibilityLabel}
        accessibilityState={{
          disabled: isDisabled,
          busy: loading,
        }}
        className={buttonClass}
      >
        {loading ? (
          <ActivityIndicator color={loaderColor} size="small" />
        ) : (
          <>
            {icon && iconPosition === 'left' && <View className="mr-2">{icon}</View>}
            {content}
            {icon && iconPosition === 'right' && <View className="ml-2">{icon}</View>}
          </>
        )}
      </Pressable>
    </View>
  );
});

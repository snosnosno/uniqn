/**
 * UNIQN Mobile - Button 컴포넌트
 *
 * @description 다양한 스타일과 상태를 지원하는 버튼
 * @version 1.1.0
 */

import React, { memo } from 'react';
import { Pressable, Text, ActivityIndicator, View, PressableProps } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
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
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-primary-600 active:bg-primary-700 dark:bg-primary-500 dark:active:bg-primary-600',
  secondary: 'bg-gray-100 active:bg-gray-200 dark:bg-gray-700 dark:active:bg-gray-600',
  outline:
    'bg-transparent border border-gray-300 active:bg-gray-50 dark:border-gray-600 dark:active:bg-gray-800',
  ghost: 'bg-transparent active:bg-gray-100 dark:active:bg-gray-800',
  danger: 'bg-error-600 active:bg-error-700 dark:bg-error-500 dark:active:bg-error-600',
};

const variantTextStyles: Record<ButtonVariant, string> = {
  primary: 'text-white',
  secondary: 'text-gray-900 dark:text-gray-100',
  outline: 'text-gray-900 dark:text-gray-100',
  ghost: 'text-gray-900 dark:text-gray-100',
  danger: 'text-white',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-2.5 min-h-[44px]', // WCAG 2.1 터치 타겟 최소 44px 준수
  md: 'px-4 py-3 min-h-[44px]',
  lg: 'px-6 py-4 min-h-[52px]',
};

const sizeTextStyles: Record<ButtonSize, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
};

/** 로딩 인디케이터 색상 (variant별, 다크모드 지원) */
const LOADER_COLORS: Record<ButtonVariant, { light: string; dark: string }> = {
  primary: { light: '#ffffff', dark: '#ffffff' },
  secondary: { light: '#6B7280', dark: '#D1D5DB' },
  outline: { light: '#6B7280', dark: '#D1D5DB' },
  ghost: { light: '#6B7280', dark: '#D1D5DB' },
  danger: { light: '#ffffff', dark: '#ffffff' },
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
  ...props
}: ButtonProps) {
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  const isDisabled = disabled || loading;
  const loaderColor = isDarkMode ? LOADER_COLORS[variant].dark : LOADER_COLORS[variant].light;

  // children이 문자열인 경우 자동으로 accessibilityLabel 생성
  const resolvedAccessibilityLabel =
    accessibilityLabel ??
    (typeof children === 'string' ? children : undefined);

  const buttonClass = `flex-row items-center justify-center rounded-lg ${variantStyles[variant]} ${sizeStyles[size]} ${fullWidth ? 'w-full' : ''} ${isDisabled ? 'opacity-50' : ''}`.trim();
  const textClass = `font-semibold ${variantTextStyles[variant]} ${sizeTextStyles[size]}`;

  return (
    <Pressable
      {...props}
      disabled={isDisabled}
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
          <Text className={textClass}>{children}</Text>
          {icon && iconPosition === 'right' && <View className="ml-2">{icon}</View>}
        </>
      )}
    </Pressable>
  );
});

export default Button;

/**
 * UNIQN Mobile - Button 컴포넌트
 *
 * @description 다양한 스타일과 상태를 지원하는 버튼
 * @version 1.0.0
 */

import React from 'react';
import { Pressable, Text, ActivityIndicator, View, PressableProps } from 'react-native';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'children'> {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
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
  sm: 'px-3 py-2 min-h-[36px]',
  md: 'px-4 py-3 min-h-[44px]',
  lg: 'px-6 py-4 min-h-[52px]',
};

const sizeTextStyles: Record<ButtonSize, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const getLoaderColor = () => {
    if (variant === 'primary' || variant === 'danger') return '#ffffff';
    return '#6B7280';
  };

  return (
    <Pressable
      {...props}
      disabled={isDisabled}
      className={`
        flex-row items-center justify-center rounded-lg
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${fullWidth ? 'w-full' : ''}
        ${isDisabled ? 'opacity-50' : ''}
      `}
    >
      {loading ? (
        <ActivityIndicator color={getLoaderColor()} size="small" />
      ) : (
        <>
          {icon && iconPosition === 'left' && <View className="mr-2">{icon}</View>}
          <Text
            className={`
              font-semibold
              ${variantTextStyles[variant]}
              ${sizeTextStyles[size]}
            `}
          >
            {children}
          </Text>
          {icon && iconPosition === 'right' && <View className="ml-2">{icon}</View>}
        </>
      )}
    </Pressable>
  );
}

export default Button;

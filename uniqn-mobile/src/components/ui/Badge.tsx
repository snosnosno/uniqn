/**
 * UNIQN Mobile - Badge 컴포넌트
 *
 * @description 상태나 카테고리를 표시하는 배지
 * @version 1.0.0
 */

import React from 'react';
import { View, Text } from 'react-native';

type BadgeVariant = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error';
type BadgeSize = 'sm' | 'md';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 dark:bg-gray-700',
  primary: 'bg-primary-100 dark:bg-primary-900/30',
  secondary: 'bg-gray-200 dark:bg-gray-600',
  success: 'bg-success-100 dark:bg-success-700/30',
  warning: 'bg-warning-100 dark:bg-warning-700/30',
  error: 'bg-error-100 dark:bg-error-700/30',
};

const textStyles: Record<BadgeVariant, string> = {
  default: 'text-gray-700 dark:text-gray-300',
  primary: 'text-primary-700 dark:text-primary-300',
  secondary: 'text-gray-600 dark:text-gray-200',
  success: 'text-success-700 dark:text-success-500',
  warning: 'text-warning-700 dark:text-warning-500',
  error: 'text-error-700 dark:text-error-500',
};

const dotStyles: Record<BadgeVariant, string> = {
  default: 'bg-gray-500',
  primary: 'bg-primary-500',
  secondary: 'bg-gray-400',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  error: 'bg-error-500',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5',
  md: 'px-2.5 py-1',
};

const textSizeStyles: Record<BadgeSize, string> = {
  sm: 'text-xs',
  md: 'text-sm',
};

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  className = '',
}: BadgeProps) {
  return (
    <View
      className={`
        flex-row items-center rounded-full
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
    >
      {dot && (
        <View
          className={`
            mr-1.5 h-1.5 w-1.5 rounded-full
            ${dotStyles[variant]}
          `}
        />
      )}
      <Text
        className={`
          font-medium
          ${textStyles[variant]}
          ${textSizeStyles[size]}
        `}
      >
        {children}
      </Text>
    </View>
  );
}

export default Badge;

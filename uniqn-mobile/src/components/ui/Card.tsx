/**
 * UNIQN Mobile - Card 컴포넌트
 *
 * @description 콘텐츠를 그룹화하는 카드 컨테이너
 * @version 1.0.0
 */

import React from 'react';
import { View, Pressable, ViewProps } from 'react-native';

type CardVariant = 'elevated' | 'outlined' | 'filled';
type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends ViewProps {
  children: React.ReactNode;
  variant?: CardVariant;
  padding?: CardPadding;
  onPress?: () => void;
  className?: string;
  /** 접근성 라벨 (클릭 가능한 카드용) */
  accessibilityLabel?: string;
  /** 접근성 힌트 (클릭 가능한 카드용) */
  accessibilityHint?: string;
}

const variantStyles: Record<CardVariant, string> = {
  elevated: 'bg-white dark:bg-surface-elevated shadow-md',
  outlined: 'bg-white dark:bg-surface border border-gray-200 dark:border-surface-overlay',
  filled: 'bg-gray-50 dark:bg-surface',
};

const paddingStyles: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export function Card({
  children,
  variant = 'elevated',
  padding = 'md',
  onPress,
  className = '',
  accessibilityLabel,
  accessibilityHint,
  ...props
}: CardProps) {
  const cardContent = (
    <View
      className={`rounded-xl ${variantStyles[variant]} ${paddingStyles[padding]} ${className}`}
      {...props}
    >
      {children}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        className="active:opacity-80"
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint ?? '탭하면 상세 정보를 볼 수 있습니다'}
      >
        {cardContent}
      </Pressable>
    );
  }

  return cardContent;
}

export default Card;

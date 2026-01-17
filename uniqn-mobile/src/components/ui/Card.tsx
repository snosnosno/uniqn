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
}

const variantStyles: Record<CardVariant, string> = {
  elevated: 'bg-white dark:bg-gray-800 shadow-md',
  outlined: 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
  filled: 'bg-gray-50 dark:bg-gray-800',
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
      <Pressable onPress={onPress} className="active:opacity-80">
        {cardContent}
      </Pressable>
    );
  }

  return cardContent;
}

export default Card;

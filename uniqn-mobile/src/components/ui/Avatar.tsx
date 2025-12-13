/**
 * UNIQN Mobile - Avatar 컴포넌트
 *
 * @description 사용자 프로필 이미지 또는 이니셜 표시
 * @version 1.0.0
 */

import React from 'react';
import { View, Text, Image } from 'react-native';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  source?: string;
  name?: string;
  size?: AvatarSize;
  className?: string;
}

const sizeStyles: Record<AvatarSize, string> = {
  xs: 'h-6 w-6',
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
  xl: 'h-16 w-16',
};

const textSizeStyles: Record<AvatarSize, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
};

const getInitials = (name?: string): string => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const getBackgroundColor = (name?: string): string => {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-red-500',
    'bg-orange-500',
  ];

  if (!name) return colors[0];

  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
};

export function Avatar({ source, name, size = 'md', className = '' }: AvatarProps) {
  if (source) {
    return (
      <Image
        source={{ uri: source }}
        className={`rounded-full ${sizeStyles[size]} ${className}`}
      />
    );
  }

  return (
    <View
      className={`
        items-center justify-center rounded-full
        ${sizeStyles[size]}
        ${getBackgroundColor(name)}
        ${className}
      `}
    >
      <Text className={`font-semibold text-white ${textSizeStyles[size]}`}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

export default Avatar;

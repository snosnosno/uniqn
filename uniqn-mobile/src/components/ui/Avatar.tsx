/**
 * UNIQN Mobile - Avatar 컴포넌트
 *
 * @description expo-image 기반 프로필 이미지 또는 이니셜 표시
 * @version 1.1.0
 */

import React, { memo } from 'react';
import { View, Text } from 'react-native';
import { Image } from 'expo-image';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps {
  /** 이미지 URL */
  source?: string;
  /** 이니셜 생성용 이름 */
  name?: string;
  /** 아바타 크기 */
  size?: AvatarSize;
  /** 추가 스타일 클래스 */
  className?: string;
}

/** 사이즈별 컨테이너 스타일 */
const sizeStyles: Record<AvatarSize, string> = {
  xs: 'h-6 w-6',
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12',
  xl: 'h-16 w-16',
};

/** 사이즈별 텍스트 스타일 */
const textSizeStyles: Record<AvatarSize, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
};

/** 이름에서 이니셜 추출 */
const getInitials = (name?: string): string => {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

/** 이름 기반 배경색 선택 */
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

/**
 * Avatar 컴포넌트
 *
 * expo-image로 이미지 렌더링, 이미지 없으면 이니셜 표시
 */
export const Avatar = memo(function Avatar({
  source,
  name,
  size = 'md',
  className = '',
}: AvatarProps) {
  if (source) {
    return (
      <Image
        source={source}
        className={`rounded-full ${sizeStyles[size]} ${className}`}
        contentFit="cover"
        transition={200}
        cachePolicy="memory-disk"
        accessibilityLabel={name ? `${name} 프로필 사진` : '프로필 사진'}
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
      accessibilityLabel={name ? `${name} 아바타` : '사용자 아바타'}
    >
      <Text className={`font-semibold text-white ${textSizeStyles[size]}`}>
        {getInitials(name)}
      </Text>
    </View>
  );
});

export default Avatar;

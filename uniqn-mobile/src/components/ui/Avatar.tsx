/**
 * UNIQN Mobile - Avatar 컴포넌트
 *
 * @description expo-image 기반 프로필 이미지 또는 이니셜 표시
 * @version 1.4.0
 *
 * 변경사항
 * - 이미지 분기 크기를 style로 고정해 업로드 후에도 안정적으로 표시
 * - 이미지 로드 실패 시 제한된 자동 재시도로 일시 오류 복구
 * - 재시도 이후에도 실패하면 이니셜 아바타로 fallback
 */

import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import { Image } from 'expo-image';
import { DEFAULT_BLURHASH } from './OptimizedImage';

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface AvatarProps {
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

const sizePixels: Record<AvatarSize, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64,
};

const textSizeStyles: Record<AvatarSize, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
};

const IMAGE_RETRY_DELAYS_MS = [1500, 4000, 30000] as const;
const MAX_IMAGE_RETRY_ATTEMPTS = IMAGE_RETRY_DELAYS_MS.length;

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
    'bg-primary-500',
    'bg-success-500',
    'bg-warning-500',
    'bg-primary-500',
    'bg-pink-500',
    'bg-primary-500',
    'bg-error-500',
    'bg-orange-500',
  ];

  if (!name) return colors[0];

  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
};

export const Avatar = memo(function Avatar({
  source,
  name,
  size = 'md',
  className = '',
}: AvatarProps) {
  const [hasImageError, setHasImageError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const imageSize = sizePixels[size];
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);

  const clearRetryTimeout = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  const handleImageError = useCallback(() => {
    setHasImageError(true);
    clearRetryTimeout();

    if (retryCountRef.current >= MAX_IMAGE_RETRY_ATTEMPTS) {
      return;
    }

    const retryDelay = IMAGE_RETRY_DELAYS_MS[retryCountRef.current];
    retryCountRef.current += 1;
    retryTimeoutRef.current = setTimeout(() => {
      setHasImageError(false);
      setRetryKey((prev) => prev + 1);
    }, retryDelay);
  }, [clearRetryTimeout]);

  const handleImageLoad = useCallback(() => {
    clearRetryTimeout();
    retryCountRef.current = 0;
    setHasImageError(false);
  }, [clearRetryTimeout]);

  useEffect(() => {
    clearRetryTimeout();
    retryCountRef.current = 0;
    setHasImageError(false);
    setRetryKey(0);

    return clearRetryTimeout;
  }, [clearRetryTimeout, source]);

  if (source && !hasImageError) {
    return (
      <View
        className={`overflow-hidden rounded-sm ${className}`}
        style={{ width: imageSize, height: imageSize }}
      >
        <Image
          key={`${source}-${retryKey}`}
          source={source}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          placeholder={DEFAULT_BLURHASH.avatar}
          transition={200}
          cachePolicy="memory-disk"
          onLoad={handleImageLoad}
          onError={handleImageError}
          accessibilityLabel={name ? `${name} 프로필 사진` : '프로필 사진'}
        />
      </View>
    );
  }

  return (
    <View
      className={`
        items-center justify-center rounded-sm
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

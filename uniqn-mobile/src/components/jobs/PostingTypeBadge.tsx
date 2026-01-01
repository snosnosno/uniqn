/**
 * UNIQN Mobile - 공고 타입 뱃지 컴포넌트
 *
 * @description 4가지 공고 타입 (regular, fixed, tournament, urgent) 표시
 * @version 1.0.0
 */

import React, { memo } from 'react';
import { View, Text } from 'react-native';
import type { PostingType } from '@/types';
import { POSTING_TYPE_LABELS, POSTING_TYPE_BADGE_STYLES } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface PostingTypeBadgeProps {
  /** 공고 타입 */
  type: PostingType;
  /** 크기 */
  size?: 'sm' | 'md' | 'lg';
  /** 추가 클래스 */
  className?: string;
}

// ============================================================================
// Size Configurations
// ============================================================================

const SIZE_STYLES = {
  sm: {
    container: 'px-2 py-0.5 rounded',
    text: 'text-xs',
  },
  md: {
    container: 'px-2.5 py-1 rounded-md',
    text: 'text-sm',
  },
  lg: {
    container: 'px-3 py-1.5 rounded-lg',
    text: 'text-base',
  },
} as const;

// ============================================================================
// Component
// ============================================================================

/**
 * 공고 타입 뱃지 컴포넌트
 *
 * @example
 * <PostingTypeBadge type="urgent" />
 * <PostingTypeBadge type="tournament" size="lg" />
 */
export const PostingTypeBadge = memo(function PostingTypeBadge({
  type,
  size = 'sm',
  className = '',
}: PostingTypeBadgeProps) {
  const label = POSTING_TYPE_LABELS[type];
  const colors = POSTING_TYPE_BADGE_STYLES[type];
  const sizeStyle = SIZE_STYLES[size];

  // regular 타입은 뱃지 표시 안 함
  if (type === 'regular') {
    return null;
  }

  const containerClasses = [
    sizeStyle.container,
    colors.bgClass,
    colors.darkBgClass,
    className,
  ].join(' ');

  const textClasses = [
    sizeStyle.text,
    'font-medium',
    colors.textClass,
    colors.darkTextClass,
  ].join(' ');

  return (
    <View className={containerClasses}>
      <Text className={textClasses}>{label}</Text>
    </View>
  );
});

// ============================================================================
// Utility Components
// ============================================================================

/**
 * 긴급 공고 뱃지 (단축 컴포넌트)
 */
export const UrgentBadge = memo(function UrgentBadge({
  size = 'sm',
  className = '',
}: Omit<PostingTypeBadgeProps, 'type'>) {
  return <PostingTypeBadge type="urgent" size={size} className={className} />;
});

/**
 * 대회 공고 뱃지 (단축 컴포넌트)
 */
export const TournamentBadge = memo(function TournamentBadge({
  size = 'sm',
  className = '',
}: Omit<PostingTypeBadgeProps, 'type'>) {
  return <PostingTypeBadge type="tournament" size={size} className={className} />;
});

/**
 * 고정 공고 뱃지 (단축 컴포넌트)
 */
export const FixedBadge = memo(function FixedBadge({
  size = 'sm',
  className = '',
}: Omit<PostingTypeBadgeProps, 'type'>) {
  return <PostingTypeBadge type="fixed" size={size} className={className} />;
});

export default PostingTypeBadge;

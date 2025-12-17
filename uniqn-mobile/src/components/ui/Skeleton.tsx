/**
 * UNIQN Mobile - Skeleton 컴포넌트
 *
 * @description 로딩 스켈레톤 플레이스홀더
 * @version 1.0.0
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, type ViewStyle, type DimensionValue } from 'react-native';

// ============================================================================
// Types
// ============================================================================

interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  style?: ViewStyle;
  className?: string;
}

interface SkeletonTextProps {
  lines?: number;
  lineHeight?: number;
  lastLineWidth?: DimensionValue;
  className?: string;
}

interface SkeletonCardProps {
  className?: string;
}

// ============================================================================
// Base Skeleton Component
// ============================================================================

export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = 4,
  style,
  className,
}: SkeletonProps) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    shimmer.start();

    return () => shimmer.stop();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      className={`bg-gray-200 dark:bg-gray-700 ${className || ''}`}
      style={[
        {
          width,
          height,
          borderRadius,
          opacity,
        },
        style,
      ]}
    />
  );
}

// ============================================================================
// Text Skeleton
// ============================================================================

export function SkeletonText({
  lines = 3,
  lineHeight = 16,
  lastLineWidth = '60%',
  className,
}: SkeletonTextProps) {
  return (
    <View className={className}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          width={index === lines - 1 ? lastLineWidth : '100%'}
          height={lineHeight}
          style={{ marginBottom: index < lines - 1 ? 8 : 0 }}
        />
      ))}
    </View>
  );
}

// ============================================================================
// Card Skeleton
// ============================================================================

export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <View
      className={`bg-white dark:bg-gray-800 rounded-xl p-4 ${className || ''}`}
    >
      {/* Image placeholder */}
      <Skeleton width="100%" height={160} borderRadius={8} className="mb-4" />

      {/* Title */}
      <Skeleton width="70%" height={20} className="mb-3" />

      {/* Description */}
      <SkeletonText lines={2} lineHeight={14} lastLineWidth="40%" />

      {/* Action row */}
      <View className="flex-row items-center justify-between mt-4">
        <Skeleton width={80} height={32} borderRadius={16} />
        <Skeleton width={60} height={24} borderRadius={4} />
      </View>
    </View>
  );
}

// ============================================================================
// List Item Skeleton
// ============================================================================

export function SkeletonListItem() {
  return (
    <View className="flex-row items-center py-3 px-4">
      {/* Avatar */}
      <Skeleton
        width={48}
        height={48}
        borderRadius={24}
        style={{ marginRight: 12 }}
      />

      {/* Content */}
      <View className="flex-1">
        <Skeleton width="60%" height={18} className="mb-2" />
        <Skeleton width="40%" height={14} />
      </View>

      {/* Action */}
      <Skeleton width={24} height={24} borderRadius={4} />
    </View>
  );
}

// ============================================================================
// Avatar Skeleton
// ============================================================================

interface SkeletonAvatarProps {
  size?: number;
}

export function SkeletonAvatar({ size = 48 }: SkeletonAvatarProps) {
  return <Skeleton width={size} height={size} borderRadius={size / 2} />;
}

// ============================================================================
// Button Skeleton
// ============================================================================

interface SkeletonButtonProps {
  width?: DimensionValue;
}

export function SkeletonButton({ width = 120 }: SkeletonButtonProps) {
  return <Skeleton width={width} height={44} borderRadius={8} />;
}

// ============================================================================
// Job Card Skeleton (앱 특화)
// ============================================================================

export function SkeletonJobCard() {
  return (
    <View className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-3">
      {/* Header */}
      <View className="flex-row items-center mb-3">
        <Skeleton width={40} height={40} borderRadius={8} />
        <View className="flex-1 ml-3">
          <Skeleton width="70%" height={18} className="mb-2" />
          <Skeleton width="40%" height={14} />
        </View>
        <Skeleton width={60} height={24} borderRadius={4} />
      </View>

      {/* Tags */}
      <View className="flex-row mb-3">
        <Skeleton width={60} height={24} borderRadius={12} className="mr-2" />
        <Skeleton width={80} height={24} borderRadius={12} className="mr-2" />
        <Skeleton width={50} height={24} borderRadius={12} />
      </View>

      {/* Info rows */}
      <View className="flex-row justify-between">
        <Skeleton width="30%" height={14} />
        <Skeleton width="25%" height={14} />
        <Skeleton width="20%" height={14} />
      </View>
    </View>
  );
}

// ============================================================================
// Schedule Card Skeleton (앱 특화)
// ============================================================================

export function SkeletonScheduleCard() {
  return (
    <View className="bg-white dark:bg-gray-800 rounded-xl p-4 mb-3">
      {/* Date */}
      <View className="flex-row items-center mb-3">
        <Skeleton width={36} height={36} borderRadius={18} />
        <View className="ml-3">
          <Skeleton width={100} height={16} className="mb-1" />
          <Skeleton width={60} height={14} />
        </View>
      </View>

      {/* Time slots */}
      <Skeleton width="80%" height={16} className="mb-2" />
      <Skeleton width="60%" height={14} />
    </View>
  );
}

export default Skeleton;

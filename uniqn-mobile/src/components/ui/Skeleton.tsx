/**
 * UNIQN Mobile - Skeleton 컴포넌트
 *
 * @description 로딩 스켈레톤 플레이스홀더
 * @version 2.0.0 - Reanimated 마이그레이션
 */

import React, { useEffect } from 'react';
import { View, type ViewStyle, type DimensionValue } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';

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
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    // Shimmer 애니메이션: 0.3 → 0.7 → 0.3 반복
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 1000, easing: Easing.ease }),
        withTiming(0.3, { duration: 1000, easing: Easing.ease })
      ),
      -1, // 무한 반복
      false // reverse 없음
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      className={`bg-gray-200 dark:bg-surface ${className || ''}`}
      style={[
        {
          width,
          height,
          borderRadius,
        },
        animatedStyle,
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
    <View className={`bg-white dark:bg-surface rounded-xl p-4 ${className || ''}`}>
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
      <Skeleton width={48} height={48} borderRadius={24} style={{ marginRight: 12 }} />

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
    <View className="bg-white dark:bg-surface rounded-xl p-4 mb-3">
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
    <View className="bg-white dark:bg-surface rounded-xl p-4 mb-3">
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

// ============================================================================
// Notification Item Skeleton (Phase 2A 추가)
// ============================================================================

export function SkeletonNotificationItem() {
  return (
    <View className="flex-row items-start py-4 px-4 bg-white dark:bg-surface border-b border-gray-100 dark:border-surface-overlay">
      {/* Icon */}
      <Skeleton width={40} height={40} borderRadius={20} style={{ marginRight: 12 }} />

      {/* Content */}
      <View className="flex-1">
        <Skeleton width="80%" height={16} className="mb-2" />
        <Skeleton width="60%" height={14} className="mb-1" />
        <Skeleton width="30%" height={12} />
      </View>

      {/* Unread dot placeholder */}
      <Skeleton width={8} height={8} borderRadius={4} />
    </View>
  );
}

// ============================================================================
// Applicant Card Skeleton (Phase 2A 추가)
// ============================================================================

export function SkeletonApplicantCard() {
  return (
    <View className="bg-white dark:bg-surface rounded-xl p-4 mb-3">
      {/* Header */}
      <View className="flex-row items-center mb-4">
        <Skeleton width={56} height={56} borderRadius={28} />
        <View className="flex-1 ml-3">
          <Skeleton width="50%" height={18} className="mb-2" />
          <Skeleton width="30%" height={14} />
        </View>
        <Skeleton width={60} height={28} borderRadius={14} />
      </View>

      {/* Schedule selection */}
      <View className="mb-4">
        <Skeleton width="40%" height={14} className="mb-2" />
        <View className="flex-row gap-2">
          <Skeleton width={80} height={32} borderRadius={16} />
          <Skeleton width={80} height={32} borderRadius={16} />
          <Skeleton width={80} height={32} borderRadius={16} />
        </View>
      </View>

      {/* Action buttons */}
      <View className="flex-row gap-3">
        <Skeleton width="48%" height={44} borderRadius={8} />
        <Skeleton width="48%" height={44} borderRadius={8} />
      </View>
    </View>
  );
}

// ============================================================================
// Profile Header Skeleton (Phase 2A 추가)
// ============================================================================

export function SkeletonProfileHeader() {
  return (
    <View className="items-center py-6">
      {/* Avatar */}
      <Skeleton width={80} height={80} borderRadius={40} className="mb-4" />

      {/* Name */}
      <Skeleton width={120} height={24} className="mb-2" />

      {/* Email */}
      <Skeleton width={180} height={16} className="mb-3" />

      {/* Role badge */}
      <Skeleton width={80} height={28} borderRadius={14} />
    </View>
  );
}

// ============================================================================
// Stats Card Skeleton (Phase 2A 추가)
// ============================================================================

export function SkeletonStatsCard() {
  return (
    <View className="bg-white dark:bg-surface rounded-xl p-4">
      {/* Title */}
      <Skeleton width="40%" height={16} className="mb-4" />

      {/* Stats grid */}
      <View className="flex-row flex-wrap">
        {[1, 2, 3, 4].map((i) => (
          <View key={i} className="w-1/2 p-2">
            <Skeleton width="60%" height={28} className="mb-1" />
            <Skeleton width="80%" height={14} />
          </View>
        ))}
      </View>
    </View>
  );
}

// ============================================================================
// Settlement Row Skeleton (Phase 2A 추가)
// ============================================================================

export function SkeletonSettlementRow() {
  return (
    <View className="flex-row items-center py-3 px-4 bg-white dark:bg-surface border-b border-gray-100 dark:border-surface-overlay">
      {/* Date */}
      <View className="w-20">
        <Skeleton width={60} height={14} className="mb-1" />
        <Skeleton width={40} height={12} />
      </View>

      {/* Info */}
      <View className="flex-1 mx-3">
        <Skeleton width="70%" height={16} className="mb-1" />
        <Skeleton width="40%" height={14} />
      </View>

      {/* Amount */}
      <Skeleton width={80} height={20} />
    </View>
  );
}

export default Skeleton;

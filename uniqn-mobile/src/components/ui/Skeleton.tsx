/**
 * UNIQN Mobile - Skeleton 컴포넌트
 *
 * @description 로딩 스켈레톤 플레이스홀더
 * @version 3.0.0 - impeccable v2 §16 준수 (shimmer 1.2s / opacity 0.3↔0.5 /
 *                 reduce motion / progressbar a11y)
 *
 * 룰 근거: `.claude/rules/impeccable-design.md` §16 Skeleton > Spinner
 */

import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, View, type ViewStyle, type DimensionValue } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
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
  /**
   * 접근성 노드로 노출할지. 반복 Skeleton이 composer로 묶여 있다면
   * `false`를 전달해 VoiceOver 중복 announce 방지.
   * @default true
   */
  accessible?: boolean;
  /** @default "로딩 중" */
  accessibilityLabel?: string;
  testID?: string;
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
// Reduce Motion 감지 훅 (impeccable v2 §16)
// ============================================================================

/**
 * OS 의 Reduce Motion 설정을 구독한다.
 * 활성 시 shimmer 루프 대신 정적 fade(단일 opacity) 만 표시.
 */
function useReduceMotion(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let mounted = true;

    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setEnabled(value);
    });

    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (value: boolean) => {
      if (mounted) setEnabled(value);
    });

    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, []);

  return enabled;
}

// ============================================================================
// Shimmer 상수 (impeccable v2 §16 스펙)
// ============================================================================

const SHIMMER_HALF_DURATION = 600; // 0.3 → 0.5 = 600ms, 루프 총 1.2s
const OPACITY_MIN = 0.3;
const OPACITY_MAX = 0.5;
const REDUCED_OPACITY = 0.4; // reduce motion 시 정적

// ============================================================================
// Base Skeleton Component
// ============================================================================

export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = 4,
  style,
  className,
  accessible = true,
  accessibilityLabel = '로딩 중',
  testID,
}: SkeletonProps) {
  const reduceMotion = useReduceMotion();
  const opacity = useSharedValue(reduceMotion ? REDUCED_OPACITY : OPACITY_MIN);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(opacity);
      opacity.value = REDUCED_OPACITY;
      return;
    }

    opacity.value = OPACITY_MIN;
    opacity.value = withRepeat(
      withTiming(OPACITY_MAX, {
        duration: SHIMMER_HALF_DURATION,
        easing: Easing.inOut(Easing.ease),
      }),
      -1, // 무한 반복
      true // auto-reverse → 총 1.2s 루프 (0.3→0.5→0.3)
    );

    return () => {
      cancelAnimation(opacity);
    };
  }, [reduceMotion, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      testID={testID}
      accessible={accessible}
      accessibilityRole={accessible ? 'progressbar' : undefined}
      accessibilityLabel={accessible ? accessibilityLabel : undefined}
      className={`bg-secondary-200 dark:bg-surface ${className || ''}`}
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
    <View className={`bg-surface-card rounded-md p-4 ${className || ''}`}>
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
// Board Post Item Skeleton (게시판 특화)
// ============================================================================
//
// `BoardPostCard` 구조 정합용 — BoardPostCard는 아바타가 없고 좌측 스트라이프 +
// (배지 + 제목) 행 + 메타 행으로 구성된다. 원형 아바타가 있는 `SkeletonListItem`
// 대신 이 composer를 게시판 로딩 placeholder로 사용해 layout shift를 줄인다.
// 내부 Skeleton은 accessible=false — 호출부의 progressbar 컨테이너가 announce 담당.

export function SkeletonBoardPostItem() {
  return (
    <View className="border-b border-divider dark:border-surface-overlay">
      <View className="pl-3 pr-1 py-2.5">
        {/* Row 1: 배지 + 제목 */}
        <View className="flex-row items-center gap-2 mb-2">
          <Skeleton width={40} height={18} borderRadius={4} accessible={false} />
          <View className="flex-1">
            <Skeleton width="72%" height={16} borderRadius={4} accessible={false} />
          </View>
        </View>
        {/* Row 2: 메타 (작성자·날짜·카운트) */}
        <View className="flex-row items-center gap-x-2.5">
          <Skeleton width={44} height={12} borderRadius={4} accessible={false} />
          <Skeleton width={32} height={12} borderRadius={4} accessible={false} />
          <Skeleton width={28} height={12} borderRadius={4} accessible={false} />
          <Skeleton width={28} height={12} borderRadius={4} accessible={false} />
        </View>
      </View>
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
// SkeletonCircle — impeccable v2 §16 프리미티브
// ============================================================================
//
// 타임라인 도트, 프로그레스 도트 등 진짜 원형 shape가 필요한 비-아바타 용도용.
// 아바타는 DESIGN.md("rounded-full 아바타 포함 금지") 이유로 `SkeletonAvatar`
// 또는 `Skeleton borderRadius=8` 을 사용할 것.

interface SkeletonCircleProps {
  size?: number;
  style?: ViewStyle;
  testID?: string;
  accessible?: boolean;
}

export function SkeletonCircle({ size = 40, style, testID, accessible }: SkeletonCircleProps) {
  return (
    <Skeleton
      width={size}
      height={size}
      borderRadius={size / 2}
      style={style}
      testID={testID}
      {...(accessible !== undefined ? { accessible } : {})}
    />
  );
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
    <View className="bg-surface-card rounded-md p-4 mb-3">
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
    <View className="bg-surface-card rounded-md p-4 mb-3">
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
    <View className="flex-row items-start py-4 px-4 bg-surface-card border-b border-secondary-100 dark:border-surface-overlay">
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
    <View className="bg-surface-card rounded-md p-4 mb-3">
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
    <View className="bg-surface-card rounded-md p-4">
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
    <View className="flex-row items-center py-3 px-4 bg-surface-card border-b border-secondary-100 dark:border-surface-overlay">
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

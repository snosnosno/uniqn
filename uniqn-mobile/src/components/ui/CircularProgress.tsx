/**
 * UNIQN Mobile - CircularProgress 컴포넌트
 *
 * @description 원형 프로그레스 바 (남은 시간 시각화)
 * @version 1.0.0
 */

import React, { useMemo, useEffect, useRef } from 'react';
import { View, Text, Animated, Easing } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

// ============================================================================
// Types
// ============================================================================

export interface CircularProgressProps {
  /** 남은 시간 (초) */
  remainingSeconds: number;
  /** 전체 시간 (초, 기본값: 180) */
  totalSeconds?: number;
  /** 크기 (기본값: 80) */
  size?: number;
  /** 선 두께 (기본값: 6) */
  strokeWidth?: number;
  /** 만료 여부 */
  isExpired?: boolean;
  /** 중앙 텍스트 표시 여부 */
  showText?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const WARNING_THRESHOLD = 30; // 30초 이하
const DANGER_THRESHOLD = 10; // 10초 이하

// 색상 정의
const COLORS = {
  normal: {
    stroke: '#A855F7', // primary-500
    background: '#DBEAFE', // primary-100
  },
  warning: {
    stroke: '#F59E0B', // amber-500
    background: '#FEF3C7', // amber-100
  },
  danger: {
    stroke: '#EF4444', // red-500
    background: '#FEE2E2', // red-100
  },
  expired: {
    stroke: '#9CA3AF', // gray-400
    background: '#F3F4F6', // gray-100
  },
};

// ============================================================================
// Component
// ============================================================================

export function CircularProgress({
  remainingSeconds,
  totalSeconds = 180,
  size = 80,
  strokeWidth = 6,
  isExpired = false,
  showText = true,
}: CircularProgressProps) {
  // 애니메이션 ref
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // 진행률 계산 (0 ~ 1)
  const progress = useMemo(() => {
    if (isExpired || remainingSeconds <= 0) return 0;
    return Math.min(remainingSeconds / totalSeconds, 1);
  }, [remainingSeconds, totalSeconds, isExpired]);

  // 색상 결정
  const colors = useMemo(() => {
    if (isExpired || remainingSeconds <= 0) return COLORS.expired;
    if (remainingSeconds <= DANGER_THRESHOLD) return COLORS.danger;
    if (remainingSeconds <= WARNING_THRESHOLD) return COLORS.warning;
    return COLORS.normal;
  }, [remainingSeconds, isExpired]);

  // 시간 포맷팅
  const timeText = useMemo(() => {
    if (isExpired || remainingSeconds <= 0) return '만료';
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    if (minutes > 0) {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${seconds}초`;
  }, [remainingSeconds, isExpired]);

  // SVG 계산
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - progress);

  // 위험 구간 펄스 애니메이션
  useEffect(() => {
    if (remainingSeconds <= DANGER_THRESHOLD && remainingSeconds > 0 && !isExpired) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    } else {
      pulseAnim.setValue(1);
      return undefined;
    }
  }, [remainingSeconds, isExpired, pulseAnim]);

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        transform: [{ scale: pulseAnim }],
      }}
    >
      <View className="items-center justify-center" style={{ width: size, height: size }}>
        {/* SVG 프로그레스 */}
        <Svg width={size} height={size} style={{ position: 'absolute' }}>
          {/* 배경 원 */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.background}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* 프로그레스 원 */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.stroke}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>

        {/* 중앙 텍스트 */}
        {showText && (
          <Text
            className="font-bold"
            style={{
              fontSize: size * 0.2,
              color: colors.stroke,
            }}
          >
            {timeText}
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

export default CircularProgress;

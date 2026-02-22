/**
 * UNIQN Mobile - 버블 점수 표시 컴포넌트
 *
 * @description 원형 게이지 + 숫자 + 등급 라벨
 */

import React, { useMemo } from 'react';
import { View, Text, useColorScheme } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { BUBBLE_SCORE, getBubbleScoreColor } from '@/types/review';

interface BubbleScoreDisplayProps {
  score: number;
  totalReviewCount?: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
}

export default function BubbleScoreDisplay({
  score,
  totalReviewCount,
  size = 100,
  strokeWidth = 8,
  showLabel = true,
}: BubbleScoreDisplayProps) {
  const colorScheme = useColorScheme();
  const colorRange = useMemo(() => getBubbleScoreColor(score), [score]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(score / BUBBLE_SCORE.MAX, 1);
  const strokeDashoffset = circumference * (1 - progress);

  const strokeColor = colorRange.hex;

  return (
    <View className="items-center">
      {/* 원형 게이지 */}
      <View style={{ width: size, height: size }} className="items-center justify-center">
        <Svg width={size} height={size}>
          {/* 배경 원 */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colorScheme === 'dark' ? '#374151' : '#E5E7EB'}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* 진행 원 */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        {/* 중앙 텍스트 */}
        <View className="absolute items-center">
          <Text className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {score.toFixed(1)}
          </Text>
        </View>
      </View>

      {/* 등급 라벨 */}
      {showLabel && (
        <View className="mt-2 items-center">
          <View className={`rounded-full px-3 py-1 ${colorRange.bg} ${colorRange.darkBg}`}>
            <Text className={`text-xs font-medium ${colorRange.text}`}>
              {colorRange.label}
            </Text>
          </View>
          {totalReviewCount !== undefined && (
            <Text className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              {totalReviewCount}건의 평가
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

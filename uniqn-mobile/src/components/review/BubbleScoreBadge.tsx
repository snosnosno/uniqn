/**
 * UNIQN Mobile - 버블 점수 소형 배지 컴포넌트
 *
 * @description 카드/프로필에서 사용하는 작은 배지
 */

import React, { useMemo } from 'react';
import { View } from 'react-native';
import { getBubbleScoreColor } from '@/types/review';
import { NumericText } from '@/components/ui';

interface BubbleScoreBadgeProps {
  score: number;
  size?: 'sm' | 'md';
}

export default React.memo(function BubbleScoreBadge({ score, size = 'sm' }: BubbleScoreBadgeProps) {
  const colorRange = useMemo(() => getBubbleScoreColor(score), [score]);

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1';
  const textClasses = size === 'sm' ? 'text-xs' : 'text-sm font-sans';

  return (
    <View
      className={`flex-row items-center gap-1 rounded-sm ${sizeClasses} ${colorRange.bg} ${colorRange.darkBg}`}
    >
      <NumericText className={`font-sans-bold ${textClasses} ${colorRange.text}`}>
        {score.toFixed(1)}
      </NumericText>
    </View>
  );
});

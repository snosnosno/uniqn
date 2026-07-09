/**
 * CardStripe — 카드 좌측 3px 엣지 스트라이프 wrapper
 *
 * 룰 근거: DESIGN.md B 카드 언어 · impeccable-design.md §14 (border-l-4 대체)
 * tone이 "상태"를 암시한다. 골드=일반/대기, 블루=지원완료/확정, 그레이=마감/캐시/완료,
 * 워닝=취소 요청, 에러=신고.
 */

import React from 'react';
import { View, type ViewProps } from 'react-native';

export type CardStripeTone = 'gold' | 'info' | 'muted' | 'warning' | 'error';

const TONE_BAR: Record<CardStripeTone, string> = {
  gold: 'bg-primary-500 dark:bg-primary-400',
  info: 'bg-info-500 dark:bg-info-500',
  muted: 'bg-secondary-400 dark:bg-secondary-600',
  warning: 'bg-warning-500 dark:bg-warning-500',
  error: 'bg-error-500 dark:bg-error-500',
};

export interface CardStripeProps extends ViewProps {
  tone: CardStripeTone;
  /** bar 두께 (기본 3px) */
  thickness?: number;
  children: React.ReactNode;
  testID?: string;
}

export function CardStripe({
  tone,
  thickness = 3,
  children,
  testID,
  style,
  ...rest
}: CardStripeProps) {
  return (
    <View style={[{ position: 'relative' }, style]} testID={testID} {...rest}>
      <View
        className={`${TONE_BAR[tone]} rounded-sm`}
        style={{
          position: 'absolute',
          left: 0,
          top: 12,
          bottom: 12,
          width: thickness,
        }}
        testID={testID ? `${testID}-bar` : undefined}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      {children}
    </View>
  );
}

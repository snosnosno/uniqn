/**
 * UNIQN Mobile - Badge 컴포넌트
 *
 * @description 상태나 카테고리를 표시하는 배지
 * @version 1.1.0 - preset/variant 우선순위 문서화
 */

import React from 'react';
import { View, Text } from 'react-native';

export type BadgeVariant = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error';
export type BadgeSize = 'sm' | 'md';

/**
 * 자주 사용되는 Badge 프리셋
 * variant + children + size 조합을 사전 정의
 */
export type BadgePreset =
  | 'urgent'          // 긴급 (error)
  | 'important'       // 중요 (primary)
  | 'pinned'          // 고정 (error)
  | 'pending'         // 대기 중 (warning)
  | 'confirmed'       // 확정 (success)
  | 'completed'       // 완료 (success)
  | 'cancelled'       // 취소됨 (default)
  | 'closed'          // 마감 (default)
  | 'new'             // 신규 (primary)
  | 'tournament';     // 토너먼트 (primary)

/** 프리셋 설정 */
const BADGE_PRESETS: Record<BadgePreset, { variant: BadgeVariant; label: string }> = {
  urgent: { variant: 'error', label: '긴급' },
  important: { variant: 'primary', label: '중요' },
  pinned: { variant: 'error', label: '고정' },
  pending: { variant: 'warning', label: '대기 중' },
  confirmed: { variant: 'success', label: '확정' },
  completed: { variant: 'success', label: '완료' },
  cancelled: { variant: 'default', label: '취소됨' },
  closed: { variant: 'default', label: '마감' },
  new: { variant: 'primary', label: '신규' },
  tournament: { variant: 'primary', label: '토너먼트' },
};

/**
 * Badge 컴포넌트 Props
 *
 * @description
 * preset과 개별 props(variant, children)를 함께 사용할 경우 우선순위:
 * - variant: `variant` prop > `preset.variant` > 'default'
 * - children: `children` prop > `preset.label`
 *
 * @example
 * // 프리셋만 사용 (권장)
 * <Badge preset="confirmed" />  // variant="success", children="확정"
 *
 * // 프리셋 + variant 오버라이드 (variant만 변경, 텍스트는 프리셋 사용)
 * <Badge preset="confirmed" variant="primary" />  // variant="primary", children="확정"
 *
 * // 프리셋 + children 오버라이드 (스타일은 프리셋, 텍스트만 변경)
 * <Badge preset="confirmed">승인됨</Badge>  // variant="success", children="승인됨"
 *
 * // 직접 지정 (프리셋 없이)
 * <Badge variant="error">긴급</Badge>
 */
export interface BadgeProps {
  /** 배지 텍스트 (preset 사용 시 생략 가능, 지정 시 preset.label보다 우선) */
  children?: React.ReactNode;
  /** 배지 스타일 변형 (지정 시 preset.variant보다 우선) */
  variant?: BadgeVariant;
  /** 배지 크기 */
  size?: BadgeSize;
  /** 프리셋 (variant + children 기본값 자동 설정, 개별 props로 오버라이드 가능) */
  preset?: BadgePreset;
  /** dot 표시 여부 */
  dot?: boolean;
  /** 추가 클래스 */
  className?: string;
  /** 접근성 라벨 (미지정시 children 문자열 사용) */
  accessibilityLabel?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 dark:bg-surface',
  primary: 'bg-primary-100 dark:bg-primary-900/30',
  secondary: 'bg-gray-200 dark:bg-surface-elevated',
  success: 'bg-success-100 dark:bg-success-700/30',
  warning: 'bg-warning-100 dark:bg-warning-700/30',
  error: 'bg-error-100 dark:bg-error-700/30',
};

const textStyles: Record<BadgeVariant, string> = {
  default: 'text-gray-700 dark:text-gray-300',
  primary: 'text-primary-700 dark:text-primary-300',
  secondary: 'text-gray-600 dark:text-gray-200',
  success: 'text-success-700 dark:text-success-500',
  warning: 'text-warning-700 dark:text-warning-500',
  error: 'text-error-700 dark:text-error-500',
};

const dotStyles: Record<BadgeVariant, string> = {
  default: 'bg-gray-500',
  primary: 'bg-primary-500',
  secondary: 'bg-gray-400',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  error: 'bg-error-500',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-1',
  md: 'px-3 py-1',
};

const textSizeStyles: Record<BadgeSize, string> = {
  sm: 'text-xs',
  md: 'text-sm',
};

export function Badge({
  children,
  variant: variantProp,
  size = 'md',
  preset,
  dot = false,
  className = '',
  accessibilityLabel,
}: BadgeProps) {
  // 프리셋 설정 로드
  const presetConfig = preset ? BADGE_PRESETS[preset] : null;

  // 우선순위: variantProp > preset.variant > 'default'
  const variant = variantProp ?? presetConfig?.variant ?? 'default';

  // 우선순위: children > preset.label
  const displayContent = children ?? presetConfig?.label;

  const containerClass = `flex-row items-center rounded-full ${variantStyles[variant]} ${sizeStyles[size]} ${className}`.trim();
  const dotClass = `mr-2 h-2 w-2 rounded-full ${dotStyles[variant]}`;
  const textClass = `font-medium ${textStyles[variant]} ${textSizeStyles[size]}`;

  // children 또는 preset label이 문자열인 경우 자동으로 accessibilityLabel 생성
  const resolvedAccessibilityLabel =
    accessibilityLabel ??
    (typeof displayContent === 'string' ? `${displayContent} 배지` : undefined);

  return (
    <View
      className={containerClass}
      accessible={true}
      accessibilityRole="text"
      accessibilityLabel={resolvedAccessibilityLabel}
    >
      {dot && <View className={dotClass} />}
      <Text className={textClass}>{displayContent}</Text>
    </View>
  );
}

export default Badge;

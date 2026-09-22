/**
 * UNIQN Mobile - Accordion 컴포넌트
 *
 * @description 확장/축소 가능한 아코디언
 * @version 1.0.0
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { ChevronDownIcon } from '@/components/icons';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { MOTION_EASING, MOTION_DURATION } from '@/constants/motion';

// ============================================================================
// AccordionItem
// ============================================================================

export interface AccordionItemProps {
  /** 제목 */
  title: string;
  /** 부제목 (선택) */
  subtitle?: string;
  /** 내용 */
  children: React.ReactNode;
  /** 기본 확장 상태 */
  defaultExpanded?: boolean;
  /** 확장 상태 (controlled) */
  expanded?: boolean;
  /** 확장 상태 변경 콜백 */
  onToggle?: (expanded: boolean) => void;
  /** 왼쪽 아이콘 */
  icon?: React.ReactNode;
  /** 비활성화 */
  disabled?: boolean;
  /** 커스텀 클래스 */
  className?: string;
}

export function AccordionItem({
  title,
  subtitle,
  children,
  defaultExpanded = false,
  expanded: controlledExpanded,
  onToggle,
  icon,
  disabled = false,
  className = '',
}: AccordionItemProps) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);

  // controlled vs uncontrolled
  const isControlled = controlledExpanded !== undefined;
  const isExpanded = isControlled ? controlledExpanded : internalExpanded;

  const reduceMotion = useReduceMotion();

  // 셰브론 회전 — 이전에는 NativeWind `transition-transform` 클래스(웹 전용이라 네이티브에서
  // 무효)와 정적 인라인 transform 조합이라, 코드상 애니메이션처럼 보여도 실기기에서는
  // 180도로 즉시 스냅됐다. Reanimated 로 실제 트윈을 건다.
  const rotation = useSharedValue(isExpanded ? 180 : 0);

  useEffect(() => {
    const target = isExpanded ? 180 : 0;
    rotation.value = reduceMotion
      ? target
      : withTiming(target, { duration: MOTION_DURATION.fast, easing: MOTION_EASING.enter });
  }, [isExpanded, reduceMotion, rotation]);

  const chevronAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  // 높이 전이는 아래 Animated.View 의 layout 이 담당한다(구 LayoutAnimation 대체).
  const handleToggle = useCallback(() => {
    if (disabled) return;

    const newExpanded = !isExpanded;

    if (isControlled) {
      onToggle?.(newExpanded);
    } else {
      setInternalExpanded(newExpanded);
      onToggle?.(newExpanded);
    }
  }, [disabled, isExpanded, isControlled, onToggle]);

  return (
    <Animated.View
      layout={reduceMotion ? undefined : LinearTransition.duration(MOTION_DURATION.base)}
      className={`overflow-hidden ${className}`}
      accessibilityRole="button"
      accessibilityState={{ expanded: isExpanded, disabled }}
    >
      {/* Header */}
      <Pressable
        onPress={handleToggle}
        disabled={disabled}
        className={`flex-row items-center justify-between py-3 ${disabled ? 'opacity-50' : 'active:opacity-70'}`}
        accessibilityLabel={`${title}${subtitle ? `, ${subtitle}` : ''}`}
        accessibilityHint={isExpanded ? '축소하려면 탭하세요' : '확장하려면 탭하세요'}
      >
        <View className="flex-1 flex-row items-center">
          {icon && <View className="mr-3">{icon}</View>}
          <View className="flex-1">
            <Text
              className="text-base font-sans-medium text-content-primary dark:text-secondary-100"
              numberOfLines={2}
            >
              {title}
            </Text>
            {subtitle && (
              <Text
                className="mt-0.5 text-sm text-secondary-500 dark:text-secondary-400 font-sans"
                numberOfLines={1}
              >
                {subtitle}
              </Text>
            )}
          </View>
        </View>
        <Animated.View className="ml-2" style={chevronAnimatedStyle}>
          <ChevronDownIcon size={20} color={SECONDARY_PALETTE[400]} />
        </Animated.View>
      </Pressable>

      {/* Content */}
      {isExpanded && (
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn.duration(MOTION_DURATION.base)}
          exiting={reduceMotion ? undefined : FadeOut.duration(MOTION_DURATION.fast)}
          className="pb-3"
        >
          {children}
        </Animated.View>
      )}
    </Animated.View>
  );
}

// ============================================================================
// AccordionGroup
// ============================================================================

export interface AccordionGroupProps {
  /** 아코디언 아이템들 */
  children: React.ReactNode;
  /** 여러 개 동시 열림 허용 */
  allowMultiple?: boolean;
  /** 구분선 표시 */
  showDivider?: boolean;
  /** 커스텀 클래스 */
  className?: string;
}

export function AccordionGroup({
  children,
  allowMultiple = false,
  showDivider = true,
  className = '',
}: AccordionGroupProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set());

  const childrenArray = React.Children.toArray(children);

  const handleToggle = useCallback(
    (index: number, expanded: boolean) => {
      if (allowMultiple) {
        setExpandedIndices((prev) => {
          const newSet = new Set(prev);
          if (expanded) {
            newSet.add(index);
          } else {
            newSet.delete(index);
          }
          return newSet;
        });
      } else {
        setExpandedIndex(expanded ? index : null);
      }
    },
    [allowMultiple]
  );

  return (
    <View className={className}>
      {childrenArray.map((child, index) => {
        if (!React.isValidElement(child)) return null;

        const isExpanded = allowMultiple ? expandedIndices.has(index) : expandedIndex === index;

        const isLast = index === childrenArray.length - 1;

        return (
          <View key={index}>
            {React.cloneElement(child as React.ReactElement<AccordionItemProps>, {
              expanded: isExpanded,
              onToggle: (expanded: boolean) => handleToggle(index, expanded),
            })}
            {showDivider && !isLast && <View className="h-px bg-secondary-200 dark:bg-surface" />}
          </View>
        );
      })}
    </View>
  );
}

// ============================================================================
// Export
// ============================================================================

export const Accordion = {
  Item: AccordionItem,
  Group: AccordionGroup,
};

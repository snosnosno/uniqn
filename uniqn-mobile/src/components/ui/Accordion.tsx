/**
 * UNIQN Mobile - Accordion 컴포넌트
 *
 * @description 확장/축소 가능한 아코디언
 * @version 1.0.0
 */

import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, LayoutAnimation } from 'react-native';
import { ChevronDownIcon } from '@/components/icons';

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

  const handleToggle = useCallback(() => {
    if (disabled) return;

    // 애니메이션 설정
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    const newExpanded = !isExpanded;

    if (isControlled) {
      onToggle?.(newExpanded);
    } else {
      setInternalExpanded(newExpanded);
      onToggle?.(newExpanded);
    }
  }, [disabled, isExpanded, isControlled, onToggle]);

  return (
    <View
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
              className="text-base font-medium text-gray-900 dark:text-gray-100"
              numberOfLines={2}
            >
              {title}
            </Text>
            {subtitle && (
              <Text className="mt-0.5 text-sm text-gray-500 dark:text-gray-400" numberOfLines={1}>
                {subtitle}
              </Text>
            )}
          </View>
        </View>
        <View
          className={`ml-2 transition-transform ${isExpanded ? 'rotate-180' : 'rotate-0'}`}
          style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}
        >
          <ChevronDownIcon size={20} color="#9CA3AF" />
        </View>
      </Pressable>

      {/* Content */}
      {isExpanded && (
        <View className="pb-3">
          {children}
        </View>
      )}
    </View>
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

        const isExpanded = allowMultiple
          ? expandedIndices.has(index)
          : expandedIndex === index;

        const isLast = index === childrenArray.length - 1;

        return (
          <View key={index}>
            {React.cloneElement(child as React.ReactElement<AccordionItemProps>, {
              expanded: isExpanded,
              onToggle: (expanded: boolean) => handleToggle(index, expanded),
            })}
            {showDivider && !isLast && (
              <View className="h-px bg-gray-200 dark:bg-gray-700" />
            )}
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

export default Accordion;

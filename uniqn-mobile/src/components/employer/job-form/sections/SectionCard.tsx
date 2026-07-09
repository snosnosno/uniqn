/**
 * UNIQN Mobile - 공고 작성 폼 섹션 카드
 *
 * @description 각 폼 섹션을 감싸는 카드 컴포넌트
 * @version 1.0.0
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { memo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { ChevronDownIcon, ChevronUpIcon } from '@/components/icons';

// ============================================================================
// Types
// ============================================================================

interface SectionCardProps {
  /** 섹션 제목 */
  title: string;
  displayTitle?: string;
  /** 필수 여부 표시 */
  required?: boolean;
  /** 선택 사항 표시 */
  optional?: boolean;
  /** 섹션 내용 */
  children: React.ReactNode;
  /** 추가 스타일 */
  className?: string;
  /** 에러 상태 */
  hasError?: boolean;
  /** 에러 개수 */
  errorCount?: number;
  /** 접기/펼치기 가능 여부 */
  collapsible?: boolean;
  /** 접힌 상태 (collapsible이 true일 때) */
  collapsed?: boolean;
  /** 접기/펼치기 토글 핸들러 */
  onToggle?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export const SectionCard = memo(function SectionCard({
  title,
  displayTitle,
  required = false,
  optional = false,
  children,
  className = '',
  hasError = false,
  errorCount = 0,
  collapsible = false,
  collapsed = false,
  onToggle,
}: SectionCardProps) {
  const resolvedTitle = displayTitle ?? title;
  const borderColor = hasError
    ? 'border-error-300 dark:border-error-700'
    : 'border-secondary-200 dark:border-surface-overlay';

  const HeaderContent = (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center flex-1">
        <Text className="text-base font-sans-semibold text-content-primary dark:text-off-white">
          {resolvedTitle}
        </Text>
        {required && <Text className="ml-1 text-error-500 font-sans">*</Text>}
        {optional && (
          <Text className="ml-2 text-xs text-content-placeholder font-sans">(선택)</Text>
        )}
      </View>

      {/* 에러 배지 */}
      {hasError && errorCount > 0 && (
        <View className="px-2 py-0.5 bg-error-50 dark:bg-error-900/30 rounded-sm mr-2">
          <Text className="text-xs text-error-600 dark:text-error-400 font-sans">
            {errorCount}개 오류
          </Text>
        </View>
      )}

      {/* 접기/펼치기 아이콘 */}
      {collapsible && (
        <View className="p-1">
          {collapsed ? (
            <ChevronDownIcon size={20} color={SECONDARY_PALETTE[400]} />
          ) : (
            <ChevronUpIcon size={20} color={SECONDARY_PALETTE[400]} />
          )}
        </View>
      )}
    </View>
  );

  const isContentVisible = !collapsible || !collapsed;
  const headerBorder = isContentVisible
    ? 'border-b border-secondary-100 dark:border-surface-overlay'
    : '';

  return (
    <View
      className={`
        bg-surface-card
        rounded-md border ${borderColor}
        mb-3 overflow-hidden
        ${className}
      `}
    >
      {/* 헤더 */}
      {collapsible ? (
        <Pressable
          onPress={onToggle}
          className={`px-3 py-2 bg-surface-page dark:bg-surface/50 ${headerBorder}`}
          accessibilityRole="button"
          accessibilityLabel={`${resolvedTitle} 섹션`}
          accessibilityState={{ expanded: !collapsed }}
        >
          {HeaderContent}
        </Pressable>
      ) : (
        <View className={`px-3 py-2 bg-surface-page dark:bg-surface/50 ${headerBorder}`}>
          {HeaderContent}
        </View>
      )}

      {/* 내용 */}
      {isContentVisible && <View className="p-3">{children}</View>}
    </View>
  );
});

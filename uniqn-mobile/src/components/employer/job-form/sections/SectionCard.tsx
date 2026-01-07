/**
 * UNIQN Mobile - 공고 작성 폼 섹션 카드
 *
 * @description 각 폼 섹션을 감싸는 카드 컴포넌트
 * @version 1.0.0
 */

import React, { memo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { ChevronDownIcon, ChevronUpIcon } from '@/components/icons';

// ============================================================================
// Types
// ============================================================================

interface SectionCardProps {
  /** 섹션 제목 */
  title: string;
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
  const borderColor = hasError
    ? 'border-red-300 dark:border-red-700'
    : 'border-gray-200 dark:border-gray-700';

  const HeaderContent = (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center flex-1">
        <Text className="text-base font-semibold text-gray-900 dark:text-white">
          {title}
        </Text>
        {required && (
          <Text className="ml-1 text-red-500">*</Text>
        )}
        {optional && (
          <Text className="ml-2 text-xs text-gray-400 dark:text-gray-500">
            (선택)
          </Text>
        )}
      </View>

      {/* 에러 배지 */}
      {hasError && errorCount > 0 && (
        <View className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 rounded-full mr-2">
          <Text className="text-xs text-red-600 dark:text-red-400">
            {errorCount}개 오류
          </Text>
        </View>
      )}

      {/* 접기/펼치기 아이콘 */}
      {collapsible && (
        <View className="p-1">
          {collapsed ? (
            <ChevronDownIcon size={20} color="#9CA3AF" />
          ) : (
            <ChevronUpIcon size={20} color="#9CA3AF" />
          )}
        </View>
      )}
    </View>
  );

  return (
    <View
      className={`
        bg-white dark:bg-gray-800
        rounded-xl border ${borderColor}
        mb-4 overflow-hidden
        ${className}
      `}
    >
      {/* 헤더 */}
      {collapsible ? (
        <Pressable
          onPress={onToggle}
          className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700"
          accessibilityRole="button"
          accessibilityLabel={`${title} 섹션 ${collapsed ? '펼치기' : '접기'}`}
        >
          {HeaderContent}
        </Pressable>
      ) : (
        <View className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700">
          {HeaderContent}
        </View>
      )}

      {/* 내용 */}
      {(!collapsible || !collapsed) && (
        <View className="p-4">
          {children}
        </View>
      )}
    </View>
  );
});

export default SectionCard;

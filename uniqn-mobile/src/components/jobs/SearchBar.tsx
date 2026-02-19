/**
 * UNIQN Mobile - 검색바 컴포넌트
 *
 * @description 공고 검색용 텍스트 입력 (제목/장소 검색)
 * @version 1.0.0
 */

import React, { memo } from 'react';
import { View, TextInput, Pressable, Keyboard } from 'react-native';
import { SearchIcon, XCircleIcon } from '@/components/icons';
import { useThemeStore } from '@/stores/themeStore';

// ============================================================================
// Theme Constants (Input.tsx 패턴 준수)
// ============================================================================

const PLACEHOLDER_COLORS = {
  light: '#6B7280', // gray-500 (WCAG AA 준수)
  dark: '#9CA3AF', // gray-400 (다크모드에서 더 밝게)
} as const;

// ============================================================================
// Types
// ============================================================================

interface SearchBarProps {
  /** 현재 검색 텍스트 */
  value: string;
  /** 텍스트 변경 핸들러 */
  onChangeText: (text: string) => void;
  /** 플레이스홀더 (기본: '제목, 장소로 검색') */
  placeholder?: string;
}

// ============================================================================
// Component
// ============================================================================

export const SearchBar = memo(function SearchBar({
  value,
  onChangeText,
  placeholder = '제목, 장소로 검색',
}: SearchBarProps) {
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  const placeholderColor = isDarkMode ? PLACEHOLDER_COLORS.dark : PLACEHOLDER_COLORS.light;

  return (
    <View className="bg-white px-4 pb-2 dark:bg-surface" accessibilityRole="search">
      <View className="flex-row items-center rounded-lg bg-gray-100 px-3 dark:bg-surface-elevated">
        <SearchIcon size={20} color={placeholderColor} />

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={placeholderColor}
          maxLength={50}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          onSubmitEditing={() => Keyboard.dismiss()}
          className="ml-2 flex-1 py-2.5 text-base text-gray-900 dark:text-gray-100"
          accessibilityLabel="공고 검색"
          accessibilityHint="제목 또는 장소를 입력하여 공고를 검색합니다"
        />

        {value.length > 0 && (
          <Pressable
            onPress={() => onChangeText('')}
            hitSlop={12}
            className="p-1"
            accessibilityRole="button"
            accessibilityLabel="검색어 지우기"
          >
            <XCircleIcon size={20} color={placeholderColor} />
          </Pressable>
        )}
      </View>
    </View>
  );
});

export default SearchBar;

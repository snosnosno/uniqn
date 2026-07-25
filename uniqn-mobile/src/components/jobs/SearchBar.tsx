/**
 * UNIQN Mobile - 검색바 컴포넌트
 *
 * @description 공고 검색용 텍스트 입력 (제목/장소 검색)
 * @version 1.0.0
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { memo } from 'react';
import { View, TextInput, Pressable, Keyboard } from 'react-native';
import { SearchIcon, XCircleIcon } from '@/components/icons';
import { useThemeStore } from '@/stores/themeStore';

// ============================================================================
// Theme Constants (Input.tsx 패턴 준수)
// ============================================================================

const PLACEHOLDER_COLORS = {
  light: SECONDARY_PALETTE[500], // gray-500 (WCAG AA 준수)
  dark: SECONDARY_PALETTE[400], // gray-400 (다크모드에서 더 밝게)
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

  // 배경 미지정 — 페이지 배경(bg-surface-page/dark:bg-surface)을 그대로 이어받아
  // 아래 칩·필터 행과 한 덩어리로 보인다 (라이트모드 흰 띠 제거, 2026-07-25)
  return (
    <View className="px-4 pb-2" accessibilityRole="search">
      <View className="flex-row items-center rounded-lg bg-surface-card px-3 dark:bg-surface-elevated">
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
          className="ml-2 flex-1 py-2.5 text-base font-sans text-content-primary dark:text-secondary-100"
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

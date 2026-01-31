/**
 * UNIQN Mobile - MobileHeader 컴포넌트
 *
 * @description 모바일 화면 상단 헤더
 * @version 2.0.0
 *
 * 주요 기능:
 * - 스크롤 시 헤더 축소 애니메이션
 * - 검색 모드 전환 기능
 */

import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable, TextInput, type ViewProps } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolate,
  withTiming,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { ChevronLeftIcon, MagnifyingGlassIcon, XMarkIcon } from '@/components/icons';
import { getIconColor } from '@/constants';
import { useThemeStore } from '@/stores/themeStore';

// ============================================================================
// Types
// ============================================================================

interface MobileHeaderProps extends ViewProps {
  /** 헤더 제목 */
  title?: string;
  /** 뒤로가기 버튼 표시 여부 */
  showBack?: boolean;
  /** 커스텀 뒤로가기 핸들러 */
  onBack?: () => void;
  /** 왼쪽 액션 버튼 */
  leftAction?: React.ReactNode;
  /** 오른쪽 액션 버튼 */
  rightAction?: React.ReactNode;
  /** 서브타이틀 */
  subtitle?: string;
  /** 투명 배경 여부 */
  transparent?: boolean;
  /** 그림자 표시 여부 */
  shadow?: boolean;
  /** 테두리 표시 여부 */
  border?: boolean;
  /** 중앙 정렬 여부 */
  centerTitle?: boolean;
  /** 스크롤 위치 (축소 애니메이션용) */
  scrollY?: SharedValue<number>;
  /** 헤더 축소 활성화 */
  collapsible?: boolean;
  /** 검색 모드 활성화 */
  searchMode?: boolean;
  /** 검색어 변경 콜백 */
  onSearch?: (query: string) => void;
  /** 검색 플레이스홀더 */
  searchPlaceholder?: string;
  /** 검색 모드 토글 콜백 */
  onSearchModeChange?: (isSearchMode: boolean) => void;
  /** 검색 버튼 표시 */
  showSearchButton?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const HEADER_HEIGHT_EXPANDED = 56;
const HEADER_HEIGHT_COLLAPSED = 44;
const SCROLL_THRESHOLD = 100;

/** 검색 입력 플레이스홀더 색상 (다크모드 지원) */
const SEARCH_PLACEHOLDER_COLORS = {
  light: '#6B7280', // gray-500
  dark: '#9CA3AF',  // gray-400
} as const;

// ============================================================================
// Component
// ============================================================================

export function MobileHeader({
  title,
  showBack = false,
  onBack,
  leftAction,
  rightAction,
  subtitle,
  transparent = false,
  shadow = false,
  border = true,
  centerTitle = false,
  scrollY,
  collapsible = false,
  searchMode = false,
  onSearch,
  searchPlaceholder = '검색...',
  onSearchModeChange,
  showSearchButton = false,
  className,
  ...props
}: MobileHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useThemeStore();
  const [isSearchActive, setIsSearchActive] = useState(searchMode);
  const [searchQuery, setSearchQuery] = useState('');

  // 검색 모드 애니메이션
  const searchModeAnim = useSharedValue(searchMode ? 1 : 0);

  useEffect(() => {
    searchModeAnim.value = withTiming(isSearchActive ? 1 : 0, { duration: 200 });
  }, [isSearchActive, searchModeAnim]);

  // 외부 searchMode prop 변경 감지
  useEffect(() => {
    setIsSearchActive(searchMode);
  }, [searchMode]);

  // 뒤로가기 핸들러
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    }
  };

  // 검색 모드 토글
  const toggleSearchMode = useCallback(() => {
    const newMode = !isSearchActive;
    setIsSearchActive(newMode);
    onSearchModeChange?.(newMode);
    if (!newMode) {
      setSearchQuery('');
      onSearch?.('');
    }
  }, [isSearchActive, onSearchModeChange, onSearch]);

  // 검색어 변경
  const handleSearchChange = useCallback(
    (text: string) => {
      setSearchQuery(text);
      onSearch?.(text);
    },
    [onSearch]
  );

  // 검색 취소
  const handleSearchCancel = useCallback(() => {
    setIsSearchActive(false);
    setSearchQuery('');
    onSearch?.('');
    onSearchModeChange?.(false);
  }, [onSearch, onSearchModeChange]);

  // 배경 스타일
  const getBackgroundStyle = () => {
    if (transparent) return 'bg-transparent';
    return 'bg-white dark:bg-gray-900';
  };

  // 테두리/그림자 스타일
  const getBorderStyle = () => {
    const styles: string[] = [];
    if (border && !transparent) {
      styles.push('border-b border-gray-200 dark:border-gray-800');
    }
    if (shadow && !transparent) {
      styles.push('shadow-sm');
    }
    return styles.join(' ');
  };

  // 스크롤 축소 애니메이션 스타일
  const animatedHeaderStyle = useAnimatedStyle(() => {
    if (!scrollY || !collapsible) {
      return { height: HEADER_HEIGHT_EXPANDED };
    }

    const height = interpolate(
      scrollY.value,
      [0, SCROLL_THRESHOLD],
      [HEADER_HEIGHT_EXPANDED, HEADER_HEIGHT_COLLAPSED],
      Extrapolate.CLAMP
    );

    return { height };
  });

  // 타이틀 폰트 크기 애니메이션
  const animatedTitleStyle = useAnimatedStyle(() => {
    if (!scrollY || !collapsible) {
      return { fontSize: 18 };
    }

    const fontSize = interpolate(
      scrollY.value,
      [0, SCROLL_THRESHOLD],
      [18, 16],
      Extrapolate.CLAMP
    );

    return { fontSize };
  });

  // 서브타이틀 투명도 애니메이션
  const animatedSubtitleStyle = useAnimatedStyle(() => {
    if (!scrollY || !collapsible) {
      return { opacity: 1 };
    }

    const opacity = interpolate(
      scrollY.value,
      [0, SCROLL_THRESHOLD / 2],
      [1, 0],
      Extrapolate.CLAMP
    );

    return { opacity };
  });

  // 검색 모드 UI 애니메이션
  const searchContainerStyle = useAnimatedStyle(() => ({
    opacity: searchModeAnim.value,
    transform: [{ translateX: interpolate(searchModeAnim.value, [0, 1], [20, 0]) }],
  }));

  const normalHeaderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(searchModeAnim.value, [0, 1], [1, 0]),
    transform: [{ translateX: interpolate(searchModeAnim.value, [0, 1], [0, -20]) }],
  }));

  return (
    <View
      className={`${getBackgroundStyle()} ${getBorderStyle()} ${className || ''}`}
      style={{ paddingTop: insets.top }}
      {...props}
    >
      <Animated.View className="flex-row items-center px-4" style={animatedHeaderStyle}>
        {isSearchActive ? (
          // 검색 모드 UI
          <Animated.View className="flex-1 flex-row items-center" style={searchContainerStyle}>
            <View className="flex-1 flex-row items-center bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2">
              <MagnifyingGlassIcon
                size={20}
                color={isDarkMode ? SEARCH_PLACEHOLDER_COLORS.dark : SEARCH_PLACEHOLDER_COLORS.light}
              />
              <TextInput
                value={searchQuery}
                onChangeText={handleSearchChange}
                placeholder={searchPlaceholder}
                placeholderTextColor={isDarkMode ? SEARCH_PLACEHOLDER_COLORS.dark : SEARCH_PLACEHOLDER_COLORS.light}
                className="flex-1 ml-2 text-base text-gray-900 dark:text-white"
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                accessibilityLabel="검색"
              />
              {searchQuery.length > 0 && (
                <Pressable
                  onPress={() => handleSearchChange('')}
                  className="p-1"
                  accessibilityRole="button"
                  accessibilityLabel="검색어 지우기"
                >
                  <XMarkIcon
                    size={16}
                    color={isDarkMode ? SEARCH_PLACEHOLDER_COLORS.dark : SEARCH_PLACEHOLDER_COLORS.light}
                  />
                </Pressable>
              )}
            </View>
            <Pressable
              onPress={handleSearchCancel}
              className="ml-3 py-2"
              accessibilityRole="button"
              accessibilityLabel="검색 취소"
            >
              <Text className="text-primary-600 dark:text-primary-400 font-medium">취소</Text>
            </Pressable>
          </Animated.View>
        ) : (
          // 일반 헤더 UI
          <Animated.View className="flex-1 flex-row items-center" style={normalHeaderStyle}>
            {/* 왼쪽 영역 */}
            <View className="w-12 items-start">
              {showBack ? (
                <Pressable
                  onPress={handleBack}
                  className="p-2 -ml-2 rounded-full active:bg-gray-100 dark:active:bg-gray-800"
                  accessibilityRole="button"
                  accessibilityLabel="뒤로 가기"
                >
                  <ChevronLeftIcon size={24} color={getIconColor(isDarkMode, 'contrast')} />
                </Pressable>
              ) : (
                leftAction
              )}
            </View>

            {/* 중앙 영역 - 제목 */}
            <View className={`flex-1 ${centerTitle ? 'items-center' : 'items-start'}`}>
              {title && (
                <Animated.Text
                  className="font-semibold text-gray-900 dark:text-white"
                  numberOfLines={1}
                  style={animatedTitleStyle}
                >
                  {title}
                </Animated.Text>
              )}
              {subtitle && (
                <Animated.Text
                  className="text-sm text-gray-500 dark:text-gray-400"
                  numberOfLines={1}
                  style={animatedSubtitleStyle}
                >
                  {subtitle}
                </Animated.Text>
              )}
            </View>

            {/* 오른쪽 영역 */}
            <View className="min-w-12 items-end shrink-0 flex-row">
              {showSearchButton && onSearch && (
                <Pressable
                  onPress={toggleSearchMode}
                  className="p-2 rounded-full active:bg-gray-100 dark:active:bg-gray-800"
                  accessibilityRole="button"
                  accessibilityLabel="검색"
                >
                  <MagnifyingGlassIcon size={24} color={getIconColor(isDarkMode, 'contrast')} />
                </Pressable>
              )}
              {rightAction}
            </View>
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

// ============================================================================
// Header Action Button
// ============================================================================

interface HeaderActionProps {
  /** 아이콘 (텍스트 또는 이모지) */
  icon: string;
  /** 클릭 핸들러 */
  onPress: () => void;
  /** 접근성 라벨 */
  label: string;
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 뱃지 카운트 */
  badge?: number;
}

export function HeaderAction({
  icon,
  onPress,
  label,
  disabled = false,
  badge,
}: HeaderActionProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`
        p-2 rounded-full relative
        ${disabled ? 'opacity-50' : 'active:bg-gray-100 dark:active:bg-gray-800'}
      `}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text className="text-xl text-gray-700 dark:text-gray-300">{icon}</Text>

      {/* 뱃지 */}
      {badge !== undefined && badge > 0 && (
        <View className="absolute -top-0.5 -right-0.5 bg-red-500 rounded-full min-w-[18px] h-[18px] items-center justify-center px-1">
          <Text className="text-white text-xs font-bold">
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

// ============================================================================
// Large Header (큰 제목 스타일)
// ============================================================================

interface LargeHeaderProps extends ViewProps {
  /** 헤더 제목 */
  title: string;
  /** 서브타이틀 */
  subtitle?: string;
  /** 오른쪽 액션 */
  rightAction?: React.ReactNode;
}

export function LargeHeader({
  title,
  subtitle,
  rightAction,
  className,
  ...props
}: LargeHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      className={`bg-white dark:bg-gray-900 px-4 pb-4 ${className || ''}`}
      style={{ paddingTop: insets.top + 8 }}
      {...props}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="text-3xl font-bold text-gray-900 dark:text-white">
            {title}
          </Text>
          {subtitle && (
            <Text className="text-base text-gray-500 dark:text-gray-400 mt-1">
              {subtitle}
            </Text>
          )}
        </View>
        {rightAction && <View className="ml-4">{rightAction}</View>}
      </View>
    </View>
  );
}

// ============================================================================
// Exports
// ============================================================================

export default MobileHeader;

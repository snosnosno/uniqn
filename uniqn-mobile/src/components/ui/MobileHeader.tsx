import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet, type ViewProps } from 'react-native';
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
import { getIconColor, getLayoutColor, HEADER_CLASSES } from '@/constants';
import { HeaderBackButton } from '@/components/navigation';
import { useThemeStore } from '@/stores/themeStore';

interface MobileHeaderProps extends ViewProps {
  title?: string;
  titleSuffix?: React.ReactNode;
  showBack?: boolean;
  onBack?: () => void;
  fallbackHref?: string;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  subtitle?: string;
  transparent?: boolean;
  shadow?: boolean;
  border?: boolean;
  centerTitle?: boolean;
  scrollY?: SharedValue<number>;
  collapsible?: boolean;
  searchMode?: boolean;
  onSearch?: (query: string) => void;
  searchPlaceholder?: string;
  onSearchModeChange?: (isSearchMode: boolean) => void;
  showSearchButton?: boolean;
}

const HEADER_HEIGHT_EXPANDED = 56;
const HEADER_HEIGHT_COLLAPSED = 44;
const SCROLL_THRESHOLD = 100;

export function MobileHeader({
  title,
  titleSuffix,
  showBack = false,
  onBack,
  fallbackHref = '/(app)/(tabs)/home-jobs',
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
  style,
  ...props
}: MobileHeaderProps) {
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useThemeStore();
  const headerTintColor = getLayoutColor(isDarkMode, 'headerTint');
  const headerBackgroundColor = getLayoutColor(isDarkMode, 'header');
  const headerBorderColor = getLayoutColor(isDarkMode, 'headerBorder');
  const searchPlaceholderColor = getIconColor(isDarkMode, 'primary');
  const [isSearchActive, setIsSearchActive] = useState(searchMode);
  const [searchQuery, setSearchQuery] = useState('');

  const searchModeAnim = useSharedValue(searchMode ? 1 : 0);

  useEffect(() => {
    searchModeAnim.value = withTiming(isSearchActive ? 1 : 0, { duration: 200 });
  }, [isSearchActive, searchModeAnim]);

  useEffect(() => {
    setIsSearchActive(searchMode);
  }, [searchMode]);

  const handleBack = useCallback(() => {
    onBack?.();
  }, [onBack]);

  const toggleSearchMode = useCallback(() => {
    const nextMode = !isSearchActive;
    setIsSearchActive(nextMode);
    onSearchModeChange?.(nextMode);

    if (!nextMode) {
      setSearchQuery('');
      onSearch?.('');
    }
  }, [isSearchActive, onSearch, onSearchModeChange]);

  const handleSearchChange = useCallback(
    (text: string) => {
      setSearchQuery(text);
      onSearch?.(text);
    },
    [onSearch]
  );

  const handleSearchCancel = useCallback(() => {
    setIsSearchActive(false);
    setSearchQuery('');
    onSearch?.('');
    onSearchModeChange?.(false);
  }, [onSearch, onSearchModeChange]);

  const animatedHeaderStyle = useAnimatedStyle(() => {
    if (!scrollY || !collapsible) {
      return { height: HEADER_HEIGHT_EXPANDED };
    }

    return {
      height: interpolate(
        scrollY.value,
        [0, SCROLL_THRESHOLD],
        [HEADER_HEIGHT_EXPANDED, HEADER_HEIGHT_COLLAPSED],
        Extrapolate.CLAMP
      ),
    };
  });

  const animatedTitleStyle = useAnimatedStyle(() => {
    if (!scrollY || !collapsible) {
      return { fontSize: 18 };
    }

    return {
      fontSize: interpolate(scrollY.value, [0, SCROLL_THRESHOLD], [18, 16], Extrapolate.CLAMP),
    };
  });

  const animatedSubtitleStyle = useAnimatedStyle(() => {
    if (!scrollY || !collapsible) {
      return { opacity: 1 };
    }

    return {
      opacity: interpolate(scrollY.value, [0, SCROLL_THRESHOLD / 2], [1, 0], Extrapolate.CLAMP),
    };
  });

  const searchContainerStyle = useAnimatedStyle(() => ({
    opacity: searchModeAnim.value,
    transform: [{ translateX: interpolate(searchModeAnim.value, [0, 1], [20, 0]) }],
  }));

  const normalHeaderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(searchModeAnim.value, [0, 1], [1, 0]),
    transform: [{ translateX: interpolate(searchModeAnim.value, [0, 1], [0, -20]) }],
  }));

  const containerStyle = [
    {
      paddingTop: insets.top,
      backgroundColor: transparent ? 'transparent' : headerBackgroundColor,
      borderBottomWidth: border && !transparent ? StyleSheet.hairlineWidth : 0,
      borderBottomColor: border && !transparent ? headerBorderColor : 'transparent',
    },
    style,
  ];

  return (
    <View
      className={`${shadow && !transparent ? 'shadow-sm' : ''} ${className ?? ''}`}
      style={containerStyle}
      {...props}
    >
      <Animated.View className="flex-row items-center px-4" style={animatedHeaderStyle}>
        {isSearchActive ? (
          <Animated.View className="flex-1 flex-row items-center" style={searchContainerStyle}>
            <View
              className={`flex-1 flex-row items-center rounded-lg px-3 py-2 ${HEADER_CLASSES.searchField}`}
            >
              <MagnifyingGlassIcon size={20} color={searchPlaceholderColor} />
              <TextInput
                value={searchQuery}
                onChangeText={handleSearchChange}
                placeholder={searchPlaceholder}
                placeholderTextColor={searchPlaceholderColor}
                className={`ml-2 flex-1 text-base font-sans ${HEADER_CLASSES.title}`}
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                accessibilityLabel="검색"
              />
              {searchQuery.length > 0 ? (
                <Pressable
                  onPress={() => handleSearchChange('')}
                  className={`rounded-sm p-1 ${HEADER_CLASSES.actionPressed}`}
                  accessibilityRole="button"
                  accessibilityLabel="검색어 지우기"
                >
                  <XMarkIcon size={16} color={searchPlaceholderColor} />
                </Pressable>
              ) : null}
            </View>
            <Pressable
              onPress={handleSearchCancel}
              className="ml-3 py-2"
              accessibilityRole="button"
              accessibilityLabel="검색 취소"
            >
              <Text className="font-sans-medium text-primary-600 dark:text-primary-400">취소</Text>
            </Pressable>
          </Animated.View>
        ) : (
          <Animated.View className="flex-1 flex-row items-center" style={normalHeaderStyle}>
            <View className="w-12 items-start">
              {showBack ? (
                onBack ? (
                  <Pressable
                    onPress={handleBack}
                    className={`-ml-2 rounded-sm p-2 ${HEADER_CLASSES.actionPressed}`}
                    accessibilityRole="button"
                    accessibilityLabel="뒤로 가기"
                  >
                    <ChevronLeftIcon size={24} color={headerTintColor} />
                  </Pressable>
                ) : (
                  <HeaderBackButton tintColor={headerTintColor} fallbackHref={fallbackHref} />
                )
              ) : (
                leftAction
              )}
            </View>

            <View className={`flex-1 ${centerTitle ? 'items-center' : 'items-start'}`}>
              <View
                className={`max-w-full flex-row items-center ${centerTitle ? 'justify-center' : ''}`}
              >
                {title ? (
                  <Animated.Text
                    className={`font-display-semibold ${HEADER_CLASSES.title}`}
                    numberOfLines={1}
                    style={animatedTitleStyle}
                  >
                    {title}
                  </Animated.Text>
                ) : null}
                {titleSuffix ? <View className="ml-1 shrink">{titleSuffix}</View> : null}
              </View>
              {subtitle ? (
                <Animated.Text
                  className={`text-sm font-sans ${HEADER_CLASSES.subtitle}`}
                  numberOfLines={1}
                  style={animatedSubtitleStyle}
                >
                  {subtitle}
                </Animated.Text>
              ) : null}
            </View>

            <View className="min-w-12 shrink-0 flex-row items-center justify-end">
              {showSearchButton && onSearch ? (
                <Pressable
                  onPress={toggleSearchMode}
                  className={`rounded-sm p-2 ${HEADER_CLASSES.actionPressed}`}
                  accessibilityRole="button"
                  accessibilityLabel="검색"
                >
                  <MagnifyingGlassIcon size={24} color={headerTintColor} />
                </Pressable>
              ) : null}
              {rightAction}
            </View>
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

interface HeaderActionProps {
  icon: string;
  onPress: () => void;
  label: string;
  disabled?: boolean;
  badge?: number;
}

export function HeaderAction({ icon, onPress, label, disabled = false, badge }: HeaderActionProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`relative rounded-sm p-2 ${
        disabled ? 'opacity-50' : HEADER_CLASSES.actionPressed
      }`}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text className="text-xl text-content-secondary font-sans">{icon}</Text>
      {badge !== undefined && badge > 0 ? (
        <View className="absolute -right-0.5 -top-0.5 h-[18px] min-w-[18px] items-center justify-center rounded-sm bg-error-500 px-1">
          <Text className="text-xs font-sans-bold text-white">{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

interface LargeHeaderProps extends ViewProps {
  title: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
}

export function LargeHeader({
  title,
  subtitle,
  rightAction,
  className,
  style,
  ...props
}: LargeHeaderProps) {
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useThemeStore();

  return (
    <View
      className={`px-4 pb-4 ${className ?? ''}`}
      style={[
        {
          paddingTop: insets.top + 8,
          backgroundColor: getLayoutColor(isDarkMode, 'header'),
        },
        style,
      ]}
      {...props}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text className={`text-3xl font-display-bold ${HEADER_CLASSES.title}`}>{title}</Text>
          {subtitle ? (
            <Text className={`mt-1 text-base font-sans ${HEADER_CLASSES.subtitle}`}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {rightAction ? <View className="ml-4">{rightAction}</View> : null}
      </View>
    </View>
  );
}

export default MobileHeader;

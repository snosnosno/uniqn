/**
 * UNIQN Mobile - MobileHeader 컴포넌트
 *
 * @description 모바일 화면 상단 헤더
 * @version 1.0.0
 *
 * TODO [출시 전]: 스크롤 시 헤더 축소 애니메이션 추가
 * TODO [출시 전]: 검색 모드 전환 기능 추가
 */

import React from 'react';
import { View, Text, Pressable, type ViewProps } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
}

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
  className,
  ...props
}: MobileHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // 뒤로가기 핸들러
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (router.canGoBack()) {
      router.back();
    }
  };

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

  return (
    <View
      className={`${getBackgroundStyle()} ${getBorderStyle()} ${className || ''}`}
      style={{ paddingTop: insets.top }}
      {...props}
    >
      <View className="flex-row items-center h-14 px-4">
        {/* 왼쪽 영역 */}
        <View className="w-12 items-start">
          {showBack ? (
            <Pressable
              onPress={handleBack}
              className="p-2 -ml-2 rounded-full active:bg-gray-100 dark:active:bg-gray-800"
              accessibilityRole="button"
              accessibilityLabel="뒤로 가기"
            >
              <Text className="text-2xl text-gray-900 dark:text-white">←</Text>
            </Pressable>
          ) : (
            leftAction
          )}
        </View>

        {/* 중앙 영역 - 제목 */}
        <View className={`flex-1 ${centerTitle ? 'items-center' : 'items-start'}`}>
          {title && (
            <Text
              className="text-lg font-semibold text-gray-900 dark:text-white"
              numberOfLines={1}
            >
              {title}
            </Text>
          )}
          {subtitle && (
            <Text
              className="text-sm text-gray-500 dark:text-gray-400"
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          )}
        </View>

        {/* 오른쪽 영역 */}
        <View className="min-w-12 items-end shrink-0">{rightAction}</View>
      </View>
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

/**
 * UNIQN Mobile - Job Detail Header
 *
 * @description 공고 상세 페이지 공통 헤더 (public/authenticated 공용)
 * @version 1.0.0
 */

import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeftIcon, ShareIcon } from '@/components/icons';
import { useThemeStore } from '@/stores';

// ============================================================================
// Types
// ============================================================================

interface JobDetailHeaderProps {
  title?: string;
  onShare?: () => void;
  isSharing?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function JobDetailHeader({ title, onShare, isSharing }: JobDetailHeaderProps) {
  const { isDarkMode } = useThemeStore();

  return (
    <View className="flex-row items-center px-4 py-3 bg-white dark:bg-surface-dark border-b border-gray-200 dark:border-surface-overlay">
      <Pressable
        onPress={() => router.back()}
        className="p-2 -ml-2 mr-2"
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel="뒤로 가기"
        accessibilityRole="button"
      >
        <ChevronLeftIcon size={24} color={isDarkMode ? '#ffffff' : '#1A1625'} />
      </Pressable>
      <Text className="text-base font-semibold text-gray-900 dark:text-white">공고 상세</Text>
      {title && (
        <>
          <Text className="mx-2 text-gray-400 dark:text-gray-500">|</Text>
          <Text
            className="flex-1 text-base text-gray-600 dark:text-gray-400"
            numberOfLines={1}
            testID="job-detail-title"
          >
            {title}
          </Text>
        </>
      )}
      {onShare && (
        <Pressable
          onPress={onShare}
          disabled={isSharing}
          className="p-2 -mr-2 ml-2"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="공고 공유하기"
          accessibilityRole="button"
        >
          <ShareIcon size={22} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
        </Pressable>
      )}
    </View>
  );
}

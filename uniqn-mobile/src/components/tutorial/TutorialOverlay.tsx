/**
 * UNIQN Mobile - 튜토리얼 오버레이 (메인 캐러셀)
 *
 * @description 풀스크린 스와이프 튜토리얼. ScrollView + pagingEnabled 기반.
 * @version 1.0.0
 */

import { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown, useSharedValue } from 'react-native-reanimated';
import { TutorialPage } from '@/components/tutorial/TutorialPage';
import { TutorialIndicator } from '@/components/tutorial/TutorialIndicator';
import type { TutorialConfig } from '@/types/tutorial';

// ============================================================================
// Types
// ============================================================================

interface TutorialOverlayProps {
  /** 튜토리얼 설정 */
  readonly config: TutorialConfig;
  /** 완료/스킵 시 콜백 */
  readonly onComplete: () => void;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * accent 색상으로 아이콘 배경 NativeWind 클래스를 결정
 */
function getIconBgClass(accentColor: string): string {
  // 매핑: 브랜드 accent color → NativeWind 클래스
  const colorMap: Record<string, string> = {
    '#A855F7': 'bg-primary-100 dark:bg-primary-900/30',
    '#D4AF37': 'bg-accent-100 dark:bg-accent-700/30',
    '#22C55E': 'bg-success-100 dark:bg-success-700/30',
    '#7C3AED': 'bg-primary-200 dark:bg-primary-800/30',
  };
  return colorMap[accentColor] ?? 'bg-primary-100 dark:bg-primary-900/30';
}

/**
 * accent 색상으로 버튼 NativeWind 클래스를 결정
 */
function getButtonClass(accentColor: string): string {
  const colorMap: Record<string, string> = {
    '#A855F7': 'bg-primary-600 active:bg-primary-700 dark:bg-primary-700',
    '#D4AF37': 'bg-accent-500 active:bg-accent-600 dark:bg-accent-600',
    '#22C55E': 'bg-success-600 active:bg-success-700 dark:bg-success-700',
    '#7C3AED': 'bg-primary-700 active:bg-primary-800 dark:bg-primary-600',
  };
  return colorMap[accentColor] ?? 'bg-primary-600 active:bg-primary-700 dark:bg-primary-700';
}

// ============================================================================
// Component
// ============================================================================

export function TutorialOverlay({ config, onComplete }: TutorialOverlayProps) {
  const { width: screenWidth } = useWindowDimensions();
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollX = useSharedValue(0);
  const [currentPage, setCurrentPage] = useState(0);
  const completedRef = useRef(false);

  const { pages, accentColor, ctaText } = config;
  const totalPages = pages.length;
  const isLastPage = currentPage === totalPages - 1;

  const iconBgClass = getIconBgClass(accentColor);
  const buttonClass = getButtonClass(accentColor);

  // 스크롤 이벤트 핸들러 (같은 페이지일 때 불필요한 리렌더 방지)
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      scrollX.value = offsetX;
      const page = Math.round(offsetX / screenWidth);
      setCurrentPage((prev) => (prev !== page ? page : prev));
    },
    [scrollX, screenWidth]
  );

  // 다음 페이지로 이동 (completedRef로 이중 호출 방지)
  const handleNext = useCallback(() => {
    if (isLastPage) {
      if (completedRef.current) return;
      completedRef.current = true;
      onComplete();
      return;
    }

    scrollViewRef.current?.scrollTo({
      x: (currentPage + 1) * screenWidth,
      animated: true,
    });
  }, [currentPage, isLastPage, onComplete, screenWidth]);

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-surface-dark">
      {/* 헤더: 건너뛰기 버튼 */}
      <View className="flex-row justify-end px-6 pt-2">
        {!isLastPage ? (
          <Pressable
            onPress={onComplete}
            accessibilityLabel="건너뛰기"
            accessibilityRole="button"
            className="py-2 px-3"
          >
            <Text className="text-base text-gray-500 dark:text-gray-400">건너뛰기</Text>
          </Pressable>
        ) : (
          // 마지막 페이지에서는 공간 유지
          <View className="py-2 px-3">
            <Text className="text-base opacity-0">건너뛰기</Text>
          </View>
        )}
      </View>

      {/* 페이지 콘텐츠 */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
        bounces={false}
        className="flex-1"
      >
        {pages.map((page) => (
          <TutorialPage key={page.id} page={page} width={screenWidth} iconBgClass={iconBgClass} />
        ))}
      </ScrollView>

      {/* 인디케이터 */}
      <TutorialIndicator
        totalPages={totalPages}
        scrollX={scrollX}
        pageWidth={screenWidth}
        activeColor={accentColor}
      />

      {/* 하단 버튼 */}
      <Animated.View entering={FadeInDown.delay(300).duration(500)} className="px-6 pb-4">
        <Pressable
          onPress={handleNext}
          accessibilityLabel={isLastPage ? ctaText : '다음'}
          accessibilityRole="button"
          className={`py-4 rounded-xl items-center ${buttonClass}`}
        >
          <Text className="text-white font-semibold text-base">
            {isLastPage ? ctaText : '다음'}
          </Text>
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}

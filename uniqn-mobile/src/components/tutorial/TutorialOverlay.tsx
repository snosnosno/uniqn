/**
 * UNIQN Mobile - 튜토리얼 오버레이 (메인 캐러셀)
 *
 * @description 풀스크린 스와이프 튜토리얼. ScrollView + pagingEnabled 기반.
 * @version 2.0.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Platform,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { TutorialPage } from '@/components/tutorial/TutorialPage';
import { TutorialIndicator } from '@/components/tutorial/TutorialIndicator';
import { PRIMARY_COLORS, STATUS_COLORS } from '@/constants/colors';
import {
  trackTutorialStart,
  trackTutorialComplete,
  trackTutorialSkip,
} from '@/services/observability/analyticsService';
import type { TutorialConfig } from '@/types/tutorial';

// ============================================================================
// Types
// ============================================================================

interface TutorialOverlayProps {
  /** 튜토리얼 설정 */
  readonly config: TutorialConfig;
  /** 완료/스킵 시 콜백 */
  readonly onComplete: () => void;
  /** 자동 닫힘 타임아웃 (ms). 카운트다운 표시용 */
  readonly timeoutMs?: number;
}

// ============================================================================
// Constants
// ============================================================================

/** 카운트다운 표시 시작 기준 (초) */
const COUNTDOWN_THRESHOLD_SEC = 10;

// ============================================================================
// Helpers (L12: 색상 상수 참조)
// ============================================================================

/**
 * accent 색상으로 아이콘 배경 NativeWind 클래스를 결정
 */
function getIconBgClass(accentColor: string): string {
  const colorMap: Record<string, string> = {
    [PRIMARY_COLORS[500]]: 'bg-primary-50 dark:bg-primary-50',
    [PRIMARY_COLORS[700]]: 'bg-primary-100 dark:bg-primary-100',
    [STATUS_COLORS.success]: 'bg-success-50 dark:bg-success-50',
  };
  return colorMap[accentColor] ?? 'bg-primary-50 dark:bg-primary-50';
}

/**
 * accent 색상으로 버튼 NativeWind 클래스를 결정
 */
function getButtonClass(accentColor: string): string {
  const colorMap: Record<string, string> = {
    [PRIMARY_COLORS[500]]: 'bg-primary-500 active:bg-primary-600',
    [PRIMARY_COLORS[700]]: 'bg-primary-700 active:bg-primary-800',
    [STATUS_COLORS.success]: 'bg-success-600 active:bg-success-700',
  };
  return colorMap[accentColor] ?? 'bg-primary-500 active:bg-primary-600';
}

// ============================================================================
// Component
// ============================================================================

export function TutorialOverlay({ config, onComplete, timeoutMs }: TutorialOverlayProps) {
  const { width: screenWidth } = useWindowDimensions();
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollX = useSharedValue(0);
  const [currentPage, setCurrentPage] = useState(0);
  const completedRef = useRef(false);

  const { pages, accentColor, ctaText, type } = config;
  const totalPages = pages.length;
  const isLastPage = currentPage === totalPages - 1;

  const iconBgClass = getIconBgClass(accentColor);
  const buttonClass = getButtonClass(accentColor);

  // H4: 카운트다운 상태
  const [remainingSec, setRemainingSec] = useState<number | null>(
    timeoutMs ? Math.ceil(timeoutMs / 1000) : null
  );

  // H5: Skip 버튼 opacity 애니메이션
  const skipOpacity = useSharedValue(1);

  useEffect(() => {
    skipOpacity.value = withTiming(isLastPage ? 0 : 1, { duration: 300 });
  }, [isLastPage, skipOpacity]);

  const skipAnimatedStyle = useAnimatedStyle(() => ({
    opacity: skipOpacity.value,
  }));

  // M10: 시작 추적 (마운트 1회)
  useEffect(() => {
    trackTutorialStart(type, totalPages);
  }, [type, totalPages]);

  // H4: 카운트다운 타이머
  useEffect(() => {
    if (!timeoutMs) return;

    const startTime = Date.now();
    const totalSec = Math.ceil(timeoutMs / 1000);

    const interval = setInterval(() => {
      const elapsed = Math.ceil((Date.now() - startTime) / 1000);
      const remaining = totalSec - elapsed;
      setRemainingSec(remaining > 0 ? remaining : 0);
    }, 1000);

    return () => clearInterval(interval);
  }, [timeoutMs]);

  // 스크롤 이벤트 핸들러
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      scrollX.value = offsetX;
      const page = Math.round(offsetX / screenWidth);
      setCurrentPage(page);
    },
    [scrollX, screenWidth]
  );

  // M10: 건너뛰기 (analytics 포함)
  const handleSkip = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    trackTutorialSkip(type, currentPage, totalPages);
    onComplete();
  }, [type, currentPage, totalPages, onComplete]);

  // 다음 페이지로 이동 / 완료 (completedRef로 이중 호출 방지)
  const handleNext = useCallback(() => {
    if (isLastPage) {
      if (completedRef.current) return;
      completedRef.current = true;
      trackTutorialComplete(type);
      onComplete();
      return;
    }

    scrollViewRef.current?.scrollTo({
      x: (currentPage + 1) * screenWidth,
      animated: true,
    });
  }, [currentPage, isLastPage, onComplete, screenWidth, type]);

  // L15: 웹 키보드 내비게이션
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const onKeyDown = (event: Event) => {
      const e = event as KeyboardEvent;
      switch (e.key) {
        case 'ArrowRight':
        case ' ':
          e.preventDefault();
          handleNext();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (currentPage > 0) {
            scrollViewRef.current?.scrollTo({
              x: (currentPage - 1) * screenWidth,
              animated: true,
            });
          }
          break;
        case 'Escape':
          e.preventDefault();
          handleSkip();
          break;
      }
    };

    globalThis.addEventListener('keydown', onKeyDown);
    return () => globalThis.removeEventListener('keydown', onKeyDown);
  }, [currentPage, screenWidth, handleNext, handleSkip]);

  const showCountdown = remainingSec !== null && remainingSec <= COUNTDOWN_THRESHOLD_SEC;

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-surface-dark">
      {/* 헤더: 카운트다운 + 건너뛰기 */}
      <View className="flex-row justify-between items-center px-6 pt-2">
        {/* H4: 카운트다운 경고 */}
        {showCountdown ? (
          <Animated.Text
            entering={FadeIn.duration(300)}
            className="text-xs text-secondary-400 dark:text-secondary-500 font-sans"
          >
            {remainingSec}초 후 자동으로 닫힙니다
          </Animated.Text>
        ) : (
          <View />
        )}

        {/* H5: Skip 버튼 페이드 아웃 */}
        <Animated.View style={[skipAnimatedStyle, { pointerEvents: isLastPage ? 'none' : 'auto' }]}>
          <Pressable
            onPress={handleSkip}
            accessibilityLabel="건너뛰기"
            accessibilityRole="button"
            className="py-2 px-3"
          >
            <Text className="text-base text-secondary-500 dark:text-secondary-400 font-sans">
              건너뛰기
            </Text>
          </Pressable>
        </Animated.View>
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

      {/* H6: 페이지 번호 */}
      <Text className="text-center text-xs text-secondary-400 dark:text-secondary-500 mt-1 font-sans">
        {currentPage + 1} / {totalPages}
      </Text>

      {/* 하단 버튼 */}
      <Animated.View entering={FadeInDown.delay(300).duration(500)} className="px-6 pb-4 mt-2">
        <Pressable
          onPress={handleNext}
          accessibilityLabel={isLastPage ? ctaText : '다음'}
          accessibilityRole="button"
          className={`py-4 rounded-md items-center ${buttonClass}`}
        >
          {/* L14: CTA 텍스트 크로스페이드 */}
          <Animated.Text
            key={isLastPage ? 'cta' : 'next'}
            entering={FadeIn.duration(200)}
            className="text-surface-dark font-sans-semibold text-base"
          >
            {isLastPage ? ctaText : '다음'}
          </Animated.Text>
        </Pressable>
      </Animated.View>
    </SafeAreaView>
  );
}

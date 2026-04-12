/**
 * UNIQN Mobile - 튜토리얼 단일 페이지 컴포넌트
 *
 * @description 스와이프 캐러셀 내 개별 페이지 렌더링
 * @version 1.0.0
 */

import { View, Text } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import type { TutorialPage as TutorialPageType } from '@/types/tutorial';

// ============================================================================
// Types
// ============================================================================

interface TutorialPageProps {
  /** 페이지 데이터 */
  readonly page: TutorialPageType;
  /** 페이지 너비 (ScrollView 정렬용) */
  readonly width: number;
  /** 아이콘 배경 색상 클래스 */
  readonly iconBgClass: string;
}

// ============================================================================
// Component
// ============================================================================

export function TutorialPage({ page, width, iconBgClass }: TutorialPageProps) {
  const IconComponent = page.icon;

  return (
    <View style={{ width }} className="flex-1 justify-center items-center px-8">
      {/* 아이콘 */}
      <Animated.View entering={FadeInUp.delay(200).duration(500)}>
        <View className={`w-24 h-24 rounded-sm items-center justify-center ${iconBgClass}`}>
          <IconComponent size={48} color={page.iconColor} />
        </View>
      </Animated.View>

      {/* 제목 */}
      <Animated.View entering={FadeInUp.delay(350).duration(500)} className="mt-8">
        <Text className="text-2xl font-display text-secondary-900 dark:text-off-white text-center">
          {page.title}
        </Text>
      </Animated.View>

      {/* 부제 */}
      <Animated.View entering={FadeInUp.delay(450).duration(500)} className="mt-2">
        <Text className="text-base text-secondary-500 dark:text-secondary-400 text-center">
          {page.subtitle}
        </Text>
      </Animated.View>

      {/* 설명 */}
      <Animated.View entering={FadeInUp.delay(550).duration(500)} className="mt-6 px-4">
        <Text className="text-sm text-secondary-500 dark:text-secondary-400 text-center leading-relaxed">
          {page.description}
        </Text>
      </Animated.View>
    </View>
  );
}

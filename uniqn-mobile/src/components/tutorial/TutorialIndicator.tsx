/**
 * UNIQN Mobile - 튜토리얼 페이지 인디케이터
 *
 * @description 스크롤 위치 연동 점 애니메이션
 * @version 1.0.0
 */

import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';

// ============================================================================
// Types
// ============================================================================

interface TutorialIndicatorProps {
  /** 전체 페이지 수 */
  readonly totalPages: number;
  /** ScrollView의 scrollX 공유값 */
  readonly scrollX: SharedValue<number>;
  /** 페이지 너비 */
  readonly pageWidth: number;
  /** 활성 점 색상 */
  readonly activeColor: string;
}

// ============================================================================
// Sub-component
// ============================================================================

function Dot({
  index,
  scrollX,
  pageWidth,
  activeColor,
}: {
  readonly index: number;
  readonly scrollX: SharedValue<number>;
  readonly pageWidth: number;
  readonly activeColor: string;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const inputRange = [(index - 1) * pageWidth, index * pageWidth, (index + 1) * pageWidth];

    const width = interpolate(scrollX.value, inputRange, [8, 24, 8], Extrapolation.CLAMP);

    const opacity = interpolate(scrollX.value, inputRange, [0.3, 1, 0.3], Extrapolation.CLAMP);

    return { width, opacity };
  });

  return (
    <Animated.View
      style={[
        {
          height: 8,
          borderRadius: 4,
          backgroundColor: activeColor,
          marginHorizontal: 4,
        },
        animatedStyle,
      ]}
    />
  );
}

// ============================================================================
// Component
// ============================================================================

export function TutorialIndicator({
  totalPages,
  scrollX,
  pageWidth,
  activeColor,
}: TutorialIndicatorProps) {
  return (
    <View className="flex-row justify-center items-center py-4">
      {Array.from({ length: totalPages }).map((_, index) => (
        <Dot
          key={`dot-${index}`}
          index={index}
          scrollX={scrollX}
          pageWidth={pageWidth}
          activeColor={activeColor}
        />
      ))}
    </View>
  );
}

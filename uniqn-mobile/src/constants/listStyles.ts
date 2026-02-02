/**
 * UNIQN Mobile - FlashList/FlatList 공통 스타일 상수
 *
 * @description contentContainerStyle 및 hitSlop 객체 재생성 방지
 * @version 1.0.0
 *
 * 사용 예:
 * ```tsx
 * import { LIST_CONTAINER_STYLES, HIT_SLOP } from '@/constants';
 *
 * <FlashList contentContainerStyle={LIST_CONTAINER_STYLES.padding16} />
 * <Pressable hitSlop={HIT_SLOP.medium} />
 * ```
 */

import { StyleSheet } from 'react-native';

// ============================================================================
// List Container Styles
// ============================================================================

/**
 * FlashList/FlatList contentContainerStyle 상수
 *
 * 매 렌더링마다 새로운 객체 생성 방지
 */
export const LIST_CONTAINER_STYLES = StyleSheet.create({
  /** padding: 16 - 기본 리스트 패딩 */
  padding16: {
    padding: 16,
  },

  /** paddingBottom: 100 - 하단 안전 영역 확보 */
  paddingBottom100: {
    paddingBottom: 100,
  },

  /** padding: 16, paddingBottom: 100 - 패딩 + 하단 안전 영역 */
  padding16Bottom100: {
    padding: 16,
    paddingBottom: 100,
  },

  /** flexGrow: 1 - 빈 상태 컨테이너용 */
  flexGrow: {
    flexGrow: 1,
  },

  /** 수평 탭/필터용 */
  horizontalTabs: {
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});

// ============================================================================
// Hit Slop Constants
// ============================================================================

/**
 * Pressable hitSlop 상수
 *
 * 터치 영역 확대 (최소 44px 터치 타겟 달성)
 */
export const HIT_SLOP = {
  /** 8px 확대 - 작은 아이콘 */
  small: { top: 8, bottom: 8, left: 8, right: 8 },

  /** 10px 확대 - 일반 버튼/아이콘 */
  medium: { top: 10, bottom: 10, left: 10, right: 10 },

  /** 12px 확대 - 중요한 액션 버튼 */
  large: { top: 12, bottom: 12, left: 12, right: 12 },
} as const;

// ============================================================================
// Type Exports
// ============================================================================

export type HitSlopSize = keyof typeof HIT_SLOP;

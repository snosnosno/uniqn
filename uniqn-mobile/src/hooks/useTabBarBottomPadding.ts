/**
 * UNIQN Mobile - 탭바 하단 여백 훅
 *
 * @description 하단 탭바가 있는 화면의 스크롤 컨테이너에 필요한 paddingBottom 을 계산한다.
 *
 * 탭바 실높이는 `LAYOUT.TAB_BAR_HEIGHT + insets.bottom` 이다((tabs)/_layout.tsx 참조).
 * 홈 인디케이터가 있는 iPhone 에서는 insets.bottom ≈ 34 라 총 90px 에 달하는데,
 * 정적 `pb-20`(80px)이나 `paddingBottom: 20` 으로는 이를 덮지 못해 리스트 마지막
 * 항목이 탭바에 가려지고 더 스크롤할 여지도 없어진다 (2026-07-19 실기기 QA —
 * "내 스케줄"에서 날짜별 상세를 펼치면 내용이 잘려 보이지 않던 문제).
 *
 * 기기별 insets 에 따라 달라지므로 반드시 런타임 계산값을 쓴다.
 */

import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LAYOUT } from '@/constants';

/** 탭바에 딱 붙지 않도록 두는 최소 숨 쉴 공간 */
const DEFAULT_BREATHING_ROOM = 28;

/**
 * 탭 화면 스크롤 컨테이너용 paddingBottom.
 *
 * @param breathingRoom 탭바 위에 추가로 둘 여백 (기본 28px)
 *
 * @example
 * const bottomPadding = useTabBarBottomPadding();
 * <ScrollView contentContainerStyle={{ paddingBottom: bottomPadding }} />
 */
export function useTabBarBottomPadding(breathingRoom: number = DEFAULT_BREATHING_ROOM): number {
  const insets = useSafeAreaInsets();

  return useMemo(
    () => LAYOUT.TAB_BAR_HEIGHT + insets.bottom + breathingRoom,
    [insets.bottom, breathingRoom]
  );
}

/**
 * UNIQN Mobile - Pull-to-Refresh (PTR) 공용 상수
 *
 * @description 리스트 화면의 RefreshControl 틴트/배경을 Black & Gold 팔레트로 통일.
 * - iOS: tintColor
 * - Android: colors (progress arrow) + progressBackgroundColor (배경 원)
 * - 다크 surface(#111113)와 브랜드 골드(#D4AF37) 조합
 *
 * @usage
 * ```tsx
 * import { PTR_REFRESH_PROPS } from '@/constants/ptr';
 * <RefreshControl refreshing={refreshing} onRefresh={onRefresh} {...PTR_REFRESH_PROPS} />
 * ```
 *
 * @note `colors`는 React Native RefreshControl 시그니처가 mutable `ColorValue[]`를 요구하므로
 *       `as const`를 쓰지 않는다. getter로 새 배열을 매번 생성해 호출 측이 실수로 push해도
 *       상수가 오염되지 않도록 한다.
 */

import type { ColorValue } from 'react-native';
import { PRIMARY_COLORS } from './colors';

interface PtrRefreshProps {
  /** iOS 틴트 색 — 브랜드 골드 */
  readonly tintColor: ColorValue;
  /** Android 프로그레스 화살표 색 (배열, mutable per RN types) */
  readonly colors: ColorValue[];
  /** Android 프로그레스 원 배경 — 다크 surface-elevated */
  readonly progressBackgroundColor: ColorValue;
}

export const PTR_REFRESH_PROPS: PtrRefreshProps = {
  tintColor: PRIMARY_COLORS[500],
  colors: [PRIMARY_COLORS[500]],
  progressBackgroundColor: '#111113',
};

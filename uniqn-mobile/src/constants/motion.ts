/**
 * UNIQN Mobile - 공용 모션 토큰 (이징 · duration)
 *
 * @description 컴포넌트가 `Easing.*` 를 직접 쓰지 않고 이 토큰을 소비한다(impeccable 룰 8).
 *              화면마다 손으로 박힌 커브·시간을 한 곳으로 수렴시켜, 커브 개선이 전파될
 *              경로를 만든다.
 *
 * ⚠️ `constants/animation.ts` 와 분리된 이유:
 *    이 파일은 모듈 스코프에서 `Easing.bezier()` 를 평가한다(reanimated 의존).
 *    `animation.ts` 는 주문서 연쇄 로직(`SHEET_CHAIN_SWAP_MS` 등)과 그 테스트가
 *    소비하므로, 그쪽에 reanimated 의존을 얹으면 전파 범위가 불필요하게 넓어진다.
 *    `animation.ts` 의 대기 시간 상수들은 '연출 커브'가 아니라 '네이티브 dismiss 커밋
 *    대기'로 개념이 다르다 — 두 파일을 합치지 말 것.
 *
 * import 는 배럴이 아니라 `@/constants/motion` 직접 경로를 쓴다
 * (배럴 상수 순환 참조로 모듈 스코프 값이 undefined 가 되는 함정이 3회 재발했다).
 */

import { Easing } from 'react-native-reanimated';

/**
 * 공용 모션 이징 토큰 (impeccable 룰 8).
 * 컴포넌트에서 Easing.* 를 직접 쓰지 말고 이 토큰을 소비한다.
 */
export const MOTION_EASING = {
  /** 입장·상태변경 기본 — 강한 ease-out (cubic-bezier(0.25, 1, 0.5, 1)) */
  enter: Easing.bezier(0.25, 1, 0.5, 1),
  /** 시트/드로어 travel — iOS 드로어 커브 (cubic-bezier(0.32, 0.72, 0, 1)) */
  sheet: Easing.bezier(0.32, 0.72, 0, 1),
  /** opacity 페이드 전용 (백드롭·크로스페이드) */
  fade: Easing.ease,
  /** 화면 밖 퇴장 travel — 가속 (룰 25의 exit ease-in 관례) */
  exitTravel: Easing.in(Easing.ease),
} as const;

/** 공용 모션 duration 토큰 (ms). 퇴장 = 입장 × 0.75 규칙(룰 8). */
export const MOTION_DURATION = {
  /** 퇴장·즉시 피드백 */
  fast: 150,
  /** 토스트·페이드 입장 */
  base: 200,
  /** 시트 퇴장 (= sheet 300 × 0.75) */
  sheetExit: 225,
  /** 모달 스케일 입장 */
  emphasized: 250,
  /** 시트 travel 입장 */
  sheet: 300,
} as const;

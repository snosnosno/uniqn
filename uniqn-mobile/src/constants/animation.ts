/**
 * UNIQN Mobile - 애니메이션/타이밍 상수
 */

import { Easing } from 'react-native-reanimated';

/**
 * 네이티브 Modal(시트) dismiss 애니메이션 대기 시간 (ms).
 *
 * iOS 에서 두 네이티브 Modal 을 겹쳐 present 하면 터치 라우팅이 깨지므로,
 * 시트를 먼저 닫고 이 시간만큼 기다린 뒤 2차 모달(QR 스캐너·확인 다이얼로그·신고)을 연다.
 * iOS pageSheet dismiss 애니메이션(~250ms)에 여유를 더한 값.
 */
export const SHEET_DISMISS_ANIMATION_MS = 300;

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

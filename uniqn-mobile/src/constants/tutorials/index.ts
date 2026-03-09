/**
 * UNIQN Mobile - 튜토리얼 상수 배럴 export
 */

import type { TutorialType } from '@/types/tutorial';

// ============================================================================
// Re-exports
// ============================================================================

export { APP_INTRO_STAFF, APP_INTRO_EMPLOYER } from './appIntroTutorial';
export { POSTING_GUIDE_TUTORIAL } from './postingGuideTutorial';
export { SETTLEMENT_EMPLOYER_TUTORIAL, SETTLEMENT_STAFF_TUTORIAL } from './settlementTutorial';
export { QR_CHECKIN_TUTORIAL } from './qrCheckInTutorial';

// ============================================================================
// MMKV 키 상수
// ============================================================================

/** 튜토리얼 MMKV 키 접두사 (단일 소스) */
export const TUTORIAL_STORAGE_PREFIX = 'tutorial';

// ============================================================================
// MMKV 키 매핑
// ============================================================================

/** 튜토리얼 MMKV 키에 사용하는 매핑 (TutorialType → storage key) */
export const TUTORIAL_KEY_MAP: Readonly<Record<TutorialType, string>> = {
  appIntro: 'app_intro',
  postingGuide: 'posting_guide',
  settlement: 'settlement',
  qrCheckIn: 'qr_checkin',
} as const;

// ============================================================================
// 버전 관리
// ============================================================================

/**
 * 각 튜토리얼의 현재 버전 (단일 소스)
 *
 * 튜토리얼 내용 변경 시 해당 버전을 증가시키면
 * 이미 완료한 사용자에게도 다시 표시됨
 */
export const TUTORIAL_VERSIONS: Readonly<Record<TutorialType, number>> = {
  appIntro: 1,
  postingGuide: 1,
  settlement: 1,
  qrCheckIn: 1,
} as const;

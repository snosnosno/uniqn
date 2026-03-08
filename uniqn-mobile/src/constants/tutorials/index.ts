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
// 버전 관리
// ============================================================================

/**
 * 각 튜토리얼의 현재 버전
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

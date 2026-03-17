/**
 * UNIQN Mobile - 튜토리얼 관련 타입 정의
 *
 * @description 풀스크린 스와이프 튜토리얼 시스템의 타입
 * @version 1.0.0
 */

import type { ComponentType } from 'react';

// ============================================================================
// 아이콘 Props (icons/index.tsx 호환)
// ============================================================================

export interface IconProps {
  readonly size?: number;
  readonly color?: string;
}

// ============================================================================
// 튜토리얼 타입
// ============================================================================

/** 튜토리얼 식별자 */
export type TutorialType = 'appIntro' | 'qrCheckIn';

// ============================================================================
// 튜토리얼 페이지
// ============================================================================

/** 단일 튜토리얼 페이지 */
export interface TutorialPage {
  readonly id: string;
  readonly icon: ComponentType<IconProps>;
  readonly iconColor: string;
  readonly title: string;
  readonly subtitle: string;
  readonly description: string;
}

// ============================================================================
// 튜토리얼 설정
// ============================================================================

/** 튜토리얼 구성 (version은 TUTORIAL_VERSIONS에서 단일 관리) */
export interface TutorialConfig {
  readonly type: TutorialType;
  readonly accentColor: string;
  readonly ctaText: string;
  readonly pages: readonly TutorialPage[];
}

// ============================================================================
// 훅 반환 타입
// ============================================================================

export interface UseTutorialReturn {
  /** 해당 튜토리얼을 아직 보지 않았는지 */
  readonly needsTutorial: boolean;
  /** 튜토리얼 완료 처리 (스킵 포함) */
  readonly completeTutorial: () => void;
  /** 튜토리얼 초기화 (개발/테스트용) */
  readonly resetTutorial: () => void;
  /** 로딩 중 */
  readonly isLoading: boolean;
  /** 자동 닫힘 타임아웃 (ms). TutorialOverlay 카운트다운용 */
  readonly timeoutMs: number;
}

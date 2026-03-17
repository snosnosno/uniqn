/**
 * UNIQN Mobile - 튜토리얼 상태 관리 훅
 *
 * @description 기능별 튜토리얼 완료 여부를 MMKV에 저장하고 관리
 * @version 2.0.0
 */

import { useCallback } from 'react';
import {
  TUTORIAL_KEY_MAP,
  TUTORIAL_VERSIONS,
  TUTORIAL_STORAGE_PREFIX,
} from '@/constants/tutorials';
import { useCompletionFlag } from '@/hooks/useCompletionFlag';
import { trackTutorialTimeout } from '@/services/observability/analyticsService';
import type { TutorialType, UseTutorialReturn } from '@/types/tutorial';

// ============================================================================
// Constants
// ============================================================================

/** 페이지당 타임아웃 (ms) */
const MS_PER_PAGE = 15_000;

/** 최소 타임아웃 (ms) */
const MIN_TIMEOUT_MS = 30_000;

// ============================================================================
// Types
// ============================================================================

export interface UseTutorialOptions {
  /** 페이지 수 (타임아웃 계산용) */
  readonly pageCount?: number;
  /** 표시 딜레이 (ms). 온보딩 직후 바로 튜토리얼이 뜨는 것을 방지 */
  readonly delayMs?: number;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * 튜토리얼 상태 관리 훅
 *
 * 비유: 놀이공원 입장권 시스템. 각 놀이기구(기능)마다 "처음 탑승" 여부를 체크하고,
 * 처음이면 안전 가이드(튜토리얼)를 보여준 뒤 "탑승 완료" 도장을 찍는 방식.
 *
 * @param type - 튜토리얼 식별자
 * @param options - 페이지 수, 딜레이 등 선택 옵션
 *
 * @example
 * const { needsTutorial, completeTutorial } = useTutorial('appIntro', { pageCount: 5 });
 *
 * if (needsTutorial) {
 *   return <TutorialOverlay config={APP_INTRO_STAFF} onComplete={completeTutorial} />;
 * }
 */
export function useTutorial(type: TutorialType, options?: UseTutorialOptions): UseTutorialReturn {
  const key = TUTORIAL_KEY_MAP[type];
  const pageCount = options?.pageCount ?? 3;
  const timeoutMs = Math.max(pageCount * MS_PER_PAGE, MIN_TIMEOUT_MS);

  // H1: 타임아웃 시 analytics 추적
  const handleTimeout = useCallback(() => {
    trackTutorialTimeout(type);
  }, [type]);

  const { needsAction, complete, reset, isLoading } = useCompletionFlag({
    completedKeyPrefix: `${TUTORIAL_STORAGE_PREFIX}:${key}`,
    versionKeyPrefix: `${TUTORIAL_STORAGE_PREFIX}:version:${key}`,
    currentVersion: TUTORIAL_VERSIONS[type],
    timeoutMs,
    delayMs: options?.delayMs,
    label: `튜토리얼(${type})`,
    onTimeout: handleTimeout,
  });

  return {
    needsTutorial: needsAction,
    completeTutorial: complete,
    resetTutorial: reset,
    isLoading,
    timeoutMs,
  };
}

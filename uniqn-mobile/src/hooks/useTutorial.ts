/**
 * UNIQN Mobile - 튜토리얼 상태 관리 훅
 *
 * @description 기능별 튜토리얼 완료 여부를 MMKV에 저장하고 관리
 * @version 1.0.0
 */

import { useCallback, useEffect, useState } from 'react';
import storage from '@/lib/mmkvStorage';
import { useAuthStore } from '@/stores/authStore';
import { hashUID } from '@/utils/hash';
import { logger } from '@/utils/logger';
import { TUTORIAL_VERSIONS } from '@/constants/tutorials';
import type { TutorialType, UseTutorialReturn } from '@/types/tutorial';
import { TUTORIAL_KEY_MAP } from '@/types/tutorial';

// ============================================================================
// Constants
// ============================================================================

/** 튜토리얼 MMKV 키 접두사 */
const TUTORIAL_PREFIX = 'tutorial';

/** 사용자가 튜토리얼에 갇히지 않도록 하는 안전장치 (ms) */
const TUTORIAL_TIMEOUT_MS = 30_000;

// ============================================================================
// Helpers
// ============================================================================

function buildKeys(type: TutorialType, userHash: string) {
  const key = TUTORIAL_KEY_MAP[type];
  return {
    completed: `${TUTORIAL_PREFIX}:${key}:${userHash}`,
    version: `${TUTORIAL_PREFIX}:version:${key}:${userHash}`,
  } as const;
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
 *
 * @example
 * const { needsTutorial, completeTutorial } = useTutorial('postingGuide');
 *
 * if (needsTutorial) {
 *   return <TutorialOverlay config={POSTING_GUIDE} onComplete={completeTutorial} />;
 * }
 */
export function useTutorial(type: TutorialType): UseTutorialReturn {
  const { user, isAuthenticated } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [needsTutorial, setNeedsTutorial] = useState(false);

  // 튜토리얼 상태 확인
  useEffect(() => {
    if (!isAuthenticated || !user?.uid) {
      setNeedsTutorial(false);
      setIsLoading(false);
      return;
    }

    try {
      const mmkv = storage.getMMKVInstance();
      const userHash = hashUID(user.uid);
      const keys = buildKeys(type, userHash);

      const isCompleted = mmkv.getString(keys.completed) === 'true';
      const savedVersion = parseInt(mmkv.getString(keys.version) ?? '0', 10);
      const currentVersion = TUTORIAL_VERSIONS[type];

      const needs = !isCompleted || savedVersion < currentVersion;
      setNeedsTutorial(needs);

      logger.debug('튜토리얼 상태 확인', {
        type,
        userHash,
        isCompleted,
        savedVersion,
        currentVersion,
        needs,
      });
    } catch (error) {
      logger.error('튜토리얼 상태 확인 실패', error as Error);
      setNeedsTutorial(false);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user?.uid, type]);

  // 30초 타임아웃 안전장치
  useEffect(() => {
    if (!needsTutorial) return;

    const timeout = setTimeout(() => {
      logger.warn('튜토리얼 타임아웃 - 강제 완료', { type });
      setNeedsTutorial(false);
      // MMKV에도 저장하여 다음 진입 시 다시 표시하지 않음
      if (user?.uid) {
        try {
          const mmkv = storage.getMMKVInstance();
          const userHash = hashUID(user.uid);
          const keys = buildKeys(type, userHash);
          mmkv.set(keys.completed, 'true');
          mmkv.set(keys.version, String(TUTORIAL_VERSIONS[type]));
        } catch {
          // 타임아웃 시 저장 실패해도 무시
        }
      }
    }, TUTORIAL_TIMEOUT_MS);

    return () => clearTimeout(timeout);
  }, [needsTutorial, type, user?.uid]);

  // 완료 처리
  const completeTutorial = useCallback(() => {
    if (!user?.uid) return;

    try {
      const mmkv = storage.getMMKVInstance();
      const userHash = hashUID(user.uid);
      const keys = buildKeys(type, userHash);

      mmkv.set(keys.completed, 'true');
      mmkv.set(keys.version, String(TUTORIAL_VERSIONS[type]));

      setNeedsTutorial(false);

      logger.info('튜토리얼 완료', { type, userHash });
    } catch (error) {
      logger.error('튜토리얼 완료 저장 실패', error as Error);
      // 저장 실패해도 UI에서는 닫기
      setNeedsTutorial(false);
    }
  }, [user?.uid, type]);

  // 초기화 (테스트/디버깅용)
  const resetTutorial = useCallback(() => {
    if (!user?.uid) return;

    try {
      const mmkv = storage.getMMKVInstance();
      const userHash = hashUID(user.uid);
      const keys = buildKeys(type, userHash);

      mmkv.delete(keys.completed);
      mmkv.delete(keys.version);

      setNeedsTutorial(true);

      logger.info('튜토리얼 초기화', { type, userHash });
    } catch (error) {
      logger.error('튜토리얼 초기화 실패', error as Error);
    }
  }, [user?.uid, type]);

  return {
    needsTutorial,
    completeTutorial,
    resetTutorial,
    isLoading,
  };
}

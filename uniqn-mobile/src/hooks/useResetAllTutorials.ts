/**
 * UNIQN Mobile - 모든 튜토리얼 리셋 전용 훅
 *
 * @description 설정 화면에서 "튜토리얼 다시 보기" 기능을 위한 경량 훅
 *
 * 비유: 놀이공원의 "전체 도장 초기화" 창구.
 * useTutorial은 각 놀이기구별 도장 확인 + 타임아웃 안전장치까지 포함하지만,
 * 이 훅은 순수하게 "모든 도장을 지우는" 역할만 수행합니다.
 *
 * useTutorial 대신 이 훅을 사용하는 이유:
 * useTutorial은 내부적으로 타임아웃 effect를 활성화하므로,
 * 설정 화면에서 4회 호출 시 미완료 튜토리얼이 30초 후 자동 완료되는 버그 발생.
 * 이 훅은 MMKV 직접 접근만 하므로 부작용 없음.
 */

import { useCallback } from 'react';
import storage from '@/lib/mmkvStorage';
import { useUserHash } from '@/hooks/useUserHash';
import { TUTORIAL_KEY_MAP, TUTORIAL_STORAGE_PREFIX } from '@/constants/tutorials';
import type { TutorialType } from '@/types/tutorial';
import { logger } from '@/utils/logger';

/**
 * 모든 튜토리얼을 리셋하는 함수를 반환
 *
 * @example
 * const resetAllTutorials = useResetAllTutorials();
 * // 버튼 클릭 시
 * resetAllTutorials();
 */
export function useResetAllTutorials(): () => void {
  const userHash = useUserHash();

  return useCallback(() => {
    if (!userHash) return;

    try {
      const mmkv = storage.getMMKVInstance();
      const types = Object.keys(TUTORIAL_KEY_MAP) as TutorialType[];

      for (const type of types) {
        const key = TUTORIAL_KEY_MAP[type];
        mmkv.delete(`${TUTORIAL_STORAGE_PREFIX}:${key}:${userHash}`);
        mmkv.delete(`${TUTORIAL_STORAGE_PREFIX}:version:${key}:${userHash}`);
      }

      logger.info('모든 튜토리얼 초기화', { userHash });
    } catch (error) {
      logger.error('튜토리얼 초기화 실패', error as Error);
    }
  }, [userHash]);
}

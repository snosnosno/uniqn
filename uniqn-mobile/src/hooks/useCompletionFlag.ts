/**
 * UNIQN Mobile - MMKV 기반 완료 플래그 관리 베이스 훅
 *
 * @description 온보딩/튜토리얼 등 "처음 한 번" 표시 로직의 공통 기반
 *
 * 비유: 놀이공원 도장 시스템. 놀이기구(기능)든 입장 안내(온보딩)든
 * "처음인가?" 확인 -> 안내 표시 -> "완료" 도장 찍기 로직은 동일합니다.
 */

import { useCallback, useEffect, useState } from 'react';
import { getMMKVInstance } from '@/lib/mmkvStorage';
import { logger } from '@/utils/logger';
import { useUserHash } from '@/hooks/useUserHash';

// ============================================================================
// Types
// ============================================================================

export interface UseCompletionFlagOptions {
  /** MMKV 완료 상태 키 (userHash 없이, 접두사만) */
  readonly completedKeyPrefix: string;
  /** MMKV 버전 키 (userHash 없이, 접두사만) */
  readonly versionKeyPrefix: string;
  /** 현재 버전 */
  readonly currentVersion: number;
  /** 자동 완료 타임아웃 (ms). undefined면 타임아웃 없음 */
  readonly timeoutMs?: number;
  /** 표시 딜레이 (ms). 온보딩 후 바로 튜토리얼이 뜨는 것을 방지 */
  readonly delayMs?: number;
  /** 디버그 로깅용 라벨 */
  readonly label?: string;
  /** 타임아웃 발생 시 콜백 (analytics 등) */
  readonly onTimeout?: () => void;
}

export interface UseCompletionFlagReturn {
  /** 아직 완료하지 않았는지 (표시 필요 여부) */
  readonly needsAction: boolean;
  /** 완료 처리 */
  readonly complete: () => void;
  /** 초기화 (개발/테스트용) */
  readonly reset: () => void;
  /** 로딩 중 */
  readonly isLoading: boolean;
}

// ============================================================================
// Hook
// ============================================================================

export function useCompletionFlag(options: UseCompletionFlagOptions): UseCompletionFlagReturn {
  const {
    completedKeyPrefix,
    versionKeyPrefix,
    currentVersion,
    timeoutMs,
    delayMs,
    label = 'completionFlag',
    onTimeout,
  } = options;

  const userHash = useUserHash();
  const [isLoading, setIsLoading] = useState(true);
  const [needsAction, setNeedsAction] = useState(false);
  const [isDelaying, setIsDelaying] = useState(false);

  // 사용자별 키 생성
  const completedKey = userHash ? `${completedKeyPrefix}:${userHash}` : null;
  const versionKey = userHash ? `${versionKeyPrefix}:${userHash}` : null;

  // 상태 확인
  useEffect(() => {
    if (!userHash || !completedKey || !versionKey) {
      setNeedsAction(false);
      setIsLoading(false);
      return;
    }

    try {
      const mmkv = getMMKVInstance();
      const isCompleted = mmkv.getString(completedKey) === 'true';
      const savedVersion = parseInt(mmkv.getString(versionKey) ?? '0', 10);
      const needs = !isCompleted || savedVersion < currentVersion;

      setNeedsAction(needs);

      logger.debug(`${label} 상태 확인`, {
        userHash,
        isCompleted,
        savedVersion,
        currentVersion,
        needs,
      });
    } catch (error) {
      logger.error(`${label} 상태 확인 실패`, error as Error);
      setNeedsAction(false);
    } finally {
      setIsLoading(false);
    }
  }, [userHash, completedKey, versionKey, currentVersion, label]);

  // 표시 딜레이
  useEffect(() => {
    if (!needsAction || !delayMs) {
      setIsDelaying(false);
      return;
    }

    setIsDelaying(true);
    const timer = setTimeout(() => setIsDelaying(false), delayMs);
    return () => clearTimeout(timer);
  }, [needsAction, delayMs]);

  // 타임아웃 안전장치
  useEffect(() => {
    if (!needsAction || !timeoutMs) return;

    const timeout = setTimeout(() => {
      logger.warn(`${label} 타임아웃 - 강제 완료`);
      setNeedsAction(false);
      onTimeout?.();

      if (completedKey && versionKey) {
        try {
          const mmkv = getMMKVInstance();
          mmkv.set(completedKey, 'true');
          mmkv.set(versionKey, String(currentVersion));
        } catch {
          // 타임아웃 시 저장 실패해도 무시
        }
      }
    }, timeoutMs);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onTimeout은 호출부에서 안정적 참조 유지
  }, [needsAction, timeoutMs, completedKey, versionKey, currentVersion, label]);

  // 완료 처리
  const complete = useCallback(() => {
    if (!completedKey || !versionKey) return;

    try {
      const mmkv = getMMKVInstance();
      mmkv.set(completedKey, 'true');
      mmkv.set(versionKey, String(currentVersion));
      setNeedsAction(false);

      logger.info(`${label} 완료`, { userHash });
    } catch (error) {
      logger.error(`${label} 완료 저장 실패`, error as Error);
      setNeedsAction(false);
    }
  }, [completedKey, versionKey, currentVersion, userHash, label]);

  // 초기화 (테스트/디버깅용)
  const reset = useCallback(() => {
    if (!completedKey || !versionKey) return;

    try {
      const mmkv = getMMKVInstance();
      mmkv.delete(completedKey);
      mmkv.delete(versionKey);
      setNeedsAction(true);

      logger.info(`${label} 초기화`, { userHash });
    } catch (error) {
      logger.error(`${label} 초기화 실패`, error as Error);
    }
  }, [completedKey, versionKey, userHash, label]);

  return {
    needsAction: needsAction && !isDelaying,
    complete,
    reset,
    isLoading,
  };
}

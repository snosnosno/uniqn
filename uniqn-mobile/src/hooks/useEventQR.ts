/**
 * UNIQN Mobile - 이벤트 QR 훅
 *
 * @description 구인자용 현장 출퇴근 QR 코드 관리 훅
 * @version 1.0.0
 *
 * 기능:
 * - QR 코드 생성 및 표시 데이터 관리
 * - 자동 갱신 (만료 전)
 * - 남은 시간 카운트다운
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  generateEventQR,
  deactivateEventQR,
  getQRRemainingSeconds,
  stringifyQRData,
  QR_REFRESH_INTERVAL_MS,
} from '@/services';
import { logger } from '@/utils/logger';
import { useToastStore } from '@/stores/toastStore';
import type { QRCodeAction, EventQRDisplayData } from '@/types';

// ============================================================================
// Constants
// ============================================================================

/** 재시도 대기 시간 (10초) */
const RETRY_DELAY_MS = 10 * 1000;
/** 최대 재시도 횟수 */
const MAX_RETRY_COUNT = 3;

// ============================================================================
// Types
// ============================================================================

export interface UseEventQROptions {
  /** 자동 갱신 활성화 (기본: true) */
  autoRefresh?: boolean;
}

export interface UseEventQRReturn {
  /** QR 코드 데이터 (JSON 문자열 - QRCode 컴포넌트에 전달) */
  qrValue: string | null;
  /** QR 표시 데이터 */
  displayData: EventQRDisplayData | null;
  /** 남은 시간 (초) */
  remainingSeconds: number;
  /** QR 활성화 여부 */
  isActive: boolean;
  /** 현재 액션 (출근/퇴근) */
  currentAction: QRCodeAction;
  /** 로딩 상태 (최초 생성) */
  isLoading: boolean;
  /** 갱신 중 상태 (자동/수동 갱신) */
  isRefreshing: boolean;
  /** 에러 */
  error: Error | null;

  // Actions
  /** QR 생성 */
  generate: (action: QRCodeAction) => Promise<void>;
  /** QR 갱신 */
  refresh: () => Promise<void>;
  /** QR 비활성화 */
  deactivate: () => Promise<void>;
  /** 액션 전환 (출근 <-> 퇴근) */
  toggleAction: () => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useEventQR(
  jobPostingId: string,
  date: string,
  createdBy: string,
  options: UseEventQROptions = {}
): UseEventQRReturn {
  const { autoRefresh = true } = options;
  const { addToast } = useToastStore();

  // State
  const [qrValue, setQrValue] = useState<string | null>(null);
  const [displayData, setDisplayData] = useState<EventQRDisplayData | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [currentAction, setCurrentAction] = useState<QRCodeAction>('checkIn');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Refs
  const qrIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(false);

  // 마운트 상태 추적
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ============================================================================
  // 타이머 정리
  // ============================================================================

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  // ============================================================================
  // 카운트다운 시작
  // ============================================================================

  const startCountdown = useCallback((expiresAt: number) => {
    clearTimers();

    // 1초마다 남은 시간 업데이트
    timerRef.current = setInterval(() => {
      // 타이머 콜백에서 마운트 체크
      if (!isMountedRef.current) {
        clearTimers();
        return;
      }

      const remaining = getQRRemainingSeconds(expiresAt);
      setRemainingSeconds(remaining);

      if (remaining <= 0) {
        clearTimers();
        setIsActive(false);
      }
    }, 1000);

    // 초기 값 설정
    if (isMountedRef.current) {
      setRemainingSeconds(getQRRemainingSeconds(expiresAt));
    }
  }, [clearTimers]);

  // ============================================================================
  // QR 생성
  // ============================================================================

  const generate = useCallback(async (action: QRCodeAction) => {
    // 마운트 체크
    if (!isMountedRef.current) {
      logger.warn('QR 생성 스킵 (컴포넌트 미마운트)');
      return;
    }

    // 기존 타이머 먼저 정리 (race condition 방지)
    clearTimers();

    // 최초 생성인지 갱신인지 구분
    const isRefresh = isActive;

    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      logger.info('이벤트 QR 생성 시작', { jobPostingId, date, action, isRefresh });

      const result = await generateEventQR({
        jobPostingId,
        date,
        action,
        createdBy,
      });

      // 비동기 작업 후 마운트 체크
      if (!isMountedRef.current) {
        logger.warn('QR 생성 완료 후 상태 업데이트 스킵 (컴포넌트 언마운트됨)');
        return;
      }

      qrIdRef.current = result.qrId;
      setDisplayData(result.displayData);
      setQrValue(stringifyQRData(result.displayData));
      setCurrentAction(action);
      setIsActive(true);

      // 카운트다운 시작
      startCountdown(result.displayData.expiresAt);

      // 성공 시 재시도 카운트 초기화
      retryCountRef.current = 0;

      // 자동 갱신 설정
      if (autoRefresh) {
        const currentTimerId = setTimeout(async () => {
          // 마운트 및 타이머 ID 일치 확인 (race condition 방지)
          if (!isMountedRef.current || refreshTimerRef.current !== currentTimerId) {
            logger.info('QR 자동 갱신 스킵 (미마운트 또는 타이머 변경됨)');
            return;
          }

          try {
            await generate(action);
          } catch (err) {
            logger.error('QR 자동 갱신 실패', err as Error);

            // 재시도 로직
            if (retryCountRef.current < MAX_RETRY_COUNT && isMountedRef.current) {
              retryCountRef.current++;
              logger.info('QR 자동 갱신 재시도 예약', {
                retryCount: retryCountRef.current,
                maxRetry: MAX_RETRY_COUNT,
                delayMs: RETRY_DELAY_MS,
              });

              const retryTimerId = setTimeout(() => {
                // 재시도 타이머 ID 및 마운트 확인
                if (!isMountedRef.current || refreshTimerRef.current !== retryTimerId) return;

                generate(action).catch(() => {
                  // 재시도 실패 시 사용자에게 알림
                  if (retryCountRef.current >= MAX_RETRY_COUNT && isMountedRef.current) {
                    addToast({
                      type: 'error',
                      message: 'QR 코드 갱신에 실패했습니다. 수동으로 새로고침 해주세요.',
                    });
                  }
                });
              }, RETRY_DELAY_MS);
              refreshTimerRef.current = retryTimerId;
            } else if (isMountedRef.current) {
              addToast({
                type: 'error',
                message: 'QR 코드 갱신에 실패했습니다. 수동으로 새로고침 해주세요.',
              });
            }
          }
        }, QR_REFRESH_INTERVAL_MS);
        refreshTimerRef.current = currentTimerId;
      }

      logger.info('이벤트 QR 생성 완료', { qrId: result.qrId });
    } catch (err) {
      const error = err as Error;
      // 에러 처리 시에도 마운트 체크
      if (isMountedRef.current) {
        setError(error);
        addToast({ type: 'error', message: 'QR 코드 생성에 실패했습니다.' });
      }
      logger.error('이벤트 QR 생성 실패', error, { jobPostingId, date, action });
    } finally {
      // finally 블록에서도 마운트 체크
      if (isMountedRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [jobPostingId, date, createdBy, autoRefresh, isActive, startCountdown, addToast, clearTimers]);

  // ============================================================================
  // QR 갱신
  // ============================================================================

  const refresh = useCallback(async () => {
    await generate(currentAction);
  }, [generate, currentAction]);

  // ============================================================================
  // QR 비활성화
  // ============================================================================

  const deactivate = useCallback(async () => {
    try {
      clearTimers();

      if (qrIdRef.current) {
        await deactivateEventQR(qrIdRef.current);
        qrIdRef.current = null;
      }

      // 상태 업데이트 시 마운트 체크
      if (isMountedRef.current) {
        setQrValue(null);
        setDisplayData(null);
        setRemainingSeconds(0);
        setIsActive(false);
      }

      logger.info('이벤트 QR 비활성화 완료');
    } catch (err) {
      logger.error('이벤트 QR 비활성화 실패', err as Error);
    }
  }, [clearTimers]);

  // ============================================================================
  // 액션 전환
  // ============================================================================

  const toggleAction = useCallback(() => {
    if (!isMountedRef.current) return;

    const newAction = currentAction === 'checkIn' ? 'checkOut' : 'checkIn';
    setCurrentAction(newAction);

    // 활성 QR이 있으면 새 액션으로 재생성
    if (isActive) {
      generate(newAction);
    }
  }, [currentAction, isActive, generate]);

  // ============================================================================
  // 정리
  // ============================================================================

  useEffect(() => {
    return () => {
      clearTimers();
      // 언마운트 시 QR 비활성화 (에러 무시)
      if (qrIdRef.current) {
        deactivateEventQR(qrIdRef.current).catch((err) => {
          logger.warn('언마운트 시 QR 비활성화 실패 (무시)', { error: err });
        });
        qrIdRef.current = null;
      }
    };
  }, [clearTimers]);

  // ============================================================================
  // Return
  // ============================================================================

  return {
    qrValue,
    displayData,
    remainingSeconds,
    isActive,
    currentAction,
    isLoading,
    isRefreshing,
    error,

    // Actions
    generate,
    refresh,
    deactivate,
    toggleAction,
  };
}

export default useEventQR;

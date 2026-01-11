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
  type QRAction,
  type EventQRDisplayData,
} from '@/services';
import { logger } from '@/utils/logger';
import { useToastStore } from '@/stores/toastStore';

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
  currentAction: QRAction;
  /** 로딩 상태 */
  isLoading: boolean;
  /** 에러 */
  error: Error | null;

  // Actions
  /** QR 생성 */
  generate: (action: QRAction) => Promise<void>;
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
  const [currentAction, setCurrentAction] = useState<QRAction>('checkIn');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Refs
  const qrIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      const remaining = getQRRemainingSeconds(expiresAt);
      setRemainingSeconds(remaining);

      if (remaining <= 0) {
        clearTimers();
        setIsActive(false);
      }
    }, 1000);

    // 초기 값 설정
    setRemainingSeconds(getQRRemainingSeconds(expiresAt));
  }, [clearTimers]);

  // ============================================================================
  // QR 생성
  // ============================================================================

  const generate = useCallback(async (action: QRAction) => {
    try {
      setIsLoading(true);
      setError(null);

      logger.info('이벤트 QR 생성 시작', { jobPostingId, date, action });

      const result = await generateEventQR({
        eventId: jobPostingId,
        date,
        action,
        createdBy,
      });

      qrIdRef.current = result.qrId;
      setDisplayData(result.displayData);
      setQrValue(stringifyQRData(result.displayData));
      setCurrentAction(action);
      setIsActive(true);

      // 카운트다운 시작
      startCountdown(result.displayData.expiresAt);

      // 자동 갱신 설정
      if (autoRefresh) {
        refreshTimerRef.current = setTimeout(async () => {
          try {
            await generate(action);
          } catch (err) {
            logger.error('QR 자동 갱신 실패', err as Error);
          }
        }, QR_REFRESH_INTERVAL_MS);
      }

      logger.info('이벤트 QR 생성 완료', { qrId: result.qrId });
    } catch (err) {
      const error = err as Error;
      setError(error);
      addToast({ type: 'error', message: 'QR 코드 생성에 실패했습니다.' });
      logger.error('이벤트 QR 생성 실패', error, { jobPostingId, date, action });
    } finally {
      setIsLoading(false);
    }
  }, [jobPostingId, date, createdBy, autoRefresh, startCountdown, addToast]);

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

      setQrValue(null);
      setDisplayData(null);
      setRemainingSeconds(0);
      setIsActive(false);

      logger.info('이벤트 QR 비활성화 완료');
    } catch (err) {
      logger.error('이벤트 QR 비활성화 실패', err as Error);
    }
  }, [clearTimers]);

  // ============================================================================
  // 액션 전환
  // ============================================================================

  const toggleAction = useCallback(() => {
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
    error,

    // Actions
    generate,
    refresh,
    deactivate,
    toggleAction,
  };
}

export default useEventQR;

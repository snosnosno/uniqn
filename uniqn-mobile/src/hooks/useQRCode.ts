/**
 * UNIQN Mobile - QR 코드 훅
 *
 * @description QR 코드 생성, 스캔, 검증을 위한 훅
 * @version 1.0.0
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { createQRCode, validateQRCode } from '@/services/qrCodeService';
import { processEventQRCheckIn } from '@/services/eventQRService';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { logger } from '@/utils/logger';
import type {
  QRCodeData,
  QRCodeAction,
  QRCodeScanResult,
  CreateQRCodeRequest,
} from '@/types';

// ============================================================================
// Constants
// ============================================================================

/** QR 코드 자동 갱신 시간 (만료 2분 전) */
const AUTO_REFRESH_BUFFER_MS = 2 * 60 * 1000;

// ============================================================================
// Types
// ============================================================================

interface UseQRCodeOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

interface UseQRCodeScannerOptions extends UseQRCodeOptions {
  workLogId?: string; // deprecated: processEventQRCheckIn이 내부에서 처리
  expectedAction?: QRCodeAction;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * QR 코드 생성 훅
 */
export function useCreateQRCode(options: UseQRCodeOptions = {}) {
  const { onSuccess, onError } = options;
  const user = useAuthStore((state) => state.user);
  const addToast = useToastStore((state) => state.addToast);

  const mutation = useMutation({
    mutationFn: async (request: CreateQRCodeRequest) => {
      if (!user?.uid) throw new Error('로그인이 필요합니다.');
      return createQRCode(user.uid, request);
    },
    onSuccess: (data) => {
      logger.info('QR 코드 생성 성공', { qrCodeId: data.id });
      onSuccess?.();
    },
    onError: (error: Error) => {
      logger.error('QR 코드 생성 실패', error);
      addToast({
        type: 'error',
        message: 'QR 코드 생성에 실패했습니다.',
      });
      onError?.(error);
    },
  });

  return {
    createQRCode: mutation.mutate,
    qrData: mutation.data,
    isLoading: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  };
}

/**
 * QR 코드 스캔 및 출퇴근 처리 훅
 *
 * @description Event QR 시스템을 통해 출퇴근 처리
 * - processEventQRCheckIn()이 eventQRCodes 컬렉션 검증 및 workLogs 업데이트 수행
 */
export function useQRCodeScanner(options: UseQRCodeScannerOptions) {
  const { onSuccess, onError } = options;
  const user = useAuthStore((state) => state.user);
  const addToast = useToastStore((state) => state.addToast);

  const [isProcessing, setIsProcessing] = useState(false);

  // QR 스캔 결과 처리 (Event QR 시스템 통합)
  const handleScanResult = useCallback(
    async (result: QRCodeScanResult) => {
      if (!result.success) {
        addToast({
          type: 'error',
          message: result.error || '스캔에 실패했습니다.',
        });
        return;
      }

      // 원본 QR 문자열 확인
      const qrString = result.qrString;

      if (!qrString) {
        addToast({
          type: 'error',
          message: 'QR 코드를 읽을 수 없습니다.',
        });
        return;
      }

      if (!user?.uid) {
        addToast({
          type: 'error',
          message: '로그인이 필요합니다.',
        });
        return;
      }

      try {
        setIsProcessing(true);

        // Event QR 처리 (eventQRCodes 검증 + workLogs 업데이트)
        const scanResult = await processEventQRCheckIn(qrString, user.uid);

        if (scanResult.success) {
          addToast({
            type: 'success',
            message: scanResult.message,
          });
          onSuccess?.();
        } else {
          addToast({
            type: 'error',
            message: '처리에 실패했습니다.',
          });
        }
      } catch (error) {
        logger.error('QR 스캔 처리 실패', error as Error);
        addToast({
          type: 'error',
          message: (error as Error).message || '처리에 실패했습니다.',
        });
        onError?.(error as Error);
      } finally {
        setIsProcessing(false);
      }
    },
    [user?.uid, addToast, onSuccess, onError]
  );

  return {
    handleScanResult,
    isProcessing,
  };
}

/**
 * QR 코드 검증 훅
 */
export function useValidateQRCode() {
  const addToast = useToastStore((state) => state.addToast);

  const mutation = useMutation({
    mutationFn: async ({
      qrCodeId,
      expectedAction,
    }: {
      qrCodeId: string;
      expectedAction?: QRCodeAction;
    }) => {
      return validateQRCode(qrCodeId, expectedAction);
    },
    onError: (error: Error) => {
      logger.error('QR 코드 검증 실패', error);
      addToast({
        type: 'error',
        message: 'QR 코드 검증에 실패했습니다.',
      });
    },
  });

  return {
    validateQRCode: mutation.mutate,
    validationResult: mutation.data,
    isValidating: mutation.isPending,
    error: mutation.error,
  };
}

/**
 * QR 스캔 모달 상태 관리 훅
 */
export function useQRScannerModal() {
  const [isVisible, setIsVisible] = useState(false);
  const [action, setAction] = useState<QRCodeAction | undefined>();

  const openScanner = useCallback((scanAction?: QRCodeAction) => {
    setAction(scanAction);
    setIsVisible(true);
  }, []);

  const closeScanner = useCallback(() => {
    setIsVisible(false);
    setAction(undefined);
  }, []);

  return {
    isVisible,
    action,
    openScanner,
    closeScanner,
  };
}

/**
 * QR 코드 표시 모달 상태 관리 훅
 */
export function useQRDisplayModal() {
  const [isVisible, setIsVisible] = useState(false);
  const [qrData, setQRData] = useState<QRCodeData | null>(null);
  const [action, setAction] = useState<QRCodeAction | undefined>();

  const openDisplay = useCallback((data: QRCodeData, displayAction?: QRCodeAction) => {
    setQRData(data);
    setAction(displayAction);
    setIsVisible(true);
  }, []);

  const closeDisplay = useCallback(() => {
    setIsVisible(false);
    // 데이터는 애니메이션 완료 후 초기화
    setTimeout(() => {
      setQRData(null);
      setAction(undefined);
    }, 300);
  }, []);

  const updateQRData = useCallback((data: QRCodeData) => {
    setQRData(data);
  }, []);

  return {
    isVisible,
    qrData,
    action,
    openDisplay,
    closeDisplay,
    updateQRData,
  };
}

/**
 * QR 코드 자동 갱신 훅
 *
 * @description QR 코드 만료 2분 전에 자동으로 새 QR 코드를 생성
 *
 * @example
 * const { qrData, isExpired, refresh, timeRemaining } = useQRAutoRefresh({
 *   eventId: 'event-123',
 *   action: 'checkIn',
 *   enabled: isModalVisible,
 * });
 */
export function useQRAutoRefresh(options: {
  eventId: string;
  action: QRCodeAction;
  enabled?: boolean;
  onRefresh?: (qrData: QRCodeData) => void;
  onError?: (error: Error) => void;
}) {
  const { eventId, action, enabled = true, onRefresh, onError } = options;

  const user = useAuthStore((state) => state.user);
  const addToast = useToastStore((state) => state.addToast);

  const [qrData, setQRData] = useState<QRCodeData | null>(null);
  const [isExpired, setIsExpired] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // QR 코드 생성 함수
  const generateQRCode = useCallback(async () => {
    if (!user?.uid || !eventId) {
      logger.warn('QR 생성 불가: 사용자 또는 이벤트 ID 없음');
      return null;
    }

    try {
      setIsLoading(true);
      const newQRData = await createQRCode(user.uid, { eventId, action });
      setQRData(newQRData);
      setIsExpired(false);

      logger.info('QR 코드 자동 생성', { qrCodeId: newQRData.id, action });
      onRefresh?.(newQRData);

      return newQRData;
    } catch (error) {
      logger.error('QR 코드 자동 생성 실패', error as Error);
      addToast({
        type: 'error',
        message: 'QR 코드 생성에 실패했습니다.',
      });
      onError?.(error as Error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid, eventId, action, addToast, onRefresh, onError]);

  // 수동 갱신
  const refresh = useCallback(async () => {
    // 기존 타이머 취소
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    return generateQRCode();
  }, [generateQRCode]);

  // 자동 갱신 타이머 설정
  const scheduleAutoRefresh = useCallback(
    (expiresAt: Date) => {
      // 기존 타이머 취소
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }

      const now = Date.now();
      const expiresAtMs = expiresAt.getTime();
      const timeUntilRefresh = expiresAtMs - now - AUTO_REFRESH_BUFFER_MS;

      if (timeUntilRefresh <= 0) {
        // 이미 갱신 시간 지남, 즉시 갱신
        logger.info('QR 즉시 갱신 (갱신 시간 경과)');
        generateQRCode();
        return;
      }

      logger.info('QR 자동 갱신 예약', {
        timeUntilRefresh: Math.round(timeUntilRefresh / 1000) + '초',
      });

      refreshTimerRef.current = setTimeout(() => {
        if (enabled) {
          logger.info('QR 자동 갱신 실행');
          generateQRCode();
        }
      }, timeUntilRefresh);
    },
    [enabled, generateQRCode]
  );

  // 남은 시간 업데이트
  const updateTimeRemaining = useCallback(() => {
    if (!qrData?.expiresAt) {
      setTimeRemaining(0);
      setIsExpired(true);
      return;
    }

    const now = Date.now();
    const expiresAt = qrData.expiresAt.toMillis();
    const remaining = expiresAt - now;

    if (remaining <= 0) {
      setTimeRemaining(0);
      setIsExpired(true);
    } else {
      setTimeRemaining(remaining);
      setIsExpired(false);
    }
  }, [qrData?.expiresAt]);

  // 초기 QR 코드 생성 및 타이머 설정
  useEffect(() => {
    if (!enabled) {
      // 비활성화 시 타이머 정리
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      return;
    }

    // 초기 QR 코드 생성
    generateQRCode();

    // 클린업
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, eventId, action]);

  // QR 데이터 변경 시 자동 갱신 예약
  useEffect(() => {
    if (!qrData?.expiresAt || !enabled) return;

    const expiresAt = qrData.expiresAt.toDate();
    scheduleAutoRefresh(expiresAt);
  }, [qrData, enabled, scheduleAutoRefresh]);

  // 카운트다운 타이머
  useEffect(() => {
    if (!enabled || !qrData) {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      return;
    }

    // 초기 값 설정
    updateTimeRemaining();

    // 1초마다 업데이트
    countdownTimerRef.current = setInterval(updateTimeRemaining, 1000);

    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
    };
  }, [enabled, qrData, updateTimeRemaining]);

  // 포맷된 남은 시간 (mm:ss)
  const formattedTimeRemaining = useCallback(() => {
    if (timeRemaining <= 0) return '00:00';

    const minutes = Math.floor(timeRemaining / (60 * 1000));
    const seconds = Math.floor((timeRemaining % (60 * 1000)) / 1000);

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, [timeRemaining]);

  return {
    qrData,
    isExpired,
    isLoading,
    timeRemaining,
    formattedTimeRemaining: formattedTimeRemaining(),
    refresh,
  };
}

export default {
  useCreateQRCode,
  useQRCodeScanner,
  useValidateQRCode,
  useQRScannerModal,
  useQRDisplayModal,
  useQRAutoRefresh,
};

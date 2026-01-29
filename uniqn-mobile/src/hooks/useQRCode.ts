/**
 * UNIQN Mobile - QR 코드 훅
 *
 * @description QR 코드 스캔 및 모달 상태 관리 훅
 * @version 2.0.0 - 레거시 훅 제거, eventQRService 통합
 *
 * @note QR 생성은 useEventQR 훅 사용 (구인자용)
 */

import { useState, useCallback } from 'react';
import { processEventQRCheckIn } from '@/services/eventQRService';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { logger } from '@/utils/logger';
import type { QRCodeAction, QRCodeScanResult, EventQRDisplayData } from '@/types';
import { isAppError } from '@/errors/AppError';
import { toError } from '@/errors';

// ============================================================================
// Types
// ============================================================================

interface UseQRCodeScannerOptions {
  /** 스캔 성공 시 콜백 */
  onSuccess?: () => void;
  /** 스캔 실패 시 콜백 */
  onError?: (error: Error) => void;
}

// ============================================================================
// Hooks
// ============================================================================

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
        logger.error('QR 스캔 처리 실패', toError(error));
        // AppError의 userMessage 활용 (사용자 친화적 메시지)
        const errorMessage = isAppError(error)
          ? error.userMessage
          : toError(error).message || '처리에 실패했습니다.';
        addToast({
          type: 'error',
          message: errorMessage,
        });
        onError?.(toError(error));
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
 *
 * @note EventQRDisplayData를 사용하여 이벤트 QR 시스템과 통합
 */
export function useQRDisplayModal() {
  const [isVisible, setIsVisible] = useState(false);
  const [displayData, setDisplayData] = useState<EventQRDisplayData | null>(null);
  const [action, setAction] = useState<QRCodeAction | undefined>();

  const openDisplay = useCallback(
    (data: EventQRDisplayData, displayAction?: QRCodeAction) => {
      setDisplayData(data);
      setAction(displayAction);
      setIsVisible(true);
    },
    []
  );

  const closeDisplay = useCallback(() => {
    setIsVisible(false);
    // 데이터는 애니메이션 완료 후 초기화
    setTimeout(() => {
      setDisplayData(null);
      setAction(undefined);
    }, 300);
  }, []);

  const updateDisplayData = useCallback((data: EventQRDisplayData) => {
    setDisplayData(data);
  }, []);

  return {
    isVisible,
    displayData,
    action,
    openDisplay,
    closeDisplay,
    updateDisplayData,
  };
}

// ============================================================================
// Exports
// ============================================================================

export default {
  useQRCodeScanner,
  useQRScannerModal,
  useQRDisplayModal,
};

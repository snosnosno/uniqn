/**
 * UNIQN Mobile - QR 코드 훅
 *
 * @description QR 코드 스캔 및 모달 상태 관리 훅
 * @version 3.0.0 - 공고당 고정 QR 전환, 회전 QR 표시 훅 제거
 *
 * @note QR 생성은 서버 왕복이 없다 — buildVenueQRString(jobPostingId) 참고.
 */

import { useState, useCallback, useRef } from 'react';
import { processQRCheckIn } from '@/services/work/eventQRService';
import { requireOnlineForMutation } from '@/services/offline/remoteMutationGuard';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { queryClient, queryKeys } from '@/lib/queryClient';
import { logger } from '@/utils/logger';
import type { QRCodeAction, QRCodeScanResult, QRScanError } from '@/types';
import { isAppError } from '@/errors/AppError';
import { toError, normalizeError } from '@/errors';

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
 * @description 공고당 고정 QR 로 출퇴근 처리
 * - processQRCheckIn()이 QR 파싱·배정 후보 선택·출퇴근 반영을 모두 수행한다
 * - 출근/퇴근 구분은 서버가 현재 status 로 결정한다 (QR 에 미인코딩)
 */
export function useQRCodeScanner(options: UseQRCodeScannerOptions) {
  const { onSuccess, onError } = options;
  const user = useAuthStore((state) => state.user);
  const addToast = useToastStore((state) => state.addToast);

  const [isProcessing, setIsProcessing] = useState(false);
  const [lastError, setLastError] = useState<QRScanError | null>(null);
  const lastScanTimeRef = useRef(0);
  const QR_SCAN_THROTTLE_MS = 5000; // 5초 throttle

  const clearError = useCallback(() => setLastError(null), []);

  // QR 스캔 결과 처리 (고정 QR 단일 진입점, 5초 throttle 적용)
  const handleScanResult = useCallback(
    async (result: QRCodeScanResult) => {
      // throttle: 5초 이내 중복 스캔 방지
      const now = Date.now();
      if (now - lastScanTimeRef.current < QR_SCAN_THROTTLE_MS) {
        return;
      }
      lastScanTimeRef.current = now;
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

        // 오프라인 가드: 체크인은 쓰기 작업이므로 오프라인이면 명확히 안내한다.
        // (예전엔 가드 없이 RPC 직행 → 약전파 현장에서 raw 네트워크 에러 산발)
        requireOnlineForMutation('useQRCodeScanner.checkIn');

        // 고정 QR 처리 (QR 파싱 + 배정 후보 선택 + 출퇴근 반영)
        const scanResult = await processQRCheckIn(qrString, user.uid);

        if (scanResult.success) {
          // 캐시 무효화: workLogs 변경 → schedules도 갱신 필요
          await queryClient.invalidateQueries({ queryKey: queryKeys.workLogs.all });
          await queryClient.invalidateQueries({ queryKey: queryKeys.schedules.all });

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
        const appError = isAppError(error) ? error : normalizeError(toError(error));
        setLastError({
          code: appError.code,
          message: errorMessage,
          isRetryable: appError.isRetryable,
        });
        // 토스트 생략: scanError UI가 스캐너 화면에서 에러를 표시
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
    lastError,
    clearError,
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

// ============================================================================
// Exports
// ============================================================================

export default {
  useQRCodeScanner,
  useQRScannerModal,
};

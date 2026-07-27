/**
 * UNIQN Mobile - QR 코드 훅
 *
 * @description QR 코드 스캔 처리 훅
 * @version 3.1.0 - 공고당 고정 QR 전환, 회전 QR 표시 훅 및 스캐너 모달 훅 제거
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
import { isWeb } from '@/utils/platform';
import type { QRCodeScanResult, QRScanError } from '@/types';
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
      // throttle: 5초 이내 중복 스캔 방지.
      //
      // [QR-2] 과거엔 진입 즉시 타임스탬프를 갱신하고 **되돌리지 않아서**, 실패한 시도가
      // 이후 5초를 통째로 잠갔다. 카메라가 QR 을 계속 인식하는데 아무 반응이 없는(토스트조차
      // 없는) 무음 구간이 생기고, 화면은 그동안 초록 '스캔 완료!' 를 그리고 있었다 — 거짓 성공.
      //
      // 그래서 '진입 시 갱신 + 실패 시 되돌림' 으로 바꾼다. 진입 시 갱신은 서버 왕복 중
      // 연사 스캔을 막는 원래 목적이라 유지해야 한다(제거하면 중복 제출이 열린다).
      const now = Date.now();
      if (now - lastScanTimeRef.current < QR_SCAN_THROTTLE_MS) {
        return;
      }
      const previousScanTime = lastScanTimeRef.current;
      lastScanTimeRef.current = now;
      /** 실패 경로에서 throttle 창을 되돌려 즉시 재시도할 수 있게 한다. */
      const releaseThrottle = () => {
        lastScanTimeRef.current = previousScanTime;
      };

      if (!result.success) {
        releaseThrottle();
        addToast({
          type: 'error',
          message: result.error || '스캔에 실패했습니다.',
        });
        return;
      }

      // 원본 QR 문자열 확인
      const qrString = result.qrString;

      if (!qrString) {
        releaseThrottle();
        addToast({
          type: 'error',
          message: 'QR 코드를 읽을 수 없습니다.',
        });
        return;
      }

      if (!user?.uid) {
        releaseThrottle();
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
          releaseThrottle();
          addToast({
            type: 'error',
            message: '처리에 실패했습니다.',
          });
        }
      } catch (error) {
        releaseThrottle();
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

        // 네이티브 스캐너는 scanError prop 으로 화면에 에러를 그리므로 토스트를 겹치지 않는다.
        // 웹 스캐너(QRCodeScanner.web.tsx)에는 그 prop 자체가 없고, QR 인식 즉시 "스캔 완료!"를
        // 띄운다 — 침묵이 아니라 **거짓 성공 표시**다. 웹에서만 토스트로 실패를 알린다.
        if (isWeb) {
          addToast({
            type: 'error',
            message: errorMessage,
          });
        }

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

// ============================================================================
// Exports
// ============================================================================

export default {
  useQRCodeScanner,
};

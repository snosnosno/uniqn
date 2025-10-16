/**
 * QR 출석 스캔 처리 Hook
 *
 * @version 1.0
 * @since 2025-01-16
 * @author T-HOLDEM Development Team
 *
 * 주요 기능:
 * - QR 코드 스캔 처리
 * - 출근/퇴근 처리
 * - 실시간 상태 업데이트
 */

import { useState, useCallback } from 'react';
import { Timestamp } from 'firebase/firestore';
import { parseQRPayload } from '../utils/qrTokenGenerator';
import { handleCheckInQR, handleCheckOutQR } from '../services/QRAttendanceService';
import { logger } from '../utils/logger';
import type { QRAttendanceResult } from '../types/qrAttendance';

export interface UseQRAttendanceOptions {
  /** 스캔한 스태프 ID */
  staffId: string;

  /** 성공 콜백 */
  onSuccess?: (result: QRAttendanceResult) => void;

  /** 에러 콜백 */
  onError?: (error: string) => void;
}

export interface QRAttendanceState {
  /** 처리 중 상태 */
  processing: boolean;

  /** 에러 메시지 */
  error: string | null;

  /** 마지막 처리 결과 */
  lastResult: QRAttendanceResult | null;

  /** QR 스캔 처리 함수 */
  handleScan: (qrCodeData: string) => Promise<void>;

  /** 에러 초기화 */
  clearError: () => void;
}

/**
 * QR 출석 스캔 처리 Hook
 *
 * @param options QR 출석 옵션
 * @returns QR 출석 상태 및 처리 함수
 *
 * @example
 * ```typescript
 * const { processing, error, handleScan, clearError } = useQRAttendance({
 *   staffId: 'staff-123',
 *   onSuccess: (result) => {
 *     console.log('출석 처리 성공:', result.message);
 *   },
 *   onError: (error) => {
 *     console.error('출석 처리 실패:', error);
 *   }
 * });
 *
 * // QR 스캔 결과 처리
 * await handleScan(scannedQRData);
 * ```
 */
export function useQRAttendance(options: UseQRAttendanceOptions): QRAttendanceState {
  const { staffId, onSuccess, onError } = options;

  const [processing, setProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<QRAttendanceResult | null>(null);

  /**
   * QR 코드 스캔 처리
   *
   * @param qrCodeData QR 코드 데이터 (JSON 문자열)
   */
  const handleScan = useCallback(
    async (qrCodeData: string) => {
      try {
        setProcessing(true);
        setError(null);

        // 1. QR 페이로드 파싱
        const payload = parseQRPayload(qrCodeData);

        if (!payload) {
          const errorMsg = '유효하지 않은 QR 코드입니다.';
          setError(errorMsg);
          if (onError) {
            onError(errorMsg);
          }
          logger.warn('QR 페이로드 파싱 실패', { data: { qrCodeData } });
          return;
        }

        // 2. 버전 확인
        if (payload.version !== '1.0') {
          const errorMsg = '지원하지 않는 QR 코드 버전입니다.';
          setError(errorMsg);
          if (onError) {
            onError(errorMsg);
          }
          logger.warn('QR 버전 불일치', { data: { version: payload.version } });
          return;
        }

        // 3. 타입별 처리
        let result: QRAttendanceResult;

        if (payload.type === 'check-in') {
          // 출근 처리
          result = await handleCheckInQR({
            payload,
            staffId,
            scannedAt: Timestamp.now()
          });
        } else if (payload.type === 'check-out') {
          // 퇴근 처리
          result = await handleCheckOutQR({
            payload,
            staffId,
            scannedAt: Timestamp.now()
          });
        } else {
          const errorMsg = '알 수 없는 QR 코드 타입입니다.';
          setError(errorMsg);
          if (onError) {
            onError(errorMsg);
          }
          return;
        }

        // 4. 결과 저장
        setLastResult(result);

        // 5. 결과에 따라 콜백 호출
        if (result.success) {
          if (onSuccess) {
            onSuccess(result);
          }
          logger.info('QR 출석 처리 성공', {
            data: { staffId, type: payload.type, message: result.message }
          });
        } else {
          setError(result.message);
          if (onError) {
            onError(result.message);
          }
          logger.warn('QR 출석 처리 실패', {
            data: { staffId, type: payload.type, message: result.message }
          });
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'QR 스캔 처리 중 오류가 발생했습니다.';
        setError(errorMsg);
        if (onError) {
          onError(errorMsg);
        }
        logger.error('QR 스캔 처리 중 예외 발생', err as Error, { staffId });
      } finally {
        setProcessing(false);
      }
    },
    [staffId, onSuccess, onError]
  );

  /**
   * 에러 초기화
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    processing,
    error,
    lastResult,
    handleScan,
    clearError
  };
}

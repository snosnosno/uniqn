/**
 * 스태프 QR Hook
 *
 * @version 2.0
 * @since 2025-10-16
 * @author T-HOLDEM Development Team
 *
 * 주요 기능:
 * - 스태프 QR 생성 및 표시
 * - QR 재생성
 * - QR 페이로드 동적 생성 (3분 자동 갱신)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getOrCreateStaffQR,
  regenerateStaffQR,
  generateDynamicQRPayload
} from '../services/StaffQRService';
import { StaffQRMetadata, StaffQRPayload } from '../types/staffQR';
import { logger } from '../utils/logger';

interface UseStaffQROptions {
  userId: string;
  userName: string;
  autoRefresh?: boolean; // 3분마다 자동 갱신 (기본: true)
}

interface UseStaffQRReturn {
  qrMetadata: StaffQRMetadata | null;
  qrPayload: StaffQRPayload | null;
  qrString: string | null;
  loading: boolean;
  error: string | null;
  regenerate: () => Promise<void>;
  refresh: () => Promise<void>;
  remainingSeconds: number;
}

/**
 * 스태프 QR Hook
 */
export function useStaffQR({
  userId,
  userName,
  autoRefresh = true
}: UseStaffQROptions): UseStaffQRReturn {
  const [qrMetadata, setQrMetadata] = useState<StaffQRMetadata | null>(null);
  const [qrPayload, setQrPayload] = useState<StaffQRPayload | null>(null);
  const [qrString, setQrString] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(180); // 3분 = 180초

  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * QR 페이로드 생성 및 JSON 문자열 변환
   */
  const generateQRString = useCallback((metadata: StaffQRMetadata): string => {
    try {
      const payload = generateDynamicQRPayload(userId, metadata.securityCode);
      setQrPayload(payload);

      const qrJson = JSON.stringify(payload);
      setQrString(qrJson);

      // 카운트다운 초기화
      setRemainingSeconds(180);

      logger.info('QR 페이로드 생성 완료', {
        data: {
          userId,
          userName,
          generatedAt: new Date(payload.generatedAt).toISOString()
        }
      });

      return qrJson;
    } catch (err) {
      logger.error('QR 페이로드 생성 실패', err as Error, { data: { userId } });
      throw err;
    }
  }, [userId, userName]);

  /**
   * QR 메타데이터 로드 및 페이로드 생성
   */
  const loadQR = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      logger.debug('스태프 QR 로딩 시작', { data: { userId, userName } });

      const metadata = await getOrCreateStaffQR(userId, userName);
      setQrMetadata(metadata);

      generateQRString(metadata);

      setLoading(false);

      logger.info('스태프 QR 로딩 완료', {
        data: {
          userId,
          userName,
          regenerationCount: metadata.regenerationCount
        }
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'QR 생성 중 오류가 발생했습니다.';

      setError(errorMessage);
      setLoading(false);

      logger.error('스태프 QR 로딩 실패', err as Error, { data: { userId, userName } });
    }
  }, [userId, userName, generateQRString]);

  /**
   * QR 재생성 (보안 코드 변경)
   */
  const regenerate = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      logger.info('스태프 QR 재생성 시작', { data: { userId, userName } });

      const newMetadata = await regenerateStaffQR(userId);
      setQrMetadata(newMetadata);

      generateQRString(newMetadata);

      setLoading(false);

      logger.info('스태프 QR 재생성 완료', {
        data: {
          userId,
          userName,
          regenerationCount: newMetadata.regenerationCount
        }
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'QR 재생성 중 오류가 발생했습니다.';

      setError(errorMessage);
      setLoading(false);

      logger.error('스태프 QR 재생성 실패', err as Error, { data: { userId, userName } });
    }
  }, [userId, userName, generateQRString]);

  /**
   * QR 새로고침 (페이로드만 재생성, 메타데이터 유지)
   */
  const refresh = useCallback(async () => {
    if (!qrMetadata) {
      logger.warn('QR 메타데이터가 없어 새로고침 불가', { data: { userId } });
      return;
    }

    try {
      logger.debug('QR 페이로드 새로고침', { data: { userId } });
      generateQRString(qrMetadata);
    } catch (err) {
      logger.error('QR 새로고침 실패', err as Error, { data: { userId } });
      setError('QR 새로고침에 실패했습니다.');
    }
  }, [userId, qrMetadata, generateQRString]);

  /**
   * 자동 새로고침 (3분마다)
   */
  useEffect(() => {
    if (!autoRefresh || !qrMetadata) return;

    // 3분(180초)마다 새로고침
    refreshIntervalRef.current = setInterval(() => {
      logger.debug('자동 QR 새로고침', { userId });
      refresh();
    }, 180 * 1000);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [autoRefresh, qrMetadata, userId, refresh]);

  /**
   * 카운트다운 (1초마다)
   */
  useEffect(() => {
    if (!qrPayload) return;

    countdownIntervalRef.current = setInterval(() => {
      setRemainingSeconds(prev => {
        const elapsed = Math.floor((Date.now() - qrPayload.generatedAt) / 1000);
        const remaining = 180 - elapsed;

        if (remaining <= 0) {
          // 자동 새로고침
          if (autoRefresh) {
            refresh();
          }
          return 0;
        }

        return remaining;
      });
    }, 1000);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [qrPayload, autoRefresh, refresh]);

  /**
   * 초기 로드
   */
  useEffect(() => {
    loadQR();
  }, [loadQR]);

  return {
    qrMetadata,
    qrPayload,
    qrString,
    loading,
    error,
    regenerate,
    refresh,
    remainingSeconds
  };
}

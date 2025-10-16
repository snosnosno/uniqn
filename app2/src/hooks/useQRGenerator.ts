/**
 * QR 코드 생성 Hook
 *
 * @version 1.0
 * @since 2025-01-16
 * @author T-HOLDEM Development Team
 *
 * 주요 기능:
 * - 클라이언트 사이드 QR 생성
 * - 1분 주기 자동 재생성
 * - 카운트다운 타이머
 * - 시드 자동 초기화
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  generateQRToken,
  generateQRPayload,
  getTokenExpirySeconds
} from '../utils/qrTokenGenerator';
import { initializeDailyQRSeed, getQRSeed } from '../services/QRAttendanceService';
import { logger } from '../utils/logger';
import type { EventQRSeed } from '../types/qrAttendance';

export interface UseQRGeneratorOptions {
  /** 공고(이벤트) ID */
  eventId: string;

  /** 날짜 (YYYY-MM-DD 형식) */
  date: string;

  /** QR 타입 */
  type: 'check-in' | 'check-out';

  /** 라운드업 간격 (퇴근 시 사용) */
  roundUpInterval?: 15 | 30;

  /** 자동 재생성 활성화 여부 */
  autoRefresh?: boolean;

  /** 생성자 ID (시드 초기화 시 필요) */
  createdBy?: string | undefined;
}

export interface QRGeneratorState {
  /** 현재 QR 코드 데이터 (JSON 문자열) */
  qrData: string | null;

  /** 로딩 상태 */
  loading: boolean;

  /** 에러 메시지 */
  error: string | null;

  /** QR 시드 정보 */
  seedInfo: EventQRSeed | null;

  /** 만료까지 남은 초 */
  secondsRemaining: number;

  /** 수동 재생성 함수 */
  refresh: () => Promise<void>;
}

/**
 * QR 코드 생성 Hook
 *
 * @param options QR 생성 옵션
 * @returns QR 생성 상태 및 제어 함수
 *
 * @example
 * ```typescript
 * const { qrData, loading, error, secondsRemaining, refresh } = useQRGenerator({
 *   eventId: 'event-123',
 *   date: '2025-01-16',
 *   type: 'check-in',
 *   roundUpInterval: 30,
 *   autoRefresh: true,
 *   createdBy: 'user-456'
 * });
 *
 * if (loading) return <div>로딩 중...</div>;
 * if (error) return <div>에러: {error}</div>;
 *
 * return (
 *   <div>
 *     <QRCode value={qrData || ''} />
 *     <p>{secondsRemaining}초 후 재생성</p>
 *   </div>
 * );
 * ```
 */
export function useQRGenerator(options: UseQRGeneratorOptions): QRGeneratorState {
  const {
    eventId,
    date,
    type,
    roundUpInterval = 30,
    autoRefresh = true,
    createdBy
  } = options;

  const [qrData, setQrData] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [seedInfo, setSeedInfo] = useState<EventQRSeed | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(60);

  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * QR 코드 생성
   */
  const generateQR = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. 시드 가져오기 또는 초기화
      let seed = await getQRSeed(eventId, date);

      if (!seed && createdBy) {
        // 시드가 없으면 초기화 (관리자만 가능)
        seed = await initializeDailyQRSeed(
          eventId,
          date,
          createdBy,
          roundUpInterval
        );
      }

      if (!seed) {
        throw new Error('QR 코드를 생성할 수 없습니다. 관리자에게 문의하세요.');
      }

      setSeedInfo(seed);

      // 2. 현재 타임스탬프
      const now = Date.now();

      // 3. 토큰 생성
      const token = generateQRToken(eventId, date, type, seed.seed, now);

      // 4. 페이로드 생성 (JSON 문자열)
      const payload = generateQRPayload(eventId, date, type, token, now);

      setQrData(payload);

      // 5. 만료까지 남은 시간 계산
      const remaining = getTokenExpirySeconds(now);
      setSecondsRemaining(remaining);

      logger.info('QR 코드 생성 완료', { data: { eventId, date, type } });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'QR 코드 생성 실패';
      logger.error('QR 코드 생성 실패', err as Error, { data: { eventId, date, type } });
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [eventId, date, type, roundUpInterval, createdBy]);

  /**
   * 카운트다운 타이머
   */
  useEffect(() => {
    if (!autoRefresh || secondsRemaining <= 0) return;

    countdownTimerRef.current = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          return 60; // 다음 주기 시작
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
      }
    };
  }, [autoRefresh, secondsRemaining]);

  /**
   * 자동 재생성 타이머
   */
  useEffect(() => {
    if (!autoRefresh) return;

    // 초기 생성
    generateQR();

    // 1분(60초)마다 재생성
    refreshTimerRef.current = setInterval(() => {
      generateQR();
    }, 60 * 1000);

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [autoRefresh, generateQR]);

  /**
   * 수동 재생성
   */
  const refresh = useCallback(async () => {
    await generateQR();
  }, [generateQR]);

  return {
    qrData,
    loading,
    error,
    seedInfo,
    secondsRemaining,
    refresh
  };
}

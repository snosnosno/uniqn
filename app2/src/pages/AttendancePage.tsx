/**
 * 출석 페이지 (v2.0 - QR 출석 시스템)
 *
 * @version 2.0
 * @since 2025-01-16
 * @author T-HOLDEM Development Team
 *
 * 주요 변경사항:
 * - 새로운 QR 출석 시스템 통합 (TOTP 기반)
 * - useQRAttendance Hook 사용
 * - 실시간 피드백 및 Toast 알림
 */

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePageOptimizedData } from '../hooks/useUnifiedData';
import { useQRAttendance } from '../hooks/useQRAttendance';
import { useToast } from '../hooks/useToast';
import { logger } from '../utils/logger';

// Html5QrcodeScanner 타입 정의
type Html5QrcodeScanner = {
  render: (onSuccess: (decodedText: string) => void, onError: (error: string) => void) => void;
  clear: () => Promise<void>;
};

const AttendancePage: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const { currentUser, role } = useAuth();
  const { showSuccess, showError } = useToast();

  const [scanResult, setScanResult] = useState<string>('');
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  // Smart Hybrid Context 사용 - 자신의 출석 데이터만 구독
  const { workLogs, attendanceRecords, loading: _loading } = usePageOptimizedData(location.pathname);

  // QR 출석 처리 Hook
  const {
    processing,
    error,
    handleScan,
    clearError
  } = useQRAttendance({
    staffId: currentUser?.uid || '',
    onSuccess: (result) => {
      showSuccess(result.message);
      logger.info('출석 처리 성공', { data: { message: result.message } });
    },
    onError: (errorMsg) => {
      showError(errorMsg);
      logger.warn('출석 처리 실패', { error: errorMsg });
    }
  });

  // 성능 최적화 로그
  useEffect(() => {
    logger.info('AttendancePage 최적화 모드', {
      component: 'AttendancePage',
      data: {
        role,
        workLogsCount: workLogs.length,
        attendanceCount: attendanceRecords.length,
        isOptimized: true
      }
    });
  }, [role, workLogs.length, attendanceRecords.length]);

  // QR 스캐너 초기화 (동적 import로 번들 최적화)
  useEffect(() => {
    const initScanner = async () => {
      if (!scannerRef.current && currentUser) {
        // DOM 요소가 렌더링될 때까지 대기
        const readerElement = document.getElementById('qr-reader');
        if (!readerElement) {
          logger.debug('QR reader element not found, waiting...');
          return;
        }

        // html5-qrcode를 동적으로 import
        const { Html5QrcodeScanner } = await import('html5-qrcode');

        scannerRef.current = new Html5QrcodeScanner(
          'qr-reader',
          { fps: 10, qrbox: { width: 250, height: 250 } },
          false
        ) as unknown as Html5QrcodeScanner;

        scannerRef.current.render(
          async (decodedText) => {
            // 이미 처리 중이면 무시
            if (processing) {
              return;
            }

            setScanResult(decodedText);

            // 새로운 QR 출석 시스템으로 처리
            await handleScan(decodedText);

            // 2초 후 스캔 결과 초기화
            setTimeout(() => {
              setScanResult('');
            }, 2000);
          },
          (errorMessage) => {
            // QR 코드 스캔 오류는 무시 (지속적으로 발생)
            logger.debug('QR scan error', { error: errorMessage });
          }
        );

        logger.info('QR 스캐너 초기화 완료');
      }
    };

    // DOM이 준비된 후 실행
    const timeoutId = setTimeout(() => {
      initScanner().catch((err) => {
        logger.error('QR scanner initialization error', err instanceof Error ? err : new Error(String(err)));
      });
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      if (scannerRef.current) {
        scannerRef.current.clear().catch((err) => {
          logger.error('QR scanner cleanup error', err instanceof Error ? err : new Error(String(err)));
        });
      }
    };
  }, [currentUser, processing, handleScan]);

  // 에러 자동 초기화 (5초 후)
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        clearError();
      }, 5000);
      return () => {
        clearTimeout(timer);
      };
    }
    return undefined;
  }, [error, clearError]);

  return (
    <div className="p-6 bg-gray-50 min-h-screen flex flex-col items-center">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">{t('attendancePage.title', 'QR 출석')}</h1>

      {/* 최적화 정보 표시 (개발 모드) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mb-4 p-2 bg-blue-100 rounded-lg text-sm">
          <p>🚀 Smart Hybrid Context 활성화</p>
          <p>📊 데이터: {workLogs.length} 근무, {attendanceRecords.length} 출석</p>
          <p>💰 비용 절감: ~95%</p>
          <p>🔐 새로운 QR 시스템: TOTP 기반</p>
        </div>
      )}

      {/* QR 스캐너 */}
      <div className="w-full max-w-md bg-white p-4 rounded-lg shadow-xl">
        <div id="qr-reader" className="w-full" />
        {scanResult && (
          <p className="mt-4 text-center text-sm text-gray-600">
            {t('attendancePage.lastScanned', 'QR 코드 스캔됨')}
          </p>
        )}
      </div>

      {/* 처리 중 상태 */}
      {processing && (
        <div className="mt-4 flex items-center space-x-2">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
          <p className="text-blue-600">{t('attendancePage.submitting', '처리 중...')}</p>
        </div>
      )}

      {/* 안내 메시지 */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg max-w-md">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-blue-600 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h4 className="text-sm font-medium text-blue-800">
              {t('attendancePage.howToUse', '사용 방법')}
            </h4>
            <div className="mt-2 text-sm text-blue-700">
              <ul className="list-disc list-inside space-y-1">
                <li>{t('attendancePage.guide1', '관리자가 생성한 QR 코드를 스캔하세요.')}</li>
                <li>{t('attendancePage.guide2', '출근과 퇴근은 각각 다른 QR 코드입니다.')}</li>
                <li>{t('attendancePage.guide3', 'QR 코드는 1분마다 자동으로 변경됩니다.')}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AttendancePage;

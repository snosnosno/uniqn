/**
 * 매니저 QR 스캔 모달
 *
 * @version 2.0
 * @since 2025-10-16
 * @author T-HOLDEM Development Team
 *
 * 주요 기능:
 * - 스태프 QR 스캔 (카메라 또는 수동 입력)
 * - 스캔 컨텍스트 설정 (출근/퇴근, 라운드업 간격)
 * - 실시간 스캔 결과 표시
 * - 스캔 이력 표시
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { QRScanContext, StaffQRPayload, QRScanResult } from '../../types/staffQR';
import { validateQRPayload, getOrCreateStaffQR } from '../../services/StaffQRService';
import { handleCheckIn, handleCheckOut } from '../../services/StaffQRAttendanceService';
import { Timestamp } from 'firebase/firestore';
import { getKoreanDate } from '../../utils/dateUtils';
import { logger } from '../../utils/logger';

interface ManagerScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  eventTitle: string;
  managerId: string;
  initialMode?: 'check-in' | 'check-out';
}

/**
 * 매니저 QR 스캔 모달
 */
export const ManagerScannerModal: React.FC<ManagerScannerModalProps> = ({
  isOpen,
  onClose,
  eventId,
  eventTitle,
  managerId,
  initialMode = 'check-in',
}) => {
  const [scanContext, setScanContext] = useState<QRScanContext>({
    eventId,
    eventTitle,
    date: getKoreanDate(),
    mode: initialMode,
    roundUpInterval: 15,
    activatedAt: Timestamp.now(),
    activatedBy: managerId,
  });

  const [scanMode, setScanMode] = useState<'camera' | 'manual'>('camera');
  const [manualInput, setManualInput] = useState('');
  const [scanning, setScanning] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [scanResult, setScanResult] = useState<QRScanResult | null>(null);
  const [scanHistory, setScanHistory] = useState<
    Array<{ staffName: string; time: string; mode: string }>
  >([]);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  /**
   * 모달 열릴 때 스캔 컨텍스트 초기화
   */
  useEffect(() => {
    if (isOpen) {
      setScanContext({
        eventId,
        eventTitle,
        date: getKoreanDate(),
        mode: initialMode,
        roundUpInterval: 15,
        activatedAt: Timestamp.now(),
        activatedBy: managerId,
      });
      setManualInput('');
      setScanResult(null);
      setScanMode('camera');
    }
  }, [isOpen, eventId, eventTitle, managerId, initialMode]);

  /**
   * 카메라 스캔 초기화 및 정리
   */
  useEffect(() => {
    if (!isOpen || scanMode !== 'camera') {
      // 카메라 모드가 아니거나 모달이 닫히면 scanner 정리
      if (scannerRef.current) {
        const currentScanner = scannerRef.current;
        scannerRef.current = null;
        setCameraActive(false);

        currentScanner.clear().catch(() => {
          // 이미 정리 중이거나 정리 완료된 경우 에러 무시
        });
      }
      return;
    }

    // 카메라 모드 활성화
    const scanner = new Html5QrcodeScanner(
      'qr-reader',
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      },
      false
    );

    scanner.render(
      (decodedText) => {
        // 스캔 성공
        logger.info('QR 코드 스캔 성공', { data: { eventId, scanMode: 'camera' } });
        processQRScan(decodedText);

        // 스캔 후 카메라 일시 정지 (자동 재시작)
        const currentScanner = scannerRef.current;
        if (currentScanner) {
          currentScanner
            .clear()
            .then(() => {
              // 0.5초 후 재시작
              setTimeout(() => {
                if (scanMode === 'camera' && isOpen) {
                  const newScanner = new Html5QrcodeScanner(
                    'qr-reader',
                    {
                      fps: 10,
                      qrbox: { width: 250, height: 250 },
                      aspectRatio: 1.0,
                    },
                    false
                  );
                  newScanner.render(
                    (text) => processQRScan(text),
                    () => {
                      // 에러 무시
                    }
                  );
                  scannerRef.current = newScanner;
                }
              }, 500);
            })
            .catch(() => {
              // 에러 무시
            });
        }
      },
      () => {
        // 스캔 실패 (무시)
      }
    );

    scannerRef.current = scanner;
    setCameraActive(true);

    logger.info('카메라 스캔 모드 활성화', { data: { eventId } });

    // Cleanup
    return () => {
      const currentScanner = scannerRef.current;
      if (currentScanner) {
        scannerRef.current = null;
        setCameraActive(false);
        currentScanner.clear().catch(() => {
          // 이미 정리 중이거나 정리 완료된 경우 에러 무시
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, scanMode, eventId]);

  /**
   * QR 스캔 처리
   */
  const processQRScan = useCallback(
    async (qrString: string) => {
      try {
        setScanning(true);
        setScanResult(null);

        logger.info('QR 스캔 시작', {
          data: {
            eventId,
            mode: scanContext.mode,
            managerId,
          },
        });

        // 1. JSON 파싱
        let payload: StaffQRPayload;
        try {
          payload = JSON.parse(qrString) as StaffQRPayload;
        } catch {
          setScanResult({
            success: false,
            message: '유효하지 않은 QR 형식입니다.',
          });
          return;
        }

        // 2. 스태프 QR 메타데이터 가져오기
        const metadata = await getOrCreateStaffQR(payload.staffId, 'Unknown');

        // 3. 페이로드 검증
        const validation = validateQRPayload(payload, metadata);
        if (!validation.isValid) {
          setScanResult({
            success: false,
            message: validation.error || '유효하지 않은 QR 코드입니다.',
          });
          return;
        }

        // 4. 출근/퇴근 처리
        let result: QRScanResult;
        if (scanContext.mode === 'check-in') {
          result = await handleCheckIn(
            scanContext,
            payload.staffId,
            metadata.lastUsedAt ? 'Unknown' : 'Unknown' // staffName은 WorkLog에서 가져옴
          );
        } else {
          result = await handleCheckOut(
            scanContext,
            payload.staffId,
            metadata.lastUsedAt ? 'Unknown' : 'Unknown'
          );
        }

        setScanResult(result);

        // 5. 성공 시 이력 추가
        if (result.success && result.staffName) {
          setScanHistory((prev) => [
            {
              staffName: result.staffName || 'Unknown',
              time: new Date().toLocaleTimeString('ko-KR'),
              mode: scanContext.mode,
            },
            ...prev.slice(0, 9), // 최대 10개 유지
          ]);
        }

        // 6. 입력 필드 초기화
        setManualInput('');
        inputRef.current?.focus();

        logger.info('QR 스캔 완료', {
          data: {
            eventId,
            mode: scanContext.mode,
            success: result.success,
            staffName: result.staffName,
          },
        });
      } catch (error) {
        logger.error('QR 스캔 실패', error as Error, {
          data: {
            eventId,
            mode: scanContext.mode,
          },
        });

        setScanResult({
          success: false,
          message: '스캔 처리 중 오류가 발생했습니다.',
        });
      } finally {
        setScanning(false);
      }
    },
    [eventId, scanContext, managerId]
  );

  /**
   * 수동 입력 처리
   */
  const handleManualSubmit = useCallback(() => {
    if (!manualInput.trim()) return;
    processQRScan(manualInput.trim());
  }, [manualInput, processQRScan]);

  /**
   * Enter 키 처리
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleManualSubmit();
      }
    },
    [handleManualSubmit]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-black dark:bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">QR 출석 체크</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{eventTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* 컨텐츠 */}
        <div className="p-6 space-y-6">
          {/* 스캔 컨텍스트 설정 */}
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                출퇴근 모드
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setScanContext((prev) => ({ ...prev, mode: 'check-in' }))}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    scanContext.mode === 'check-in'
                      ? 'bg-green-600 dark:bg-green-700 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
                  }`}
                >
                  출근
                </button>
                <button
                  onClick={() => setScanContext((prev) => ({ ...prev, mode: 'check-out' }))}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    scanContext.mode === 'check-out'
                      ? 'bg-blue-600 dark:bg-blue-700 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
                  }`}
                >
                  퇴근
                </button>
              </div>
            </div>

            {scanContext.mode === 'check-out' && (
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  라운드업 간격
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setScanContext((prev) => ({ ...prev, roundUpInterval: 15 }))}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      scanContext.roundUpInterval === 15
                        ? 'bg-blue-600 dark:bg-blue-700 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    15분
                  </button>
                  <button
                    onClick={() => setScanContext((prev) => ({ ...prev, roundUpInterval: 30 }))}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      scanContext.roundUpInterval === 30
                        ? 'bg-blue-600 dark:bg-blue-700 text-white'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    30분
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 스캔 모드 선택 */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 block mb-3">
              스캔 방식 선택
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setScanMode('camera')}
                disabled={scanning}
                className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                  scanMode === 'camera'
                    ? 'bg-blue-600 dark:bg-blue-700 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span>📷 카메라 스캔</span>
              </button>
              <button
                onClick={() => setScanMode('manual')}
                disabled={scanning}
                className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                  scanMode === 'manual'
                    ? 'bg-blue-600 dark:bg-blue-700 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                <span>⌨️ 수동 입력</span>
              </button>
            </div>
          </div>

          {/* 카메라 스캔 영역 */}
          {scanMode === 'camera' && (
            <div className="space-y-3">
              <div id="qr-reader" className="w-full rounded-lg overflow-hidden bg-black" />
              {cameraActive && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm text-blue-800 dark:text-blue-300 text-center font-medium">
                    📷 스태프의 QR 코드를 카메라에 비춰주세요
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 text-center mt-1">
                    자동으로 스캔되고 처리됩니다
                  </p>
                </div>
              )}
              {!cameraActive && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <p className="text-sm text-yellow-800 dark:text-yellow-300 text-center font-medium">
                    ⚠️ 카메라를 초기화하는 중입니다...
                  </p>
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 text-center mt-1">
                    카메라 권한을 허용해주세요
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 수동 입력 영역 */}
          {scanMode === 'manual' && (
            <div className="space-y-3">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                QR 코드 수동 입력
              </label>
              <textarea
                ref={inputRef}
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="스태프의 QR 코드를 붙여넣기 하세요..."
                className="w-full h-24 px-4 py-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-mono text-sm"
                disabled={scanning}
              />
              <button
                onClick={handleManualSubmit}
                disabled={!manualInput.trim() || scanning}
                className="w-full px-4 py-3 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors font-medium disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {scanning ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                    <span>처리 중...</span>
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                      />
                    </svg>
                    <span>스캔 처리</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* 스캔 결과 */}
          {scanResult && (
            <div
              className={`p-4 rounded-lg ${
                scanResult.success
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
              }`}
            >
              <div className="flex items-start space-x-3">
                {scanResult.success ? (
                  <svg
                    className="h-6 w-6 text-green-600 dark:text-green-400 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                )}
                <div className="flex-1">
                  <p
                    className={`font-semibold ${
                      scanResult.success
                        ? 'text-green-900 dark:text-green-300'
                        : 'text-red-900 dark:text-red-300'
                    }`}
                  >
                    {scanResult.message}
                  </p>
                  {scanResult.staffName && (
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                      스태프: {scanResult.staffName}
                    </p>
                  )}
                  {scanResult.remainingCooldown && (
                    <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                      남은 쿨다운: {scanResult.remainingCooldown}초
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 스캔 이력 */}
          {scanHistory.length > 0 && (
            <div className="space-y-3">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                최근 스캔 이력
              </label>
              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg divide-y divide-gray-200 dark:divide-gray-700 max-h-64 overflow-y-auto">
                {scanHistory.map((item) => (
                  <div
                    key={`scan-${item.staffName}-${item.time}-${item.mode}`}
                    className="px-4 py-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          item.mode === 'check-in'
                            ? 'bg-green-500 dark:bg-green-400'
                            : 'bg-blue-500 dark:bg-blue-400'
                        }`}
                      />
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {item.staffName}
                      </span>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          item.mode === 'check-in'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        }`}
                      >
                        {item.mode === 'check-in' ? '출근' : '퇴근'}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{item.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 px-6 py-4 rounded-b-2xl">
          <button
            onClick={onClose}
            className="w-full px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManagerScannerModal;

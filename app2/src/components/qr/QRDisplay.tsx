/**
 * QR 코드 디스플레이 컴포넌트
 *
 * @version 1.0
 * @since 2025-01-16
 * @author T-HOLDEM Development Team
 */

import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useQRGenerator } from '../../hooks/useQRGenerator';
import QRCountdownTimer from './QRCountdownTimer';
import { useTranslation } from 'react-i18next';

export interface QRDisplayProps {
  /** 공고(이벤트) ID */
  eventId: string;

  /** 날짜 (YYYY-MM-DD 형식) */
  date: string;

  /** QR 타입 */
  type: 'check-in' | 'check-out';

  /** 라운드업 간격 (퇴근 시 사용) */
  roundUpInterval?: 15 | 30;

  /** 생성자 ID (시드 초기화 시 필요) */
  createdBy?: string | undefined;

  /** QR 크기 (픽셀) */
  size?: number;

  /** 제목 표시 여부 */
  showTitle?: boolean;

  /** 추가 CSS 클래스 */
  className?: string;
}

/**
 * QR 코드 디스플레이 컴포넌트
 *
 * @example
 * ```typescript
 * <QRDisplay
 *   eventId="event-123"
 *   date="2025-01-16"
 *   type="check-in"
 *   roundUpInterval={30}
 *   createdBy="user-456"
 *   size={300}
 *   showTitle={true}
 * />
 * ```
 */
const QRDisplay: React.FC<QRDisplayProps> = ({
  eventId,
  date,
  type,
  roundUpInterval = 30,
  createdBy,
  size = 300,
  showTitle = true,
  className = ''
}) => {
  const { t } = useTranslation();

  const {
    qrData,
    loading,
    error,
    secondsRemaining,
    refresh
  } = useQRGenerator({
    eventId,
    date,
    type,
    roundUpInterval,
    autoRefresh: true,
    createdBy
  });

  // 로딩 상태
  if (loading) {
    return (
      <div className={`flex flex-col items-center justify-center p-6 ${className}`}>
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-primary"></div>
        <p className="mt-4 text-gray-600">{t('qr.loading', 'QR 코드 생성 중...')}</p>
      </div>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center p-6 ${className}`}>
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <svg
              className="w-16 h-16 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-red-600 font-medium mb-2">{t('qr.error', 'QR 코드 생성 실패')}</p>
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <button
            onClick={refresh}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            {t('qr.retry', '다시 시도')}
          </button>
        </div>
      </div>
    );
  }

  // QR 코드 표시
  return (
    <div className={`flex flex-col items-center p-6 ${className}`}>
      {/* 제목 */}
      {showTitle && (
        <div className="mb-4 text-center">
          <h3 className="text-xl font-bold text-gray-800">
            {type === 'check-in'
              ? t('qr.checkInTitle', '출근 QR 코드')
              : t('qr.checkOutTitle', '퇴근 QR 코드')}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {t('qr.scanInstructions', '아래 QR 코드를 스캔하세요')}
          </p>
        </div>
      )}

      {/* QR 코드 */}
      <div className="relative">
        <div className="bg-white p-6 rounded-lg shadow-lg border-2 border-gray-200">
          {qrData && (
            <QRCodeSVG
              value={qrData}
              size={size}
              level="H"
              includeMargin={false}
            />
          )}
        </div>

        {/* 타입 배지 */}
        <div className="absolute -top-3 -right-3">
          <div
            className={`px-3 py-1 rounded-full text-xs font-bold shadow-md ${
              type === 'check-in'
                ? 'bg-green-500 text-white'
                : 'bg-blue-500 text-white'
            }`}
          >
            {type === 'check-in'
              ? t('qr.checkInBadge', '출근')
              : t('qr.checkOutBadge', '퇴근')}
          </div>
        </div>
      </div>

      {/* 카운트다운 타이머 */}
      <div className="mt-6">
        <QRCountdownTimer secondsRemaining={secondsRemaining} />
      </div>

      {/* 안내 메시지 */}
      <div className="mt-4 text-center">
        <p className="text-sm text-gray-600">
          {type === 'check-in'
            ? t('qr.checkInGuide', '출근 시 위 QR 코드를 스캔하세요.')
            : t('qr.checkOutGuide', '퇴근 시 위 QR 코드를 스캔하세요.')}
        </p>
        {type === 'check-out' && roundUpInterval && (
          <p className="text-xs text-gray-500 mt-2">
            {t(
              'qr.roundUpInfo',
              `퇴근 시간은 ${roundUpInterval}분 단위로 조정됩니다.`,
              { interval: roundUpInterval }
            )}
          </p>
        )}
      </div>

      {/* 수동 새로고침 버튼 */}
      <button
        onClick={refresh}
        className="mt-4 px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
      >
        {t('qr.refresh', '수동 새로고침')}
      </button>
    </div>
  );
};

export default React.memo(QRDisplay);

/**
 * QR 코드 카운트다운 타이머 컴포넌트
 *
 * @version 1.0
 * @since 2025-01-16
 * @author T-HOLDEM Development Team
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

export interface QRCountdownTimerProps {
  /** 남은 초 */
  secondsRemaining: number;

  /** 추가 CSS 클래스 */
  className?: string;
}

/**
 * QR 코드 카운트다운 타이머 컴포넌트
 *
 * @example
 * ```typescript
 * <QRCountdownTimer secondsRemaining={45} />
 * ```
 */
const QRCountdownTimer: React.FC<QRCountdownTimerProps> = ({
  secondsRemaining,
  className = ''
}) => {
  const { t } = useTranslation();

  // 진행률 계산 (0-100%)
  const progress = ((60 - secondsRemaining) / 60) * 100;

  // 색상 결정 (남은 시간에 따라)
  const getColor = () => {
    if (secondsRemaining > 40) {
      return 'text-green-600';
    } else if (secondsRemaining > 20) {
      return 'text-yellow-600';
    } else {
      return 'text-red-600';
    }
  };

  const getProgressColor = () => {
    if (secondsRemaining > 40) {
      return 'bg-green-500';
    } else if (secondsRemaining > 20) {
      return 'bg-yellow-500';
    } else {
      return 'bg-red-500';
    }
  };

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* 원형 타이머 */}
      <div className="relative w-24 h-24">
        {/* 배경 원 */}
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="48"
            cy="48"
            r="40"
            stroke="currentColor"
            strokeWidth="6"
            fill="none"
            className="text-gray-200"
          />
          {/* 진행률 원 */}
          <circle
            cx="48"
            cy="48"
            r="40"
            stroke="currentColor"
            strokeWidth="6"
            fill="none"
            strokeDasharray={`${2 * Math.PI * 40}`}
            strokeDashoffset={`${2 * Math.PI * 40 * (1 - progress / 100)}`}
            className={`${getProgressColor()} transition-all duration-1000`}
            strokeLinecap="round"
          />
        </svg>

        {/* 중앙 텍스트 */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className={`text-2xl font-bold ${getColor()}`}>{secondsRemaining}</div>
            <div className="text-xs text-gray-500">{t('qr.seconds', '초')}</div>
          </div>
        </div>
      </div>

      {/* 텍스트 설명 */}
      <div className="mt-2 text-center">
        <p className="text-sm text-gray-600">
          {t('qr.autoRefreshIn', '자동 재생성까지')}
        </p>
      </div>
    </div>
  );
};

export default React.memo(QRCountdownTimer);

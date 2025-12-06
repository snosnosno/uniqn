/**
 * PenaltyWarningBanner - 패널티 경고 배너
 *
 * 활성 경고 패널티가 있는 사용자에게 표시되는 배너
 *
 * @version 1.0
 * @since 2025-01-01
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldExclamationIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { Penalty } from '../../types/penalty';
import { getRemainingTime } from '../../utils/penaltyUtils';

interface PenaltyWarningBannerProps {
  /** 활성 경고 패널티 */
  penalty: Penalty;
  /** 닫기 콜백 (선택) */
  onDismiss?: () => void;
}

const PenaltyWarningBanner: React.FC<PenaltyWarningBannerProps> = ({ penalty, onDismiss }) => {
  const { t } = useTranslation();
  const [isDismissed, setIsDismissed] = useState(false);

  // 이미 닫은 경우 렌더링하지 않음
  if (isDismissed) return null;

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  const remainingTime = getRemainingTime(penalty.endDate, t);

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/30 border-b border-yellow-200 dark:border-yellow-800">
      <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between flex-wrap gap-2">
          {/* 아이콘 및 메시지 */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0">
              <ShieldExclamationIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200 truncate">
                {t('penaltyBanner.title')}
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 truncate">
                {t('penaltyBanner.reason')}: {penalty.reason}
              </p>
            </div>
          </div>

          {/* 남은 시간 및 닫기 버튼 */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {remainingTime && (
              <span className="text-xs font-medium text-yellow-700 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-800/50 px-2 py-1 rounded-full">
                {remainingTime}
              </span>
            )}
            <button
              type="button"
              onClick={handleDismiss}
              className="flex-shrink-0 p-1 rounded-md text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-800/50 transition-colors"
              aria-label={t('penaltyBanner.dismiss')}
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PenaltyWarningBanner;

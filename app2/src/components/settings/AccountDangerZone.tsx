/**
 * 계정 위험 영역 컴포넌트
 *
 * @description
 * 계정 삭제 및 위험한 작업을 수행하는 영역
 * - 계정 삭제 요청
 * - 삭제 요청 취소
 * - 30일 유예 기간 안내
 *
 * @version 1.0.0
 * @since 2025-10-23
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { useAccountDeletion } from '../../hooks/useAccountDeletion';
import { AccountDeletionModal } from './AccountDeletionModal';
import { toast } from '../../utils/toast';
import { logger } from '../../utils/logger';
import { format } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import { Timestamp } from 'firebase/firestore';

/**
 * 계정 위험 영역 컴포넌트
 */
export const AccountDangerZone: React.FC = () => {
  const { t, i18n } = useTranslation();
  const {
    deletionRequest,
    isPending,
    remainingDays,
    scheduledDate,
    cancelDeletion,
  } = useAccountDeletion();

  const [isDeletionModalOpen, setIsDeletionModalOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  /**
   * 삭제 모달 열기
   */
  const handleOpenDeletionModal = () => {
    setIsDeletionModalOpen(true);
  };

  /**
   * 삭제 모달 닫기
   */
  const handleCloseDeletionModal = () => {
    setIsDeletionModalOpen(false);
  };

  /**
   * 삭제 취소
   */
  const handleCancelDeletion = async () => {
    if (!deletionRequest || isCancelling) return;

    try {
      setIsCancelling(true);

      await cancelDeletion(deletionRequest.requestId);

      toast.success(t('settings.account.pending.cancelSuccess'));
      logger.info('계정 삭제 취소 성공', {
        component: 'AccountDangerZone',
      });
    } catch (err) {
      logger.error('계정 삭제 취소 실패', err as Error, {
        component: 'AccountDangerZone',
      });
      toast.error(t('settings.account.pending.cancelFailed'));
    } finally {
      setIsCancelling(false);
    }
  };

  /**
   * 날짜 포맷팅
   */
  const formatDate = (date: Date | Timestamp | null): string => {
    if (!date) return '-';
    const actualDate = date instanceof Timestamp ? date.toDate() : date;
    const locale = i18n.language === 'ko' ? ko : enUS;
    return format(actualDate, 'PPP', { locale });
  };

  return (
    <div className="space-y-6">
      {/* 경고 안내 */}
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-red-900 dark:text-red-300">
            <p className="font-medium mb-1">
              {t('settings.account.dangerZoneWarning')}
            </p>
            <p>{t('settings.account.dangerZoneDescription')}</p>
          </div>
        </div>
      </div>

      {/* 삭제 대기 중 상태 */}
      {isPending && deletionRequest && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-6">
          <div className="flex items-start space-x-3 mb-4">
            <InformationCircleIcon className="h-6 w-6 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-300 mb-1">
                {t('settings.account.deletionPending')}
              </h3>
              <p className="text-sm text-amber-800 dark:text-amber-400">
                {t('settings.account.deletionPendingDescription')}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-t border-amber-200 dark:border-amber-700">
              <span className="text-sm text-amber-900 dark:text-amber-300">
                {t('settings.account.requestedAt')}
              </span>
              <span className="text-sm font-medium text-amber-900 dark:text-amber-300">
                {formatDate(deletionRequest.requestedAt || null)}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-t border-amber-200 dark:border-amber-700">
              <span className="text-sm text-amber-900 dark:text-amber-300">
                {t('settings.account.scheduledDeletionAt')}
              </span>
              <span className="text-sm font-medium text-amber-900 dark:text-amber-300">
                {formatDate(scheduledDate)}
              </span>
            </div>

            <div className="flex items-center justify-between py-2 border-t border-amber-200 dark:border-amber-700">
              <span className="text-sm text-amber-900 dark:text-amber-300">
                {t('settings.account.remainingDays')}
              </span>
              <span className="text-lg font-bold text-amber-900 dark:text-amber-300">
                {remainingDays} {t('common.days')}
              </span>
            </div>
          </div>

          {/* 취소 버튼 */}
          <button
            onClick={handleCancelDeletion}
            disabled={isCancelling}
            className="mt-6 w-full px-4 py-3 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCancelling
              ? t('common.processing')
              : t('settings.account.cancelDeletion')}
          </button>

          <p className="mt-3 text-xs text-amber-700 dark:text-amber-400 text-center">
            {t('settings.account.cancelDeletionNote')}
          </p>
        </div>
      )}

      {/* 계정 삭제 버튼 (대기 중이 아닐 때만 표시) */}
      {!isPending && (
        <div className="border-2 border-red-200 dark:border-red-800 rounded-lg p-6 bg-white dark:bg-gray-800">
          <div className="flex items-start space-x-3 mb-4">
            <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
                {t('settings.account.deleteAccount')}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {t('settings.account.deleteAccountDescription')}
              </p>
            </div>
          </div>

          {/* 삭제 시 영향 안내 */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {t('settings.account.deletionEffects')}
            </h4>
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>{t('settings.account.deletionEffect1')}</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>{t('settings.account.deletionEffect2')}</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>{t('settings.account.deletionEffect3')}</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>{t('settings.account.deletionEffect4')}</span>
              </li>
            </ul>
          </div>

          {/* 유예 기간 안내 */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
            <div className="flex items-start space-x-2">
              <InformationCircleIcon className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900 dark:text-blue-300">
                <p className="font-medium mb-1">
                  {t('settings.account.gracePeriodTitle')}
                </p>
                <p>{t('settings.account.gracePeriodDescription')}</p>
              </div>
            </div>
          </div>

          {/* 삭제 요청 버튼 */}
          <button
            onClick={handleOpenDeletionModal}
            className="w-full px-4 py-3 bg-red-600 dark:bg-red-700 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-800 transition-colors font-semibold"
          >
            {t('settings.account.requestDeletion')}
          </button>

          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400 text-center">
            {t('settings.account.irreversibleAction')}
          </p>
        </div>
      )}

      {/* 계정 삭제 모달 */}
      <AccountDeletionModal
        isOpen={isDeletionModalOpen}
        onClose={handleCloseDeletionModal}
      />
    </div>
  );
};

export default AccountDangerZone;

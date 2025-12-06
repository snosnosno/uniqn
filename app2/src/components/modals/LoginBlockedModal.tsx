/**
 * LoginBlockedModal - 로그인 차단 정보 모달
 *
 * 로그인 차단된 사용자에게 패널티 상세 정보를 표시하는 모달
 *
 * @version 1.0
 * @since 2025-01-01
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldExclamationIcon } from '@heroicons/react/24/outline';
import type { Penalty } from '../../types/penalty';
import Modal from '../ui/Modal';
import { getRemainingTime } from '../../utils/penaltyUtils';

interface LoginBlockedModalProps {
  /** 모달 열림 상태 */
  isOpen: boolean;
  /** 닫기 콜백 */
  onClose: () => void;
  /** 로그인 차단 패널티 정보 */
  penalty: Penalty;
}

const LoginBlockedModal: React.FC<LoginBlockedModalProps> = ({ isOpen, onClose, penalty }) => {
  const { t } = useTranslation();

  const remainingTime = getRemainingTime(penalty.endDate, t);
  const isPermanent = penalty.endDate === null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      closeOnBackdrop={false}
      title={
        <div className="flex items-center gap-2">
          <ShieldExclamationIcon className="h-6 w-6 text-red-500 dark:text-red-400" />
          <span className="text-red-600 dark:text-red-400">
            {t('loginBlockedModal.title', '로그인 차단됨')}
          </span>
        </div>
      }
      footer={
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md transition-colors"
        >
          {t('common.close', '닫기')}
        </button>
      }
    >
      <div className="space-y-4">
        {/* 사유 */}
        <div>
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
            {t('loginBlockedModal.reason', '사유')}
          </h4>
          <p className="text-base text-gray-900 dark:text-gray-100">{penalty.reason}</p>
        </div>

        {/* 상세 사유 (있는 경우만) */}
        {penalty.details && (
          <div>
            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              {t('loginBlockedModal.details', '상세 사유')}
            </h4>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {penalty.details}
            </p>
          </div>
        )}

        {/* 남은 기간 */}
        <div>
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
            {t('loginBlockedModal.remainingTime', '남은 기간')}
          </h4>
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              isPermanent
                ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200'
                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200'
            }`}
          >
            {remainingTime}
          </span>
        </div>

        {/* 관리자 문의 안내 */}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('loginBlockedModal.contactAdmin', '자세한 내용은 관리자에게 문의하세요.')}
          </p>
        </div>
      </div>
    </Modal>
  );
};

export default LoginBlockedModal;

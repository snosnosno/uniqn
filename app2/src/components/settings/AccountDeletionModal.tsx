/**
 * 계정 삭제 확인 모달
 *
 * @description
 * 계정 삭제 요청을 위한 확인 모달
 * - 비밀번호 재확인
 * - 삭제 사유 선택 (선택사항)
 * - 최종 확인 체크박스
 * - 30일 유예 기간 안내
 *
 * @version 1.0.0
 * @since 2025-10-23
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  XMarkIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { useAccountDeletion } from '../../hooks/useAccountDeletion';
import { DeletionReasonCategory } from '../../types/accountDeletion';
import { toast } from '../../utils/toast';
import { logger } from '../../utils/logger';

/**
 * AccountDeletionModal Props
 */
export interface AccountDeletionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 삭제 사유 옵션
 */
const DELETION_REASONS: Array<{
  value: DeletionReasonCategory;
  labelKey: string;
}> = [
  { value: 'not_useful', labelKey: 'settings.account.reason.notUseful' },
  { value: 'privacy_concerns', labelKey: 'settings.account.reason.privacyConcerns' },
  { value: 'switching_service', labelKey: 'settings.account.reason.switchingService' },
  { value: 'too_many_emails', labelKey: 'settings.account.reason.tooManyEmails' },
  { value: 'difficult_to_use', labelKey: 'settings.account.reason.difficultToUse' },
  { value: 'other', labelKey: 'settings.account.reason.other' },
];

/**
 * 계정 삭제 확인 모달 컴포넌트
 */
export const AccountDeletionModal: React.FC<AccountDeletionModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { requestDeletion } = useAccountDeletion();

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [reasonCategory, setReasonCategory] = useState<DeletionReasonCategory | ''>('');
  const [reasonText, setReasonText] = useState('');
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * 유효성 검사
   */
  const isValid = useMemo(() => {
    return password.length > 0 && isConfirmed;
  }, [password, isConfirmed]);

  /**
   * 폼 초기화
   */
  const resetForm = useCallback(() => {
    setPassword('');
    setShowPassword(false);
    setReasonCategory('');
    setReasonText('');
    setIsConfirmed(false);
  }, []);

  /**
   * 모달 닫기
   */
  const handleClose = useCallback(() => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  }, [isSubmitting, resetForm, onClose]);

  /**
   * 제출 핸들러
   */
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!isValid || !currentUser) {
        toast.warning(t('settings.account.invalidDeletionRequest'));
        return;
      }

      try {
        setIsSubmitting(true);

        await requestDeletion({
          password,
          ...(reasonText && { reason: reasonText }),
          ...(reasonCategory && { reasonCategory }),
        });

        toast.success(t('settings.account.deletionRequested'));
        logger.info('계정 삭제 요청 성공', {
          component: 'AccountDeletionModal',
          data: {
            reasonCategory,
          },
        });

        handleClose();

        // 설정 페이지로 이동 (삭제 대기 상태 표시)
        navigate('/app/settings', { state: { tab: 'account' } });
      } catch (err) {
        const error = err as Error;
        logger.error('계정 삭제 요청 실패', error, {
          component: 'AccountDeletionModal',
        });

        // Firebase 에러 메시지 처리
        if (error.message.includes('wrong-password')) {
          toast.error(t('settings.account.wrongPassword'));
        } else if (error.message.includes('too-many-requests')) {
          toast.error(t('settings.account.tooManyRequests'));
        } else {
          toast.error(t('settings.account.deletionRequestFailed'));
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [isValid, currentUser, password, reasonCategory, reasonText, requestDeletion, handleClose, navigate, t]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* 배경 오버레이 */}
        <div
          className="fixed inset-0 bg-black bg-opacity-25 transition-opacity"
          onClick={handleClose}
          aria-hidden="true"
        />

        {/* 모달 콘텐츠 */}
        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-6">
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-500" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {t('settings.account.confirmDeletion')}
              </h2>
            </div>
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label={t('common.close')}
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* 경고 메시지 */}
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-900 dark:text-red-300 font-medium mb-2">
              {t('settings.account.finalWarning')}
            </p>
            <ul className="space-y-1 text-sm text-red-800 dark:text-red-400">
              <li>• {t('settings.account.deletionEffect1')}</li>
              <li>• {t('settings.account.deletionEffect2')}</li>
              <li>• {t('settings.account.deletionEffect3')}</li>
            </ul>
          </div>

          {/* 폼 */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 삭제 사유 (선택사항) */}
            <div>
              <label
                htmlFor="reasonCategory"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                {t('settings.account.deletionReason')}{' '}
                <span className="text-gray-500 dark:text-gray-400 font-normal">
                  ({t('common.optional')})
                </span>
              </label>
              <select
                id="reasonCategory"
                value={reasonCategory}
                onChange={(e) =>
                  setReasonCategory(e.target.value as DeletionReasonCategory | '')
                }
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="">
                  {t('settings.account.selectReason')}
                </option>
                {DELETION_REASONS.map((reason) => (
                  <option key={reason.value} value={reason.value}>
                    {t(reason.labelKey)}
                  </option>
                ))}
              </select>
            </div>

            {/* 추가 설명 (선택사항) */}
            {reasonCategory && (
              <div>
                <label
                  htmlFor="reasonText"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  {t('settings.account.additionalFeedback')}{' '}
                  <span className="text-gray-500 dark:text-gray-400 font-normal">
                    ({t('common.optional')})
                  </span>
                </label>
                <textarea
                  id="reasonText"
                  value={reasonText}
                  onChange={(e) => setReasonText(e.target.value)}
                  disabled={isSubmitting}
                  rows={3}
                  maxLength={500}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  placeholder={t('settings.account.feedbackPlaceholder')}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {reasonText.length}/500
                </p>
              </div>
            )}

            {/* 비밀번호 확인 */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                {t('settings.account.confirmPassword')}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 pr-10 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                  aria-label={showPassword ? t('common.hide') : t('common.show')}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t('settings.account.confirmPasswordDescription')}
              </p>
            </div>

            {/* 유예 기간 안내 */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-900 dark:text-blue-300">
                <span className="font-medium">
                  {t('settings.account.gracePeriodNote')}
                </span>
                <br />
                {t('settings.account.gracePeriodNoteDescription')}
              </p>
            </div>

            {/* 최종 확인 체크박스 */}
            <div className="border-t dark:border-gray-700 pt-4">
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isConfirmed}
                  onChange={(e) => setIsConfirmed(e.target.checked)}
                  disabled={isSubmitting}
                  className="h-5 w-5 text-red-600 border-gray-300 dark:border-gray-600 rounded focus:ring-red-500 mt-0.5"
                  required
                />
                <span className="text-sm text-gray-900 dark:text-gray-100">
                  {t('settings.account.confirmCheckbox')}
                </span>
              </label>
            </div>

            {/* 버튼 */}
            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={!isValid || isSubmitting}
                className="flex-1 px-4 py-2 bg-red-600 dark:bg-red-700 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              >
                {isSubmitting
                  ? t('common.processing')
                  : t('settings.account.confirmDeletion')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AccountDeletionModal;

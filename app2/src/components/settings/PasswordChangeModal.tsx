/**
 * 비밀번호 변경 모달
 *
 * @description
 * 비밀번호 변경을 위한 모달 컴포넌트
 * - 현재 비밀번호 확인
 * - 새 비밀번호 입력 및 확인
 * - 비밀번호 강도 검증
 * - 실시간 유효성 검사
 *
 * @version 1.0.0
 * @since 2025-10-23
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { XMarkIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useSecuritySettings } from '../../hooks/useSecuritySettings';
import { toast } from '../../utils/toast';
import { logger } from '../../utils/logger';

/**
 * PasswordChangeModal Props
 */
export interface PasswordChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 비밀번호 강도 계산 (대소문자 요구사항 제거)
 */
const calculatePasswordStrength = (password: string): number => {
  let strength = 0;

  if (password.length >= 8) strength += 35;
  if (password.length >= 12) strength += 25;
  if (/\d/.test(password)) strength += 20;
  if (/[@$!%*?&]/.test(password)) strength += 20;

  return Math.min(strength, 100);
};

/**
 * 비밀번호 변경 모달 컴포넌트
 */
export const PasswordChangeModal: React.FC<PasswordChangeModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const { changePassword } = useSecuritySettings();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * 비밀번호 강도
   */
  const passwordStrength = useMemo(() => {
    return calculatePasswordStrength(newPassword);
  }, [newPassword]);

  /**
   * 비밀번호 강도 레벨
   */
  const strengthLevel = useMemo(() => {
    if (passwordStrength < 40) return 'weak';
    if (passwordStrength < 70) return 'medium';
    return 'strong';
  }, [passwordStrength]);

  /**
   * 비밀번호 강도 색상
   */
  const strengthColor = useMemo(() => {
    if (strengthLevel === 'weak') return 'bg-red-500 dark:bg-red-600';
    if (strengthLevel === 'medium') return 'bg-yellow-500 dark:bg-yellow-600';
    return 'bg-green-500 dark:bg-green-600';
  }, [strengthLevel]);

  /**
   * 비밀번호 강도 텍스트
   */
  const strengthText = useMemo(() => {
    if (strengthLevel === 'weak') return t('settings.security.passwordWeak');
    if (strengthLevel === 'medium') return t('settings.security.passwordMedium');
    return t('settings.security.passwordStrong');
  }, [strengthLevel, t]);

  /**
   * 유효성 검사
   */
  const isValid = useMemo(() => {
    return (
      currentPassword.length > 0 &&
      newPassword.length >= 8 &&
      newPassword === confirmPassword &&
      newPassword !== currentPassword
    );
  }, [currentPassword, newPassword, confirmPassword]);

  /**
   * 폼 초기화
   */
  const resetForm = useCallback(() => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
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

      if (!isValid) {
        toast.warning(t('settings.security.invalidPassword'));
        return;
      }

      try {
        setIsSubmitting(true);

        await changePassword({
          currentPassword,
          newPassword,
        });

        toast.success(t('settings.security.passwordChanged'));
        logger.info('비밀번호 변경 성공', {
          component: 'PasswordChangeModal',
        });

        handleClose();
      } catch (err) {
        const error = err as Error;
        logger.error('비밀번호 변경 실패', error, {
          component: 'PasswordChangeModal',
        });

        // Firebase 에러 메시지 처리
        if (error.message.includes('wrong-password')) {
          toast.error(t('settings.security.wrongPassword'));
        } else if (error.message.includes('weak-password')) {
          toast.error(t('settings.security.weakPassword'));
        } else {
          toast.error(t('settings.security.passwordChangeFailed'));
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [isValid, currentPassword, newPassword, changePassword, handleClose, t]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* 배경 오버레이 */}
        <div
          className="fixed inset-0 bg-black bg-opacity-25 dark:bg-opacity-40 transition-opacity"
          onClick={handleClose}
          aria-hidden="true"
        />

        {/* 모달 콘텐츠 */}
        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {t('settings.security.changePassword')}
            </h2>
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label={t('common.close')}
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* 폼 */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 현재 비밀번호 */}
            <div>
              <label
                htmlFor="currentPassword"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                {t('settings.security.currentPassword')}
              </label>
              <div className="relative">
                <input
                  id="currentPassword"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 pr-10 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                  aria-label={showCurrentPassword ? t('common.hide') : t('common.show')}
                >
                  {showCurrentPassword ? (
                    <EyeSlashIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* 새 비밀번호 */}
            <div>
              <label
                htmlFor="newPassword"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                {t('settings.security.newPassword')}
              </label>
              <div className="relative">
                <input
                  id="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 pr-10 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                  aria-label={showNewPassword ? t('common.hide') : t('common.show')}
                >
                  {showNewPassword ? (
                    <EyeSlashIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>

              {/* 비밀번호 강도 표시 */}
              {newPassword.length > 0 && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-600 dark:text-gray-400 dark:text-gray-500">
                      {t('settings.security.passwordStrength')}
                    </span>
                    <span className="text-xs font-medium text-gray-900 dark:text-gray-100">{strengthText}</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${strengthColor}`}
                      style={{ width: `${passwordStrength}%` }}
                    />
                  </div>
                </div>
              )}

              {/* 비밀번호 요구사항 */}
              <ul className="mt-2 text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <li className={newPassword.length >= 8 ? 'text-green-600 dark:text-green-400 font-medium' : ''}>
                  {newPassword.length >= 8 ? '✓' : '•'} 최소 8자 이상
                </li>
                <li className={/\d/.test(newPassword) ? 'text-green-600 dark:text-green-400 font-medium' : ''}>
                  {/\d/.test(newPassword) ? '✓' : '•'} 숫자 포함 (0-9)
                </li>
                <li
                  className={
                    /[@$!%*?&]/.test(newPassword) ? 'text-green-600 dark:text-green-400 font-medium' : ''
                  }
                >
                  {/[@$!%*?&]/.test(newPassword) ? '✓' : '•'} 특수문자 포함 (@$!%*?&)
                </li>
              </ul>
            </div>

            {/* 비밀번호 확인 */}
            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                {t('settings.security.confirmPassword')}
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 pr-10 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                  aria-label={showConfirmPassword ? t('common.hide') : t('common.show')}
                >
                  {showConfirmPassword ? (
                    <EyeSlashIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>

              {/* 비밀번호 불일치 경고 */}
              {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {t('settings.security.passwordMismatch')}
                </p>
              )}

              {/* 현재 비밀번호와 동일 경고 */}
              {newPassword.length > 0 &&
                currentPassword.length > 0 &&
                newPassword === currentPassword && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                    {t('settings.security.passwordSameAsCurrent')}
                  </p>
                )}
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
                className="flex-1 px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? t('common.processing') : t('common.save')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PasswordChangeModal;

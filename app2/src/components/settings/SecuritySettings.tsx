/**
 * 보안 설정 컴포넌트
 *
 * @description
 * 계정 보안 설정 관리 UI
 * - 비밀번호 변경
 * - 로그인 알림 설정
 * - 최근 로그인 기록
 *
 * @version 1.0.0
 * @since 2025-10-23
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyIcon,
  BellIcon,
  ClockIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { useSecuritySettings } from '../../hooks/useSecuritySettings';
import { PasswordChangeModal } from './PasswordChangeModal';
import { toast } from '../../utils/toast';
import { logger } from '../../utils/logger';

/**
 * 보안 설정 컴포넌트
 */
export const SecuritySettings: React.FC = () => {
  const { t } = useTranslation();
  const {
    loginNotificationSettings,
    loading,
    error,
    updateLoginNotifications,
  } = useSecuritySettings();

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  /**
   * 비밀번호 변경 모달 열기
   */
  const handleOpenPasswordModal = () => {
    setIsPasswordModalOpen(true);
  };

  /**
   * 비밀번호 변경 모달 닫기
   */
  const handleClosePasswordModal = () => {
    setIsPasswordModalOpen(false);
  };

  /**
   * 로그인 알림 활성화 토글
   */
  const handleToggleEnabled = async () => {
    if (isUpdating || !loginNotificationSettings) return;

    try {
      setIsUpdating(true);
      const newValue = !loginNotificationSettings.enabled;

      await updateLoginNotifications({
        enabled: newValue,
      });

      toast.success(
        newValue
          ? t('settings.security.loginNotificationEnabled')
          : t('settings.security.loginNotificationDisabled')
      );

      logger.info('로그인 알림 활성화 변경', {
        component: 'SecuritySettings',
        data: { enabled: newValue },
      });
    } catch (err) {
      logger.error('로그인 알림 설정 변경 실패', err as Error, {
        component: 'SecuritySettings',
      });
      toast.error(t('settings.security.updateFailed'));
    } finally {
      setIsUpdating(false);
    }
  };

  /**
   * 새 기기 알림 토글
   */
  const handleToggleNewDevice = async () => {
    if (isUpdating || !loginNotificationSettings) return;

    try {
      setIsUpdating(true);
      const newValue = !loginNotificationSettings.notifyOnNewDevice;

      await updateLoginNotifications({
        notifyOnNewDevice: newValue,
      });

      toast.success(
        t('settings.security.newDeviceNotificationUpdated')
      );

      logger.info('새 기기 알림 변경', {
        component: 'SecuritySettings',
        data: { notifyOnNewDevice: newValue },
      });
    } catch (err) {
      logger.error('새 기기 알림 설정 변경 실패', err as Error, {
        component: 'SecuritySettings',
      });
      toast.error(t('settings.security.updateFailed'));
    } finally {
      setIsUpdating(false);
    }
  };

  /**
   * 새 위치 알림 토글
   */
  const handleToggleNewLocation = async () => {
    if (isUpdating || !loginNotificationSettings) return;

    try {
      setIsUpdating(true);
      const newValue = !loginNotificationSettings.notifyOnNewLocation;

      await updateLoginNotifications({
        notifyOnNewLocation: newValue,
      });

      toast.success(
        t('settings.security.newLocationNotificationUpdated')
      );

      logger.info('새 위치 알림 변경', {
        component: 'SecuritySettings',
        data: { notifyOnNewLocation: newValue },
      });
    } catch (err) {
      logger.error('새 위치 알림 설정 변경 실패', err as Error, {
        component: 'SecuritySettings',
      });
      toast.error(t('settings.security.updateFailed'));
    } finally {
      setIsUpdating(false);
    }
  };

  /**
   * 의심스러운 활동 알림 토글
   */
  const handleToggleSuspiciousActivity = async () => {
    if (isUpdating || !loginNotificationSettings) return;

    try {
      setIsUpdating(true);
      const newValue = !loginNotificationSettings.notifyOnSuspiciousActivity;

      await updateLoginNotifications({
        notifyOnSuspiciousActivity: newValue,
      });

      toast.success(
        t('settings.security.suspiciousActivityNotificationUpdated')
      );

      logger.info('의심스러운 활동 알림 변경', {
        component: 'SecuritySettings',
        data: { notifyOnSuspiciousActivity: newValue },
      });
    } catch (err) {
      logger.error('의심스러운 활동 알림 설정 변경 실패', err as Error, {
        component: 'SecuritySettings',
      });
      toast.error(t('settings.security.updateFailed'));
    } finally {
      setIsUpdating(false);
    }
  };

  /**
   * 로딩 중
   */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  /**
   * 에러 상태
   */
  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">{t('settings.security.loadFailed')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 비밀번호 변경 */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-gray-900 flex items-center">
          <KeyIcon className="h-5 w-5 mr-2" />
          {t('settings.security.password')}
        </h3>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-4">
            {t('settings.security.passwordDescription')}
          </p>
          <button
            onClick={handleOpenPasswordModal}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t('settings.security.changePassword')}
          </button>
        </div>
      </div>

      {/* 로그인 알림 설정 */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-gray-900 flex items-center">
          <BellIcon className="h-5 w-5 mr-2" />
          {t('settings.security.loginNotifications')}
        </h3>
        <div className="space-y-4">
          {/* 알림 활성화 */}
          <div className="border rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 mb-1">
                  {t('settings.security.enableNotifications')}
                </h4>
                <p className="text-sm text-gray-600">
                  {t('settings.security.enableNotificationsDescription')}
                </p>
              </div>
              <button
                onClick={handleToggleEnabled}
                disabled={isUpdating}
                className={`
                  relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer
                  rounded-full border-2 border-transparent transition-colors
                  duration-200 ease-in-out focus:outline-none focus:ring-2
                  focus:ring-blue-500 focus:ring-offset-2
                  ${loginNotificationSettings?.enabled ? 'bg-blue-600' : 'bg-gray-200'}
                  ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                role="switch"
                aria-checked={loginNotificationSettings?.enabled ?? false}
              >
                <span
                  className={`
                    pointer-events-none inline-block h-5 w-5 transform
                    rounded-full bg-white shadow ring-0 transition duration-200
                    ease-in-out
                    ${loginNotificationSettings?.enabled ? 'translate-x-5' : 'translate-x-0'}
                  `}
                />
              </button>
            </div>
          </div>

          {/* 세부 알림 설정 (활성화된 경우에만 표시) */}
          {loginNotificationSettings?.enabled && (
            <>
              {/* 새 기기 알림 */}
              <div className="border rounded-lg p-4 ml-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 mb-1">
                      {t('settings.security.newDeviceNotification')}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {t('settings.security.newDeviceNotificationDescription')}
                    </p>
                  </div>
                  <button
                    onClick={handleToggleNewDevice}
                    disabled={isUpdating}
                    className={`
                      relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer
                      rounded-full border-2 border-transparent transition-colors
                      duration-200 ease-in-out focus:outline-none focus:ring-2
                      focus:ring-blue-500 focus:ring-offset-2
                      ${loginNotificationSettings?.notifyOnNewDevice ? 'bg-blue-600' : 'bg-gray-200'}
                      ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                    role="switch"
                    aria-checked={loginNotificationSettings?.notifyOnNewDevice ?? false}
                  >
                    <span
                      className={`
                        pointer-events-none inline-block h-5 w-5 transform
                        rounded-full bg-white shadow ring-0 transition duration-200
                        ease-in-out
                        ${loginNotificationSettings?.notifyOnNewDevice ? 'translate-x-5' : 'translate-x-0'}
                      `}
                    />
                  </button>
                </div>
              </div>

              {/* 새 위치 알림 */}
              <div className="border rounded-lg p-4 ml-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 mb-1">
                      {t('settings.security.newLocationNotification')}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {t('settings.security.newLocationNotificationDescription')}
                    </p>
                  </div>
                  <button
                    onClick={handleToggleNewLocation}
                    disabled={isUpdating}
                    className={`
                      relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer
                      rounded-full border-2 border-transparent transition-colors
                      duration-200 ease-in-out focus:outline-none focus:ring-2
                      focus:ring-blue-500 focus:ring-offset-2
                      ${loginNotificationSettings?.notifyOnNewLocation ? 'bg-blue-600' : 'bg-gray-200'}
                      ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                    role="switch"
                    aria-checked={loginNotificationSettings?.notifyOnNewLocation ?? false}
                  >
                    <span
                      className={`
                        pointer-events-none inline-block h-5 w-5 transform
                        rounded-full bg-white shadow ring-0 transition duration-200
                        ease-in-out
                        ${loginNotificationSettings?.notifyOnNewLocation ? 'translate-x-5' : 'translate-x-0'}
                      `}
                    />
                  </button>
                </div>
              </div>

              {/* 의심스러운 활동 알림 */}
              <div className="border rounded-lg p-4 ml-4 bg-amber-50 border-amber-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 mb-1">
                      {t('settings.security.suspiciousActivityNotification')}
                    </h4>
                    <p className="text-sm text-gray-600">
                      {t('settings.security.suspiciousActivityNotificationDescription')}
                    </p>
                    <p className="text-xs text-amber-700 mt-2">
                      {t('settings.security.recommendedSetting')}
                    </p>
                  </div>
                  <button
                    onClick={handleToggleSuspiciousActivity}
                    disabled={isUpdating}
                    className={`
                      relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer
                      rounded-full border-2 border-transparent transition-colors
                      duration-200 ease-in-out focus:outline-none focus:ring-2
                      focus:ring-blue-500 focus:ring-offset-2
                      ${loginNotificationSettings?.notifyOnSuspiciousActivity ? 'bg-blue-600' : 'bg-gray-200'}
                      ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                    role="switch"
                    aria-checked={loginNotificationSettings?.notifyOnSuspiciousActivity ?? false}
                  >
                    <span
                      className={`
                        pointer-events-none inline-block h-5 w-5 transform
                        rounded-full bg-white shadow ring-0 transition duration-200
                        ease-in-out
                        ${loginNotificationSettings?.notifyOnSuspiciousActivity ? 'translate-x-5' : 'translate-x-0'}
                      `}
                    />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 안내 메시지 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <InformationCircleIcon className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-medium mb-1">
              {t('settings.security.infoTitle')}
            </p>
            <p>{t('settings.security.infoMessage')}</p>
          </div>
        </div>
      </div>

      {/* 비밀번호 변경 모달 */}
      <PasswordChangeModal
        isOpen={isPasswordModalOpen}
        onClose={handleClosePasswordModal}
      />
    </div>
  );
};

export default SecuritySettings;

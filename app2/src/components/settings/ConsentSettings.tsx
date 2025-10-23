/**
 * 동의 설정 컴포넌트
 *
 * @description
 * 설정 페이지에서 사용하는 동의 관리 UI (선택 동의만 변경 가능)
 * - 필수 동의: 이용약관, 개인정보처리방침 (읽기 전용)
 * - 선택 동의: 마케팅, 위치 서비스, 푸시 알림 (변경 가능)
 * - 실시간 동기화
 * - 변경 이력 추적
 *
 * @version 1.0.0
 * @since 2025-10-23
 */

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckCircleIcon,
  XCircleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { useConsent } from '../../hooks/useConsent';
import { toast } from '../../utils/toast';
import { logger } from '../../utils/logger';
import { format } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import { Timestamp } from 'firebase/firestore';

/**
 * 동의 설정 컴포넌트
 */
export const ConsentSettings: React.FC = () => {
  const { t, i18n } = useTranslation();
  const {
    consent,
    loading,
    error,
    hasRequiredConsents,
    isMarketingAgreed,
    isLocationServiceAgreed,
    isPushNotificationAgreed,
    updateMarketing,
    updateLocationService,
    updatePushNotification,
  } = useConsent();

  const [isUpdating, setIsUpdating] = useState(false);

  /**
   * 마케팅 동의 토글
   */
  const handleToggleMarketing = useCallback(async () => {
    if (isUpdating) return;

    try {
      setIsUpdating(true);
      const newValue = !isMarketingAgreed;
      await updateMarketing(newValue);

      toast.success(
        newValue
          ? t('settings.consent.marketingEnabled')
          : t('settings.consent.marketingDisabled')
      );

      logger.info('마케팅 동의 변경', {
        component: 'ConsentSettings',
        data: { agreed: newValue },
      });
    } catch (err) {
      logger.error('마케팅 동의 변경 실패', err as Error, {
        component: 'ConsentSettings',
      });
      toast.error(t('settings.consent.updateFailed'));
    } finally {
      setIsUpdating(false);
    }
  }, [isMarketingAgreed, isUpdating, updateMarketing, t]);

  /**
   * 위치 서비스 동의 토글
   */
  const handleToggleLocationService = useCallback(async () => {
    if (isUpdating) return;

    try {
      setIsUpdating(true);
      const newValue = !isLocationServiceAgreed;
      await updateLocationService(newValue);

      toast.success(
        newValue
          ? t('settings.consent.locationServiceEnabled')
          : t('settings.consent.locationServiceDisabled')
      );

      logger.info('위치 서비스 동의 변경', {
        component: 'ConsentSettings',
        data: { agreed: newValue },
      });
    } catch (err) {
      logger.error('위치 서비스 동의 변경 실패', err as Error, {
        component: 'ConsentSettings',
      });
      toast.error(t('settings.consent.updateFailed'));
    } finally {
      setIsUpdating(false);
    }
  }, [isLocationServiceAgreed, isUpdating, updateLocationService, t]);

  /**
   * 푸시 알림 동의 토글
   */
  const handleTogglePushNotification = useCallback(async () => {
    if (isUpdating) return;

    try {
      setIsUpdating(true);
      const newValue = !isPushNotificationAgreed;
      await updatePushNotification(newValue);

      toast.success(
        newValue
          ? t('settings.consent.pushNotificationEnabled')
          : t('settings.consent.pushNotificationDisabled')
      );

      logger.info('푸시 알림 동의 변경', {
        component: 'ConsentSettings',
        data: { agreed: newValue },
      });
    } catch (err) {
      logger.error('푸시 알림 동의 변경 실패', err as Error, {
        component: 'ConsentSettings',
      });
      toast.error(t('settings.consent.updateFailed'));
    } finally {
      setIsUpdating(false);
    }
  }, [isPushNotificationAgreed, isUpdating, updatePushNotification, t]);

  /**
   * 날짜 포맷팅
   */
  const formatDate = (date: Date | Timestamp | undefined): string => {
    if (!date) return '-';
    const actualDate = date instanceof Timestamp ? date.toDate() : date;
    const locale = i18n.language === 'ko' ? ko : enUS;
    return format(actualDate, 'PPp', { locale });
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
        <XCircleIcon className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-gray-700">{t('settings.consent.loadFailed')}</p>
      </div>
    );
  }

  /**
   * 동의 정보 없음
   */
  if (!consent) {
    return (
      <div className="text-center py-12">
        <InformationCircleIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-700">{t('settings.consent.noConsent')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 필수 동의 (읽기 전용) */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-gray-900">
          {t('settings.consent.required')}
        </h3>
        <div className="space-y-4">
          {/* 이용약관 */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <CheckCircleIcon className="h-5 w-5 text-green-500" />
                  <span className="font-medium text-gray-900">
                    {t('consent.termsOfService')}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-600">
                  {t('settings.consent.agreedAt')}:{' '}
                  {formatDate(consent.termsOfService.agreedAt)}
                </p>
                <p className="text-sm text-gray-500">
                  {t('settings.consent.version')}: {consent.termsOfService.version}
                </p>
              </div>
            </div>
          </div>

          {/* 개인정보처리방침 */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <CheckCircleIcon className="h-5 w-5 text-green-500" />
                  <span className="font-medium text-gray-900">
                    {t('consent.privacyPolicy')}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-600">
                  {t('settings.consent.agreedAt')}:{' '}
                  {formatDate(consent.privacyPolicy.agreedAt)}
                </p>
                <p className="text-sm text-gray-500">
                  {t('settings.consent.version')}: {consent.privacyPolicy.version}
                </p>
              </div>
            </div>
          </div>
        </div>
        <p className="mt-3 text-sm text-gray-500">
          {t('settings.consent.requiredNote')}
        </p>
      </div>

      {/* 선택 동의 (변경 가능) */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-gray-900">
          {t('settings.consent.optional')}
        </h3>
        <div className="space-y-4">
          {/* 마케팅 수신 동의 */}
          <div className="border rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 mb-1">
                  {t('consent.marketing')}
                </h4>
                <p className="text-sm text-gray-600 mb-3">
                  {t('consent.marketingDescription')}
                </p>
                {isMarketingAgreed && consent.marketing && (
                  <p className="text-xs text-gray-500">
                    {t('settings.consent.agreedAt')}:{' '}
                    {formatDate(consent.marketing.agreedAt)}
                  </p>
                )}
              </div>
              <button
                onClick={handleToggleMarketing}
                disabled={isUpdating}
                className={`
                  relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer
                  rounded-full border-2 border-transparent transition-colors
                  duration-200 ease-in-out focus:outline-none focus:ring-2
                  focus:ring-blue-500 focus:ring-offset-2
                  ${isMarketingAgreed ? 'bg-blue-600' : 'bg-gray-200'}
                  ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                role="switch"
                aria-checked={isMarketingAgreed}
                aria-label={t('consent.marketing')}
              >
                <span
                  className={`
                    pointer-events-none inline-block h-5 w-5 transform
                    rounded-full bg-white shadow ring-0 transition duration-200
                    ease-in-out
                    ${isMarketingAgreed ? 'translate-x-5' : 'translate-x-0'}
                  `}
                />
              </button>
            </div>
          </div>

          {/* 위치 서비스 동의 */}
          <div className="border rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 mb-1">
                  {t('consent.locationService')}
                </h4>
                <p className="text-sm text-gray-600 mb-3">
                  {t('consent.locationServiceDescription')}
                </p>
                {isLocationServiceAgreed && consent.locationService && (
                  <p className="text-xs text-gray-500">
                    {t('settings.consent.agreedAt')}:{' '}
                    {formatDate(consent.locationService.agreedAt)}
                  </p>
                )}
              </div>
              <button
                onClick={handleToggleLocationService}
                disabled={isUpdating}
                className={`
                  relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer
                  rounded-full border-2 border-transparent transition-colors
                  duration-200 ease-in-out focus:outline-none focus:ring-2
                  focus:ring-blue-500 focus:ring-offset-2
                  ${isLocationServiceAgreed ? 'bg-blue-600' : 'bg-gray-200'}
                  ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                role="switch"
                aria-checked={isLocationServiceAgreed}
                aria-label={t('consent.locationService')}
              >
                <span
                  className={`
                    pointer-events-none inline-block h-5 w-5 transform
                    rounded-full bg-white shadow ring-0 transition duration-200
                    ease-in-out
                    ${isLocationServiceAgreed ? 'translate-x-5' : 'translate-x-0'}
                  `}
                />
              </button>
            </div>
          </div>

          {/* 푸시 알림 동의 */}
          <div className="border rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 mb-1">
                  {t('consent.pushNotification')}
                </h4>
                <p className="text-sm text-gray-600 mb-3">
                  {t('consent.pushNotificationDescription')}
                </p>
                {isPushNotificationAgreed && consent.pushNotification && (
                  <p className="text-xs text-gray-500">
                    {t('settings.consent.agreedAt')}:{' '}
                    {formatDate(consent.pushNotification.agreedAt)}
                  </p>
                )}
              </div>
              <button
                onClick={handleTogglePushNotification}
                disabled={isUpdating}
                className={`
                  relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer
                  rounded-full border-2 border-transparent transition-colors
                  duration-200 ease-in-out focus:outline-none focus:ring-2
                  focus:ring-blue-500 focus:ring-offset-2
                  ${isPushNotificationAgreed ? 'bg-blue-600' : 'bg-gray-200'}
                  ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                role="switch"
                aria-checked={isPushNotificationAgreed}
                aria-label={t('consent.pushNotification')}
              >
                <span
                  className={`
                    pointer-events-none inline-block h-5 w-5 transform
                    rounded-full bg-white shadow ring-0 transition duration-200
                    ease-in-out
                    ${isPushNotificationAgreed ? 'translate-x-5' : 'translate-x-0'}
                  `}
                />
              </button>
            </div>
          </div>
        </div>
        <p className="mt-3 text-sm text-gray-500">
          {t('settings.consent.optionalNote')}
        </p>
      </div>

      {/* 안내 메시지 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <InformationCircleIcon className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-medium mb-1">
              {t('settings.consent.infoTitle')}
            </p>
            <p>{t('settings.consent.infoMessage')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConsentSettings;

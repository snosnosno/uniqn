/**
 * 동의 관리 컴포넌트
 *
 * @description
 * 회원가입 및 설정 페이지에서 사용하는 동의 관리 UI
 * - 필수 동의: 이용약관, 개인정보처리방침
 * - 선택 동의: 마케팅, 위치 서비스, 푸시 알림
 * - WCAG 2.1 AA 접근성 준수
 * - i18n 지원 (한국어/영어)
 *
 * @version 1.0.0
 * @since 2025-10-23
 */

import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { ConsentCreateInput } from '../../types/consent';
import { toast } from '../../utils/toast';
import { logger } from '../../utils/logger';
import LegalDocumentModal, { LegalDocumentType } from '../legal/LegalDocumentModal';

/**
 * ConsentManager Props
 */
export interface ConsentManagerProps {
  /**
   * 회원가입 모드 여부
   * - true: 회원가입 시 사용 (모든 동의 표시)
   * - false: 설정 페이지에서 사용 (선택 동의만 표시)
   */
  isSignupMode?: boolean;

  /**
   * 현재 동의 상태 (설정 페이지용)
   */
  currentConsents?: {
    termsOfService?: boolean;
    privacyPolicy?: boolean;
    marketing?: boolean;
    locationService?: boolean;
    pushNotification?: boolean;
  };

  /**
   * 동의 변경 시 콜백
   */
  onChange?: (consents: ConsentCreateInput) => void;

  /**
   * 동의 제출 시 콜백 (회원가입 모드)
   */
  onSubmit?: (consents: ConsentCreateInput) => void | Promise<void>;

  /**
   * 제출 버튼 텍스트 (기본값: "다음")
   */
  submitButtonText?: string;

  /**
   * 약관 버전 (기본값: "1.0.0")
   */
  termsVersion?: string;

  /**
   * 개인정보처리방침 버전 (기본값: "1.0.0")
   */
  privacyVersion?: string;
}

/**
 * 동의 관리 컴포넌트
 */
export const ConsentManager: React.FC<ConsentManagerProps> = ({
  isSignupMode = true,
  currentConsents,
  onChange,
  onSubmit,
  submitButtonText,
  termsVersion = '1.0.0',
  privacyVersion = '1.0.0',
}) => {
  const { t } = useTranslation();

  // 법적 문서 모달 상태
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalModalType, setLegalModalType] = useState<LegalDocumentType>('terms');

  // 동의 상태
  const [consents, setConsents] = useState<ConsentCreateInput>(() => {
    const now = new Date();
    return {
      userId: '', // 회원가입 시 userId는 나중에 설정됨
      termsOfService: {
        agreed: (currentConsents?.termsOfService ?? false) as true,
        agreedAt: now,
        version: termsVersion,
      },
      privacyPolicy: {
        agreed: (currentConsents?.privacyPolicy ?? false) as true,
        agreedAt: now,
        version: privacyVersion,
      },
      ...(currentConsents?.marketing !== undefined ? {
        marketing: {
          agreed: currentConsents.marketing,
          ...(currentConsents.marketing && { agreedAt: now }),
        },
      } : {}),
      ...(currentConsents?.locationService !== undefined ? {
        locationService: {
          agreed: currentConsents.locationService,
          ...(currentConsents.locationService && { agreedAt: now }),
        },
      } : {}),
      ...(currentConsents?.pushNotification !== undefined ? {
        pushNotification: {
          agreed: currentConsents.pushNotification,
          ...(currentConsents.pushNotification && { agreedAt: now }),
        },
      } : {}),
    };
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * 필수 동의 완료 여부
   */
  const hasRequiredConsents = useMemo(() => {
    return consents.termsOfService.agreed && consents.privacyPolicy.agreed;
  }, [consents.termsOfService.agreed, consents.privacyPolicy.agreed]);

  /**
   * 전체 동의 체크박스 상태
   */
  const isAllAgreed = useMemo(() => {
    return (
      consents.termsOfService.agreed &&
      consents.privacyPolicy.agreed &&
      (consents.marketing?.agreed ?? false) &&
      (consents.locationService?.agreed ?? false) &&
      (consents.pushNotification?.agreed ?? false)
    );
  }, [consents]);

  /**
   * 동의 항목 변경 핸들러
   */
  const handleConsentChange = useCallback(
    (
      field: keyof Omit<ConsentCreateInput, 'userId'>,
      agreed: boolean
    ) => {
      const updatedConsents: ConsentCreateInput = {
        ...consents,
        [field]: {
          agreed: field === 'termsOfService' || field === 'privacyPolicy' ? (agreed as true) : agreed,
          agreedAt: agreed ? new Date() : undefined,
          version:
            field === 'termsOfService'
              ? termsVersion
              : field === 'privacyPolicy'
              ? privacyVersion
              : undefined,
        },
      };

      setConsents(updatedConsents);

      if (onChange) {
        onChange(updatedConsents);
      }

      logger.debug('동의 항목 변경', {
        component: 'ConsentManager',
        data: { field, agreed },
      });
    },
    [consents, onChange, termsVersion, privacyVersion]
  );

  /**
   * 전체 동의 토글 핸들러
   */
  const handleToggleAll = useCallback(() => {
    const newAgreed = !isAllAgreed;
    const now = new Date();

    const updatedConsents: ConsentCreateInput = {
      userId: consents.userId,
      termsOfService: {
        agreed: newAgreed as true,
        ...(newAgreed && { agreedAt: now }),
        version: termsVersion,
      },
      privacyPolicy: {
        agreed: newAgreed as true,
        ...(newAgreed && { agreedAt: now }),
        version: privacyVersion,
      },
      ...(newAgreed ? {
        marketing: { agreed: newAgreed, agreedAt: now },
        locationService: { agreed: newAgreed, agreedAt: now },
        pushNotification: { agreed: newAgreed, agreedAt: now },
      } : {
        marketing: { agreed: newAgreed },
        locationService: { agreed: newAgreed },
        pushNotification: { agreed: newAgreed },
      }),
    };

    setConsents(updatedConsents);

    if (onChange) {
      onChange(updatedConsents);
    }

    logger.info('전체 동의 토글', {
      component: 'ConsentManager',
      data: { agreed: newAgreed },
    });
  }, [isAllAgreed, onChange, termsVersion, privacyVersion]);

  /**
   * 제출 핸들러
   */
  const handleSubmit = useCallback(async () => {
    if (!hasRequiredConsents) {
      toast.warning(t('consent.error.requiredConsentsNotAgreed'));
      return;
    }

    if (!onSubmit) {
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit(consents);
      logger.info('동의 제출 성공', {
        component: 'ConsentManager',
      });
    } catch (error) {
      logger.error('동의 제출 실패', error as Error, {
        component: 'ConsentManager',
      });
      toast.error(t('consent.error.submitFailed'));
    } finally {
      setIsSubmitting(false);
    }
  }, [hasRequiredConsents, onSubmit, consents, t]);

  /**
   * 약관 모달 열기
   */
  const openTermsModal = useCallback(() => {
    setLegalModalType('terms');
    setLegalModalOpen(true);
  }, []);

  /**
   * 개인정보처리방침 모달 열기
   */
  const openPrivacyModal = useCallback(() => {
    setLegalModalType('privacy');
    setLegalModalOpen(true);
  }, []);

  /**
   * 법적 문서 모달 닫기
   */
  const closeLegalModal = useCallback(() => {
    setLegalModalOpen(false);
  }, []);

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      {isSignupMode && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            {t('consent.title')}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {t('consent.description')}
          </p>
        </div>
      )}

      {/* 전체 동의 */}
      <div className="border-2 border-blue-200 dark:border-blue-700 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20">
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={isAllAgreed}
            onChange={handleToggleAll}
            className="h-5 w-5 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
            aria-label={t('consent.agreeAll')}
          />
          <span className="ml-3 text-base font-semibold text-gray-900 dark:text-gray-100">
            {t('consent.agreeAll')}
          </span>
        </label>
      </div>

      {/* 필수 동의 항목 */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">
          {t('consent.required')}
        </h3>

        {/* 이용약관 동의 */}
        <div className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
          <label className="flex items-start cursor-pointer">
            <input
              type="checkbox"
              checked={consents.termsOfService.agreed}
              onChange={(e) =>
                handleConsentChange('termsOfService', e.target.checked)
              }
              className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-0.5"
              aria-label={t('consent.termsOfService')}
              required
            />
            <div className="ml-3 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {t('consent.termsOfService')}
                  <span className="ml-1 text-red-500">*</span>
                </span>
                <button
                  type="button"
                  onClick={openTermsModal}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  aria-label={t('consent.viewDetails')}
                >
                  {t('consent.viewDetails')}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t('consent.termsOfServiceDescription')}
              </p>
            </div>
          </label>
        </div>

        {/* 개인정보처리방침 동의 */}
        <div className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
          <label className="flex items-start cursor-pointer">
            <input
              type="checkbox"
              checked={consents.privacyPolicy.agreed}
              onChange={(e) =>
                handleConsentChange('privacyPolicy', e.target.checked)
              }
              className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-0.5"
              aria-label={t('consent.privacyPolicy')}
              required
            />
            <div className="ml-3 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">
                  {t('consent.privacyPolicy')}
                  <span className="ml-1 text-red-500">*</span>
                </span>
                <button
                  type="button"
                  onClick={openPrivacyModal}
                  className="text-sm text-blue-600 hover:underline"
                  aria-label={t('consent.viewDetails')}
                >
                  {t('consent.viewDetails')}
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {t('consent.privacyPolicyDescription')}
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* 선택 동의 항목 */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {t('consent.optional')}
        </h3>

        {/* 마케팅 수신 동의 */}
        <div className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
          <label className="flex items-start cursor-pointer">
            <input
              type="checkbox"
              checked={consents.marketing?.agreed ?? false}
              onChange={(e) => handleConsentChange('marketing', e.target.checked)}
              className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-0.5"
              aria-label={t('consent.marketing')}
            />
            <div className="ml-3 flex-1">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {t('consent.marketing')}
              </span>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t('consent.marketingDescription')}
              </p>
            </div>
          </label>
        </div>

        {/* 위치 서비스 동의 */}
        <div className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
          <label className="flex items-start cursor-pointer">
            <input
              type="checkbox"
              checked={consents.locationService?.agreed ?? false}
              onChange={(e) =>
                handleConsentChange('locationService', e.target.checked)
              }
              className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-0.5"
              aria-label={t('consent.locationService')}
            />
            <div className="ml-3 flex-1">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {t('consent.locationService')}
              </span>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t('consent.locationServiceDescription')}
              </p>
            </div>
          </label>
        </div>

        {/* 푸시 알림 동의 */}
        <div className="border dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
          <label className="flex items-start cursor-pointer">
            <input
              type="checkbox"
              checked={consents.pushNotification?.agreed ?? false}
              onChange={(e) =>
                handleConsentChange('pushNotification', e.target.checked)
              }
              className="h-5 w-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-0.5"
              aria-label={t('consent.pushNotification')}
            />
            <div className="ml-3 flex-1">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {t('consent.pushNotification')}
              </span>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t('consent.pushNotificationDescription')}
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* 필수 동의 안내 */}
      {isSignupMode && !hasRequiredConsents && (
        <div className="flex items-start space-x-2 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <ExclamationCircleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <p>{t('consent.requiredWarning')}</p>
        </div>
      )}

      {/* 제출 버튼 (회원가입 모드) */}
      {isSignupMode && onSubmit && (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!hasRequiredConsents || isSubmitting}
          className={`
            w-full py-3 px-4 rounded-lg font-semibold text-white
            transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2
            ${
              hasRequiredConsents && !isSubmitting
                ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                : 'bg-gray-300 cursor-not-allowed'
            }
          `}
          aria-label={submitButtonText || t('common.next')}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center">
              <svg
                className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              {t('common.processing')}
            </span>
          ) : (
            <span className="flex items-center justify-center">
              <CheckCircleIcon className="h-5 w-5 mr-2" aria-hidden="true" />
              {submitButtonText || t('common.next')}
            </span>
          )}
        </button>
      )}

      {/* 법적 문서 모달 */}
      <LegalDocumentModal
        isOpen={legalModalOpen}
        onClose={closeLegalModal}
        type={legalModalType}
      />
    </div>
  );
};

export default ConsentManager;

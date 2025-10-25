import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { logger } from '../utils/logger';
import ConsentManager from '../components/consent/ConsentManager';
import type { ConsentCreateInput } from '../types/consent';

const ConsentPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();
  const [consents, setConsents] = useState<ConsentCreateInput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!consents) {
      setError(t('consent.requiredDetails.pleaseAgree', '필수 약관에 동의해주세요.'));
      return;
    }

    if (!currentUser) {
      setError('로그인이 필요합니다.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const db = getFirestore();
      const consentRef = doc(db, 'users', currentUser.uid, 'consents', 'current');

      const consentData = {
        version: '1.0.0',
        userId: currentUser.uid,
        termsOfService: {
          agreed: consents.termsOfService?.agreed ?? true,
          version: consents.termsOfService?.version ?? '1.0.0',
          agreedAt: new Date(),
        },
        privacyPolicy: {
          agreed: consents.privacyPolicy?.agreed ?? true,
          version: consents.privacyPolicy?.version ?? '1.0.0',
          agreedAt: new Date(),
        },
        ...(consents.marketing?.agreed && {
          marketing: {
            agreed: consents.marketing.agreed,
            agreedAt: new Date(),
          },
        }),
        ...(consents.locationService?.agreed && {
          locationService: {
            agreed: consents.locationService.agreed,
            agreedAt: new Date(),
          },
        }),
        ...(consents.pushNotification?.agreed && {
          pushNotification: {
            agreed: consents.pushNotification.agreed,
            agreedAt: new Date(),
          },
        }),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await setDoc(consentRef, consentData);

      logger.info('동의 내역 저장 성공', {
        component: 'ConsentPage',
        data: { userId: currentUser.uid }
      });

      // 원래 가려던 페이지로 이동, 없으면 홈으로
      const from = (location.state as { from?: string })?.from || '/app';
      navigate(from);
    } catch (err) {
      logger.error('동의 내역 저장 실패', err instanceof Error ? err : new Error(String(err)), {
        component: 'ConsentPage'
      });
      setError('동의 내역 저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          {t('consent.title', '약관 동의')}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {t('consent.description', '서비스 이용을 위해 약관 동의가 필요합니다.')}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <ConsentManager
            isSignupMode={true}
            onChange={setConsents}
          />

          {error && (
            <p className="mt-4 text-red-500 text-sm text-center" role="alert">
              {error}
            </p>
          )}

          <div className="mt-6">
            <button
              onClick={handleSubmit}
              disabled={isLoading || !consents}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400 disabled:cursor-not-allowed"
            >
              {isLoading ? t('common.processing', '처리 중...') : t('consent.submit', '동의하고 계속하기')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConsentPage;
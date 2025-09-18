import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { logger } from '../../utils/logger';
import { toast } from '../../utils/toast';

interface EmailVerificationProps {
  onVerified: () => void;
}

const EmailVerification: React.FC<EmailVerificationProps> = ({ onVerified }) => {
  const { t } = useTranslation();
  const { currentUser, sendEmailVerification, reloadUser } = useAuth();
  const [isResending, setIsResending] = useState(false);
  const [canResend, setCanResend] = useState(true);
  const [countdown, setCountdown] = useState(0);

  // 60초 쿨다운 타이머
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
      return undefined;
    }
  }, [countdown]);

  // 인증 상태 주기적 확인
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        await reloadUser();
        if (currentUser?.emailVerified) {
          onVerified();
          return;
        }
      } catch (error) {
        logger.error('이메일 인증 상태 확인 실패:', error instanceof Error ? error : new Error(String(error)), { component: 'EmailVerification' });
      }
    }, 3000); // 3초마다 확인

    return () => clearInterval(interval);
  }, [currentUser, reloadUser, onVerified]);

  const handleResendEmail = async () => {
    if (!canResend || isResending) return;

    setIsResending(true);
    try {
      await sendEmailVerification();
      toast.success(t('emailVerification.resendSuccess', '인증 메일을 다시 발송했습니다.'));
      setCanResend(false);
      setCountdown(60); // 60초 쿨다운
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      toast.error(t('emailVerification.resendError', `인증 메일 발송 실패: ${errorMessage}`));
      logger.error('인증 메일 재발송 실패:', error instanceof Error ? error : new Error(String(error)), { component: 'EmailVerification' });
    } finally {
      setIsResending(false);
    }
  };

  const handleCheckVerification = async () => {
    try {
      await reloadUser();
      if (currentUser?.emailVerified) {
        toast.success(t('emailVerification.verificationSuccess', '이메일 인증이 완료되었습니다!'));
        onVerified();
      } else {
        toast.warning(t('emailVerification.notVerifiedYet', '아직 인증이 완료되지 않았습니다.'));
      }
    } catch (error) {
      toast.error(t('emailVerification.checkError', '인증 상태 확인 중 오류가 발생했습니다.'));
      logger.error('이메일 인증 상태 확인 실패:', error instanceof Error ? error : new Error(String(error)), { component: 'EmailVerification' });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 flex items-center justify-center bg-yellow-100 rounded-full mb-4">
            <svg className="h-8 w-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {t('emailVerification.title', '이메일 인증')}
          </h2>
          <p className="text-gray-600 mb-1">
            {t('emailVerification.subtitle', '계정을 활성화하려면 이메일 인증이 필요합니다.')}
          </p>
          <p className="text-sm text-gray-500">
            {currentUser?.email}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="space-y-4">
            <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-blue-700">
                    {t('emailVerification.instructions', '인증 메일을 확인하고 링크를 클릭하세요. 메일이 오지 않으면 스팸함도 확인해보세요.')}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col space-y-3">
              <button
                onClick={handleCheckVerification}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                {t('emailVerification.checkButton', '인증 확인')}
              </button>

              <button
                onClick={handleResendEmail}
                disabled={!canResend || isResending}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isResending
                  ? t('emailVerification.resending', '발송 중...')
                  : !canResend
                  ? t('emailVerification.resendCountdown', `재발송 (${countdown}초 후)`).replace('({countdown}초 후)', `(${countdown}초 후)`)
                  : t('emailVerification.resendButton', '인증 메일 재발송')
                }
              </button>
            </div>
          </div>
        </div>

        <div className="text-center">
          <p className="text-sm text-gray-500">
            {t('emailVerification.autoCheck', '인증 완료 시 자동으로 이동합니다.')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmailVerification;
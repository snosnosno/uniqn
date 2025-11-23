/**
 * 전화번호/이메일 인증 설정 페이지
 *
 * 기능:
 * - 이메일 인증 상태 확인
 * - 전화번호 인증 (PhoneVerification 컴포넌트 사용)
 * - 인증 상태 실시간 확인
 */

import React, { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { sendEmailVerification } from 'firebase/auth';
import { functions } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { logger } from '../../utils/logger';
import { toast } from '../../utils/toast';
import PhoneVerification from '../../components/auth/PhoneVerification';

interface VerificationStatus {
  emailVerified: boolean;
  phoneVerified: boolean;
  phoneNumber?: string;
}

const VerificationSettingsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>({
    emailVerified: false,
    phoneVerified: false,
  });
  const [loading, setLoading] = useState(true);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showPhoneVerification, setShowPhoneVerification] = useState(false);

  useEffect(() => {
    if (currentUser) {
      loadVerificationStatus();
    }
  }, [currentUser]);

  /**
   * 인증 상태 로딩
   */
  const loadVerificationStatus = async () => {
    if (!currentUser) return;

    setLoading(true);

    try {
      const getStatus = httpsCallable(functions, 'getVerificationStatus');
      const result = await getStatus({ userId: currentUser.uid });

      const data = result.data as {
        success: boolean;
        emailVerified: boolean;
        phoneVerified: boolean;
        phoneNumber?: string;
      };

      if (data.success) {
        setVerificationStatus({
          emailVerified: data.emailVerified,
          phoneVerified: data.phoneVerified,
          phoneNumber: data.phoneNumber,
        });
      }
    } catch (error) {
      logger.error('인증 상태 로딩 실패', error as Error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 이메일 인증 메일 재발송
   */
  const handleResendEmailVerification = async () => {
    if (!currentUser) return;

    setSendingEmail(true);

    try {
      await sendEmailVerification(currentUser);
      toast.success('인증 메일이 발송되었습니다. 이메일을 확인해주세요.');
      logger.info('이메일 인증 메일 재발송 완료');
    } catch (error) {
      logger.error('이메일 인증 메일 발송 실패', error as Error);
      toast.error('이메일 인증 메일 발송에 실패했습니다.');
    } finally {
      setSendingEmail(false);
    }
  };

  /**
   * 전화번호 인증 완료 핸들러
   */
  const handlePhoneVerified = (phoneNumber: string) => {
    setVerificationStatus((prev) => ({
      ...prev,
      phoneVerified: true,
      phoneNumber,
    }));
    setShowPhoneVerification(false);
    toast.success('전화번호 인증이 완료되었습니다.');
    logger.info('전화번호 인증 완료');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 dark:border-blue-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            계정 인증 설정
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            이메일과 전화번호 인증을 통해 계정을 보호하세요.
          </p>
        </div>

        {/* 인증 상태 카드 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6 p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            인증 상태
          </h2>

          <div className="space-y-4">
            {/* 이메일 인증 */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-md">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  이메일 인증
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {currentUser?.email || '이메일 없음'}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {verificationStatus.emailVerified ? (
                  <span className="px-3 py-1 text-sm font-semibold rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                    ✅ 인증 완료
                  </span>
                ) : (
                  <>
                    <span className="px-3 py-1 text-sm font-semibold rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">
                      ⚠️ 미인증
                    </span>
                    <button
                      onClick={handleResendEmailVerification}
                      disabled={sendingEmail}
                      className="px-4 py-2 bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      {sendingEmail ? '발송 중...' : '인증 메일 재발송'}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* 전화번호 인증 */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-md">
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  전화번호 인증
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {verificationStatus.phoneNumber || '전화번호 미등록'}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {verificationStatus.phoneVerified ? (
                  <span className="px-3 py-1 text-sm font-semibold rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                    ✅ 인증 완료
                  </span>
                ) : (
                  <>
                    <span className="px-3 py-1 text-sm font-semibold rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">
                      ⚠️ 미인증
                    </span>
                    <button
                      onClick={() => setShowPhoneVerification(true)}
                      className="px-4 py-2 bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-md transition-colors text-sm"
                    >
                      전화번호 인증
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 전화번호 인증 모달 */}
        {showPhoneVerification && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="max-w-md w-full">
              <PhoneVerification
                onVerified={handlePhoneVerified}
                onSkip={() => setShowPhoneVerification(false)}
              />
            </div>
          </div>
        )}

        {/* 안내 사항 */}
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-300 mb-2">
            📌 인증 안내
          </h3>
          <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-400">
            <li>• 이메일 인증은 가입 시 발송된 메일을 확인하거나 재발송 버튼을 눌러주세요.</li>
            <li>• 전화번호 인증은 6자리 인증 코드를 입력하여 완료합니다.</li>
            <li>• 인증 코드는 발송 후 5분간 유효하며, 3회까지 시도할 수 있습니다.</li>
            <li>• 계정 보안을 위해 이메일과 전화번호 인증을 모두 완료해주세요.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default VerificationSettingsPage;

/**
 * 전화번호 인증 컴포넌트
 *
 * 기능:
 * - 전화번호 입력 및 인증 코드 발송
 * - 인증 코드 입력 및 확인
 * - 60초 쿨다운 타이머
 * - 3회 시도 제한
 */

import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { logger } from '../../utils/logger';

interface PhoneVerificationProps {
  onVerified: (phoneNumber: string) => void;
  onSkip?: () => void;
}

const PhoneVerification: React.FC<PhoneVerificationProps> = ({ onVerified, onSkip }) => {
  const { currentUser } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [attemptsLeft, setAttemptsLeft] = useState(3);
  const [error, setError] = useState('');

  // 카운트다운 타이머
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [countdown]);

  /**
   * 전화번호 형식 자동 변환 (010-1234-5678)
   */
  const formatPhoneNumber = (value: string): string => {
    const numbers = value.replace(/\D/g, '');

    if (numbers.length <= 3) {
      return numbers;
    } else if (numbers.length <= 7) {
      return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    } else {
      return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
    }
  };

  /**
   * 전화번호 입력 핸들러
   */
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
    setError('');
  };

  /**
   * 인증 코드 발송
   */
  const handleSendCode = async () => {
    if (!currentUser) {
      setError('로그인이 필요합니다.');
      return;
    }

    if (!phoneNumber || phoneNumber.length < 13) {
      setError('올바른 전화번호를 입력해주세요.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const sendCode = httpsCallable(functions, 'sendPhoneVerificationCode');
      const result = await sendCode({
        phoneNumber,
        userId: currentUser.uid,
      });

      const data = result.data as {
        success: boolean;
        message: string;
        expiresIn: number;
        code?: string; // 개발 환경에서만
      };

      if (data.success) {
        setStep('code');
        setCountdown(data.expiresIn || 300);

        // 개발 환경에서 코드 자동 입력
        if (data.code) {
          logger.info('개발 환경: 인증 코드 자동 입력');
          setVerificationCode(data.code);
        }

        logger.info('전화번호 인증 코드 발송 완료');
      }
    } catch (error: any) {
      const errorMessage = error.message || '인증 코드 발송에 실패했습니다.';
      setError(errorMessage);
      logger.error('전화번호 인증 코드 발송 실패', error as Error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 인증 코드 확인
   */
  const handleVerifyCode = async () => {
    if (!currentUser) {
      setError('로그인이 필요합니다.');
      return;
    }

    if (!verificationCode || verificationCode.length !== 6) {
      setError('6자리 인증 코드를 입력해주세요.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const verifyCode = httpsCallable(functions, 'verifyPhoneCode');
      const result = await verifyCode({
        phoneNumber,
        code: verificationCode,
        userId: currentUser.uid,
      });

      const data = result.data as {
        success: boolean;
        message: string;
        phoneNumber: string;
      };

      if (data.success) {
        logger.info('전화번호 인증 완료');
        onVerified(data.phoneNumber);
      }
    } catch (error: any) {
      const errorMessage = error.message || '인증 코드 확인에 실패했습니다.';
      setError(errorMessage);

      // 시도 횟수 감소
      if (errorMessage.includes('회 남음')) {
        const match = errorMessage.match(/\((\d+)회 남음\)/);
        if (match) {
          setAttemptsLeft(parseInt(match[1] || '0'));
        }
      }

      logger.error('전화번호 인증 코드 확인 실패', error as Error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 다시 시작
   */
  const handleReset = () => {
    setStep('phone');
    setPhoneNumber('');
    setVerificationCode('');
    setCountdown(0);
    setAttemptsLeft(3);
    setError('');
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
        전화번호 인증
      </h2>

      {step === 'phone' ? (
        // 전화번호 입력 단계
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              전화번호
            </label>
            <input
              type="tel"
              value={phoneNumber}
              onChange={handlePhoneChange}
              placeholder="010-1234-5678"
              maxLength={13}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleSendCode}
              disabled={loading || !phoneNumber || phoneNumber.length < 13}
              className="flex-1 py-2 px-4 bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '발송 중...' : '인증 코드 발송'}
            </button>

            {onSkip && (
              <button
                onClick={onSkip}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                건너뛰기
              </button>
            )}
          </div>
        </div>
      ) : (
        // 인증 코드 입력 단계
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-md">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>{phoneNumber}</strong>로 인증 코드를 발송했습니다.
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              남은 시간: {Math.floor(countdown / 60)}분 {countdown % 60}초
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              인증 코드 (6자리)
            </label>
            <input
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              maxLength={6}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-center text-2xl tracking-widest focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              disabled={loading}
              autoFocus
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              남은 시도 횟수: {attemptsLeft}회
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleVerifyCode}
              disabled={loading || verificationCode.length !== 6}
              className="flex-1 py-2 px-4 bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '확인 중...' : '인증 확인'}
            </button>

            <button
              onClick={handleReset}
              disabled={loading}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              다시 시작
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhoneVerification;

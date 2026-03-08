/**
 * UNIQN Mobile - OTP 코드 확인 훅
 *
 * @description OTP 입력, 확인, 시도 횟수 제한, TOCTOU 방지 로직
 * @version 1.0.0
 */

import { useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { logger } from '@/utils/logger';
import { maskValue } from '@/errors/serviceErrorHandler';
import { cleanPhoneNumber, toE164 } from '@/utils/phone';
import { checkPhoneExists } from '@/services/auth';
import { getFirebaseOTPErrorMessage } from '@/components/auth/phoneAuthErrors';
import { getFirebaseAuth } from '@/lib/firebase';
import { getNativeAuth } from '@/lib/nativeAuth';
import type { ConfirmationResultLike } from './usePhoneSMS';

// ============================================================================
// Types
// ============================================================================

export interface UseOTPVerificationOptions {
  mode: 'signIn' | 'link';
  confirmation: ConfirmationResultLike | null;
  verificationIdRef: React.MutableRefObject<string | null>;
  requestedModeRef: React.MutableRefObject<'signIn' | 'link'>;
  phone: string;
  onVerified: (phone: string, otpData?: { verificationId: string; otpCode: string }) => void;
  onError?: (error: Error) => void;
}

export interface UseOTPVerificationReturn {
  otpCode: string;
  setOtpCode: (code: string) => void;
  otpAttempts: number;
  isVerifying: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  confirmOTP: () => Promise<'verified' | 'reset' | null>;
  resetOTP: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const OTP_LENGTH = 6;
const MAX_OTP_ATTEMPTS = 5;

// ============================================================================
// Hook
// ============================================================================

export function useOTPVerification({
  mode,
  confirmation,
  verificationIdRef,
  requestedModeRef,
  phone,
  onVerified,
  onError,
}: UseOTPVerificationOptions): UseOTPVerificationReturn {
  const [otpCode, setOtpCode] = useState('');
  const [otpAttempts, setOtpAttempts] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** OTP 코드 입력 핸들러 (숫자만, 6자리 제한) */
  const handleOtpChange = useCallback((text: string) => {
    setOtpCode(text.replace(/\D/g, '').slice(0, OTP_LENGTH));
  }, []);

  /** OTP 코드 확인 */
  const confirmOTP = useCallback(async (): Promise<'verified' | 'reset' | null> => {
    // mode 불일치 방어
    if (requestedModeRef.current !== mode) {
      logger.error('OTP mode 불일치', {
        requestedMode: requestedModeRef.current,
        currentMode: mode,
      });
      setError('인증 상태가 변경되었습니다. 다시 인증해주세요.');
      setOtpCode('');
      setOtpAttempts(0);
      return 'reset';
    }

    // OTP 시도 횟수 제한
    if (otpAttempts >= MAX_OTP_ATTEMPTS) {
      setError('인증번호 입력 횟수를 초과했습니다. 인증번호를 다시 요청해주세요.');
      setOtpAttempts(0);
      setOtpCode('');
      return 'reset';
    }

    // link 모드: verificationId 필수
    if (mode === 'link') {
      if (!verificationIdRef.current) {
        logger.error('link 모드 OTP 확인 실패: verificationId 없음', {
          hasConfirmation: !!confirmation,
        });
        setError('인증 세션이 만료되었습니다. 인증번호를 다시 요청해주세요.');
        return 'reset';
      }
    } else if (!confirmation) {
      setError('인증 세션이 만료되었습니다. 다시 시도해주세요.');
      return 'reset';
    }

    if (otpCode.length !== OTP_LENGTH) {
      setError(`인증번호 ${OTP_LENGTH}자리를 입력해주세요`);
      return null;
    }

    setIsVerifying(true);
    setError(null);

    try {
      if (mode === 'link') {
        // 서버사이드 OTP 검증 모드: linkWithCredential 대신
        // verificationId + otpCode를 서버(CF)에 전달하여 검증 + phoneNumber 설정
        const vid = verificationIdRef.current;
        if (!vid) {
          throw new Error('인증 세션이 만료되었습니다. 인증번호를 다시 요청해주세요.');
        }

        // TOCTOU 방지: 전화번호 중복 재검증 (UX용, CF Transaction이 최종 보호)
        try {
          const phoneStillAvailable = !(await checkPhoneExists(cleanPhoneNumber(phone)));
          if (!phoneStillAvailable) {
            setError('이미 다른 계정에 등록된 전화번호입니다. 다시 확인해주세요.');
            setIsVerifying(false);
            return null;
          }
        } catch {
          logger.warn('OTP 확인 전 전화번호 재검증 실패 — 서버 검증으로 진행');
        }

        // linkWithCredential 호출 없이 otpData를 콜백으로 전달
        // CF(verifyAndSaveProfile)가 서버에서 OTP 검증 + phoneNumber 설정 처리
        onVerified(toE164(phone), { verificationId: vid, otpCode });
        logger.info('SMS 인증 완료 (서버사이드 검증 모드)', {
          phone: maskValue(phone, 'phone'),
          mode,
        });
        return 'verified';
      }

      // signIn 모드: confirm()으로 로그인 (기존 동작 유지)
      if (!confirmation) {
        throw new Error('인증 세션이 만료되었습니다.');
      }
      await confirmation.confirm(otpCode);

      onVerified(toE164(phone));
      logger.info('SMS 인증 완료', { phone: maskValue(phone, 'phone'), mode });
      return 'verified';
    } catch (err) {
      const firebaseCode = (err as { code?: string })?.code;
      const errorMessage = firebaseCode
        ? getFirebaseOTPErrorMessage(err, mode)
        : err instanceof Error
          ? err.message
          : '인증에 실패했습니다. 다시 시도해주세요.';
      setError(errorMessage);
      setOtpAttempts((prev) => prev + 1);
      onError?.(err instanceof Error ? err : new Error(errorMessage));
      logger.error('OTP 확인 실패', err instanceof Error ? err : new Error(errorMessage), {
        mode,
        firebaseCode: firebaseCode ?? 'non-firebase-error',
        hasNativeUser: Platform.OS !== 'web' ? !!getNativeAuth?.()?.currentUser : undefined,
        hasWebUser: !!getFirebaseAuth().currentUser,
        hasVerificationId: !!verificationIdRef.current,
      });
      return null;
    } finally {
      setIsVerifying(false);
    }
  }, [
    confirmation,
    otpCode,
    phone,
    onVerified,
    onError,
    mode,
    otpAttempts,
    verificationIdRef,
    requestedModeRef,
  ]);

  /** OTP 상태 초기화 */
  const resetOTP = useCallback(() => {
    setOtpCode('');
    setOtpAttempts(0);
    setError(null);
  }, []);

  return {
    otpCode,
    setOtpCode: handleOtpChange,
    otpAttempts,
    isVerifying,
    error,
    setError,
    confirmOTP,
    resetOTP,
  };
}

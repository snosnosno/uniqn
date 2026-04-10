/**
 * UNIQN Mobile - OTP 코드 확인 훅
 *
 * @description OTP 입력, 확인, 시도 횟수 제한, TOCTOU 방지 로직
 * @version 1.0.0
 */

import { useState, useCallback } from 'react';
import { logger } from '@/utils/logger';
import { maskValue } from '@/errors/serviceErrorHandler';
import { cleanPhoneNumber, toE164 } from '@/utils/phone';
import { checkPhoneExists } from '@/services/auth';
import {
  getFirebaseOTPErrorMessage,
  isFirebaseOTPExpiredError,
} from '@/components/auth/phoneAuthErrors';
import { getMMKVInstance } from '@/lib/mmkvStorage';

/** Confirmation result interface (legacy - phone auth was removed) */
export interface ConfirmationResultLike {
  confirm: (code: string) => Promise<unknown>;
}

// ============================================================================
// Types
// ============================================================================

export interface UseOTPVerificationOptions {
  mode: 'signIn' | 'link';
  confirmation: ConfirmationResultLike | null;
  verificationIdRef: React.MutableRefObject<string | null>;
  requestedModeRef: React.MutableRefObject<'signIn' | 'link'>;
  clearVerificationState: () => void;
  phone: string;
  onVerified: (phone: string, otpData?: { verificationId: string; otpCode: string }) => void;
  onError?: (error: Error) => void;
}

export interface ConfirmOTPResult {
  status: 'verified' | 'expired' | 'reset' | 'error';
  message?: string;
  firebaseCode?: string;
}

export interface UseOTPVerificationReturn {
  otpCode: string;
  setOtpCode: (code: string) => void;
  otpAttempts: number;
  isVerifying: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  confirmOTP: () => Promise<ConfirmOTPResult>;
  resetOTP: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const OTP_LENGTH = 6;
const MAX_OTP_ATTEMPTS = 5;
/** OTP 시도 횟수 자동 리셋 쿨다운 (5분) */
const OTP_ATTEMPTS_COOLDOWN_MS = 5 * 60 * 1000;

// ============================================================================
// Hook
// ============================================================================

export function useOTPVerification({
  mode,
  confirmation,
  verificationIdRef,
  requestedModeRef,
  clearVerificationState,
  phone,
  onVerified,
  onError,
}: UseOTPVerificationOptions): UseOTPVerificationReturn {
  const [otpCode, setOtpCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // OTP 시도 횟수를 MMKV에 저장하여 컴포넌트 unmount/remount 시에도 제한 유지
  // E.164 정규화로 모든 포맷(010-1234-5678, +821012345678 등)이 동일 키를 사용
  const normalizedPhone = toE164(phone).replace(/\+/g, '');
  const otpAttemptsKey = `otp_attempts_${normalizedPhone}`;

  const getPersistedAttempts = useCallback((): number => {
    try {
      const mmkv = getMMKVInstance();
      const stored = mmkv.getString(otpAttemptsKey);
      if (!stored) return 0;
      const { count, timestamp } = JSON.parse(stored) as { count: number; timestamp: number };
      if (Date.now() - timestamp > OTP_ATTEMPTS_COOLDOWN_MS) {
        mmkv.delete(otpAttemptsKey);
        return 0;
      }
      return count;
    } catch {
      return 0;
    }
  }, [otpAttemptsKey]);

  const setPersistedAttempts = useCallback(
    (count: number) => {
      try {
        const mmkv = getMMKVInstance();
        if (count === 0) {
          mmkv.delete(otpAttemptsKey);
        } else {
          mmkv.set(otpAttemptsKey, JSON.stringify({ count, timestamp: Date.now() }));
        }
      } catch {
        // MMKV 저장 실패는 무시 (메모리 카운터는 유지됨)
      }
    },
    [otpAttemptsKey]
  );

  const [otpAttempts, setOtpAttempts] = useState(getPersistedAttempts);

  /** OTP 코드 입력 핸들러 (숫자만, 6자리 제한) */
  const handleOtpChange = useCallback((text: string) => {
    setOtpCode(text.replace(/\D/g, '').slice(0, OTP_LENGTH));
  }, []);

  /** OTP 코드 확인 */
  const confirmOTP = useCallback(async (): Promise<ConfirmOTPResult> => {
    // mode 불일치 방어
    if (requestedModeRef.current !== mode) {
      logger.error('OTP mode 불일치', {
        requestedMode: requestedModeRef.current,
        currentMode: mode,
      });
      const message = '인증 상태가 변경되었습니다. 인증번호를 다시 요청해 주세요.';
      setError(message);
      setOtpCode('');
      setOtpAttempts(0);
      setPersistedAttempts(0);
      clearVerificationState();
      return { status: 'reset', message };
    }

    // OTP 시도 횟수 제한
    if (otpAttempts >= MAX_OTP_ATTEMPTS) {
      const message = '인증번호 입력 횟수를 초과했습니다. 인증번호를 다시 요청해 주세요.';
      setError(message);
      setOtpAttempts(0);
      setPersistedAttempts(0);
      setOtpCode('');
      clearVerificationState();
      return { status: 'reset', message };
    }

    // link 모드: verificationId 필수
    if (mode === 'link') {
      if (!verificationIdRef.current) {
        logger.error('link 모드 OTP 확인 실패: verificationId 없음', {
          hasConfirmation: !!confirmation,
        });
        const message = '인증 세션이 만료되었습니다. 인증번호를 다시 요청해 주세요.';
        setError(message);
        clearVerificationState();
        return { status: 'reset', message };
      }
    } else if (!confirmation) {
      const message = '인증 세션이 만료되었습니다. 인증번호를 다시 요청해 주세요.';
      setError(message);
      clearVerificationState();
      return { status: 'reset', message };
    }

    if (otpCode.length !== OTP_LENGTH) {
      const message = `인증번호 ${OTP_LENGTH}자리를 입력해 주세요.`;
      setError(message);
      return { status: 'error', message };
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
            const message = '이미 다른 계정에 등록된 전화번호입니다. 다시 확인해주세요.';
            setError(message);
            setIsVerifying(false);
            return { status: 'error', message };
          }
        } catch {
          logger.warn('OTP 확인 전 전화번호 재검증 실패 — 서버 검증으로 진행');
        }

        // linkWithCredential 호출 없이 otpData를 콜백으로 전달
        // CF(verifyAndSaveProfile)가 서버에서 OTP 검증 + phoneNumber 설정 처리
        try {
          onVerified(toE164(phone), { verificationId: vid, otpCode });
        } catch (callbackError) {
          logger.error('onVerified 콜백 실행 실패', {
            error: callbackError instanceof Error ? callbackError.message : String(callbackError),
            mode,
          });
          throw callbackError;
        }
        logger.info('SMS 인증 완료 (서버사이드 검증 모드)', {
          phone: maskValue(phone, 'phone'),
          mode,
        });
        return { status: 'verified' };
      }

      // signIn 모드: confirm()으로 로그인 (기존 동작 유지)
      if (!confirmation) {
        throw new Error('인증 세션이 만료되었습니다.');
      }

      // TOCTOU 방지: signIn 전 전화번호 중복 재검증 (UX용, 서버사이드가 최종 보호)
      try {
        const phoneStillAvailable = !(await checkPhoneExists(cleanPhoneNumber(phone)));
        if (!phoneStillAvailable) {
          const message = '이미 다른 계정에 등록된 전화번호입니다. 다시 확인해주세요.';
          setError(message);
          setIsVerifying(false);
          return { status: 'error', message };
        }
      } catch (checkError) {
        logger.warn('OTP 확인 전 전화번호 재검증 실패 — Firebase 검증으로 진행', {
          component: 'useOTPVerification',
          mode,
          error: checkError instanceof Error ? checkError.message : String(checkError),
        });
      }

      await confirmation.confirm(otpCode);

      try {
        onVerified(toE164(phone));
      } catch (callbackError) {
        logger.error('onVerified 콜백 실행 실패', {
          error: callbackError instanceof Error ? callbackError.message : String(callbackError),
          mode,
        });
        throw callbackError;
      }
      logger.info('SMS 인증 완료', { phone: maskValue(phone, 'phone'), mode });
      return { status: 'verified' };
    } catch (err) {
      const firebaseCode = (err as { code?: string })?.code;
      const errorMessage = firebaseCode
        ? getFirebaseOTPErrorMessage(err, mode)
        : err instanceof Error
          ? err.message
          : '인증에 실패했습니다. 다시 시도해주세요.';
      const isExpiredError = isFirebaseOTPExpiredError(err);
      setError(errorMessage);

      if (isExpiredError) {
        const errorToReport = err instanceof Error ? err : new Error(errorMessage);
        setOtpCode('');
        clearVerificationState();
        onError?.(errorToReport);
        logger.error('OTP 인증 세션 만료 - 재요청 필요', errorToReport, {
          mode,
          firebaseCode: firebaseCode ?? 'non-firebase-error',
          hasSupabaseSession: true,
          hasVerificationId: !!verificationIdRef.current,
        });
        return { status: 'expired', message: errorMessage, firebaseCode };
      }

      setOtpAttempts((prev) => {
        const next = prev + 1;
        setPersistedAttempts(next);
        return next;
      });
      onError?.(err instanceof Error ? err : new Error(errorMessage));
      logger.error('OTP 확인 실패', err instanceof Error ? err : new Error(errorMessage), {
        mode,
        firebaseCode: firebaseCode ?? 'non-firebase-error',
        hasSupabaseSession: true,
        hasVerificationId: !!verificationIdRef.current,
      });
      return { status: 'error', message: errorMessage, firebaseCode };
    } finally {
      setIsVerifying(false);
    }
  }, [
    clearVerificationState,
    confirmation,
    otpCode,
    phone,
    onVerified,
    onError,
    mode,
    otpAttempts,
    verificationIdRef,
    requestedModeRef,
    setPersistedAttempts,
  ]);

  /** OTP 상태 초기화 */
  const resetOTP = useCallback(() => {
    setOtpCode('');
    setOtpAttempts(0);
    setPersistedAttempts(0);
    setError(null);
  }, [setPersistedAttempts]);

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

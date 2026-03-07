/**
 * UNIQN Mobile - OTP 코드 확인 훅
 *
 * @description OTP 입력, 확인, 시도 횟수 제한, TOCTOU 방지 로직
 * @version 1.0.0
 */

import { useState, useCallback } from 'react';
import { Platform } from 'react-native';
import {
  PhoneAuthProvider as WebPhoneAuthProvider,
  linkWithCredential as webLinkWithCredential,
} from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { maskValue } from '@/errors/serviceErrorHandler';
import { cleanPhoneNumber, toE164 } from '@/utils/phone';
import { checkPhoneExists } from '@/services/auth';
import { getFirebaseOTPErrorMessage } from '@/components/auth/phoneAuthErrors';
import { getNativeAuth, NativePhoneAuthProvider, nativeLinkWithCredential } from '@/lib/nativeAuth';
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
  onVerified: (phone: string) => void;
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
        const vid = verificationIdRef.current;
        if (!vid) {
          throw new Error('인증 세션이 만료되었습니다. 인증번호를 다시 요청해주세요.');
        }

        // TOCTOU 방지: link 직전 전화번호 중복 재검증
        try {
          const phoneStillAvailable = !(await checkPhoneExists(cleanPhoneNumber(phone)));
          if (!phoneStillAvailable) {
            setError('이미 다른 계정에 등록된 전화번호입니다. 다시 확인해주세요.');
            setIsVerifying(false);
            return null;
          }
        } catch {
          // 재검증 실패 시 link 진행 (CF Transaction이 최종 보호)
          logger.warn('OTP 확인 전 전화번호 재검증 실패 — link 진행');
        }

        if (
          Platform.OS !== 'web' &&
          NativePhoneAuthProvider &&
          nativeLinkWithCredential &&
          getNativeAuth
        ) {
          const nativeUser = getNativeAuth().currentUser;
          if (nativeUser) {
            // Native SDK로 link (기본 경로)
            const credential = NativePhoneAuthProvider.credential(vid, otpCode);
            logger.info('link 모드: Native linkWithCredential 시도', {
              uid: nativeUser.uid,
            });
            await nativeLinkWithCredential(nativeUser, credential);
          } else {
            // Native SDK currentUser 없음 → Web SDK fallback
            logger.error('CRITICAL: cross-SDK fallback 도달 — 사전검증 우회됨', {
              platform: Platform.OS,
            });
            const webUser = getFirebaseAuth().currentUser;
            if (!webUser) {
              logger.error('link 모드 OTP 실패: 양쪽 SDK 모두 사용자 없음');
              throw new Error(
                '인증 세션이 만료되었습니다. 앱을 종료하고 다시 소셜 로그인해주세요.'
              );
            }
            logger.info('link 모드: Web SDK fallback linkWithCredential 시도', {
              uid: webUser.uid,
            });
            const credential = WebPhoneAuthProvider.credential(vid, otpCode);
            await webLinkWithCredential(webUser, credential);
          }
        } else {
          // 웹 플랫폼 link 모드
          const credential = WebPhoneAuthProvider.credential(vid, otpCode);
          const webUser = getFirebaseAuth().currentUser;
          if (!webUser) {
            logger.error('link 모드 OTP 확인 실패: Web SDK currentUser null');
            throw new Error('인증 정보가 없습니다. 다시 로그인해주세요.');
          }
          await webLinkWithCredential(webUser, credential);
        }
      } else {
        // signIn 모드: confirm()으로 로그인
        if (!confirmation) {
          throw new Error('인증 세션이 만료되었습니다.');
        }
        await confirmation.confirm(otpCode);
      }

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

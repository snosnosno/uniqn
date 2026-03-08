/**
 * UNIQN Mobile - SMS 인증 요청 훅
 *
 * @description 전화번호 입력, SMS 발송, 재발송 쿨다운, 중복 체크 로직
 * @version 1.0.0
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Platform } from 'react-native';
import {
  signInWithPhoneNumber as webSignInWithPhoneNumber,
  RecaptchaVerifier,
  PhoneAuthProvider as WebPhoneAuthProvider,
} from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { logger } from '@/utils/logger';
import { maskValue } from '@/errors/serviceErrorHandler';
import {
  formatPhoneNumber,
  cleanPhoneNumber,
  toE164,
  formatE164ToDisplay,
  isValidKoreanPhone,
} from '@/utils/phone';
import { checkPhoneExists } from '@/services/auth';
import { getFirebasePhoneAuthErrorMessage } from '@/components/auth/phoneAuthErrors';
import {
  getNativeAuth,
  nativeSignInWithPhoneNumber,
  nativeVerifyPhoneNumber,
} from '@/lib/nativeAuth';

// ============================================================================
// Types
// ============================================================================

/** 플랫폼 공통 ConfirmationResult 인터페이스 */
export interface ConfirmationResultLike {
  confirm(code: string): Promise<unknown>;
}

/** PhoneAuthSnapshot의 state 리터럴 (SDK 타입과 일치) */
type PhoneAuthSnapshotState = 'sent' | 'timeout' | 'verified' | 'error';

/** SDK PhoneAuthSnapshot과 일치하는 타입 */
interface PhoneAuthSnapshotLike {
  state: PhoneAuthSnapshotState;
  verificationId: string | null;
  code?: string | null;
  error?: { code?: string; message?: string } | null;
}

/** PhoneAuthListener 참조 */
interface VerificationForLinkResult {
  verificationId: string;
  settled: { current: boolean };
  listener: { removeAllListeners(event: string): void } | null;
  autoCode?: string | null;
}

export interface UsePhoneSMSOptions {
  mode: 'signIn' | 'link';
  getOrCreateVerifier: () => Promise<RecaptchaVerifier | null>;
  cleanupOnError: () => void;
  onError?: (error: Error) => void;
}

export interface UsePhoneSMSReturn {
  phone: string;
  setPhone: (phone: string) => void;
  handlePhoneChange: (text: string) => void;
  isRequesting: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  confirmation: ConfirmationResultLike | null;
  verificationIdRef: React.MutableRefObject<string | null>;
  /** PhoneAuthListener settled 참조 (link 모드) */
  phoneListenerSettledRef: React.MutableRefObject<{ current: boolean } | null>;
  /** PhoneAuthListener 참조 (link 모드) */
  phoneListenerRef: React.MutableRefObject<{ removeAllListeners(event: string): void } | null>;
  /** OTP 요청 시점의 mode 기록 */
  requestedModeRef: React.MutableRefObject<'signIn' | 'link'>;
  requestSMS: (
    onAutoCompleted: (otpData?: { verificationId: string; otpCode: string }) => void
  ) => Promise<'otp' | 'autoCompleted' | null>;
  resetState: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const RESEND_COOLDOWN = 60;
const AUTO_VERIFY_TIMEOUT_SECONDS = 60;

// ============================================================================
// Internal: requestVerificationForLink
// ============================================================================

/**
 * link 모드 전용: verifyPhoneNumber를 Promise로 래핑
 *
 * signInWithPhoneNumber와 달리 현재 로그인 세션을 교체하지 않으므로
 * 기존 Apple/소셜 로그인 세션이 안전하게 유지됩니다.
 */
function requestVerificationForLink(e164: string): Promise<VerificationForLinkResult> {
  const LISTENER_TIMEOUT_MS = (RESEND_COOLDOWN + 5) * 1000;
  const settled = { current: false };
  let listenerRef: { removeAllListeners(event: string): void } | null = null;

  const verificationPromise = new Promise<VerificationForLinkResult>((resolve, reject) => {
    if (!nativeVerifyPhoneNumber || !getNativeAuth) {
      reject(new Error('네이티브 Firebase Auth를 사용할 수 없습니다.'));
      return;
    }

    function resolveWithVid(
      snapshot: PhoneAuthSnapshotLike,
      logMsg: string,
      autoCode?: string | null
    ) {
      const vid = snapshot.verificationId;
      if (!vid) {
        settled.current = true;
        reject(new Error('인증 세션 ID를 받지 못했습니다. 다시 시도해주세요.'));
        return;
      }
      settled.current = true;
      logger.info(logMsg, { phone: maskValue(e164, 'phone') });
      resolve({ verificationId: vid, settled, listener: listenerRef, autoCode });
    }

    try {
      const listener = nativeVerifyPhoneNumber(getNativeAuth(), e164, AUTO_VERIFY_TIMEOUT_SECONDS);
      listenerRef = listener as unknown as { removeAllListeners(event: string): void };
      listener.on(
        'state_changed',
        (snapshot: PhoneAuthSnapshotLike) => {
          if (settled.current) return;

          switch (snapshot.state) {
            case 'sent':
              resolveWithVid(snapshot, 'verifyPhoneNumber: SMS 발송 완료 (link 모드)');
              break;
            case 'verified':
              resolveWithVid(
                snapshot,
                'verifyPhoneNumber: 자동인증 완료 (link 모드)',
                snapshot.code ?? null
              );
              break;
            case 'timeout':
              resolveWithVid(snapshot, 'verifyPhoneNumber: 자동인증 타임아웃, 수동 입력 대기');
              break;
            case 'error': {
              settled.current = true;
              const sdkError = snapshot.error;
              logger.error('verifyPhoneNumber: 인증 실패 (link 모드)', {
                phone: maskValue(e164, 'phone'),
                errorCode: sdkError?.code,
                errorMessage: sdkError?.message,
              });
              reject(new Error(sdkError?.message || '전화번호 인증 요청에 실패했습니다.'));
              break;
            }
          }
        },
        (error: unknown) => {
          if (!settled.current) {
            settled.current = true;
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        }
      );
    } catch (err) {
      if (!settled.current) {
        settled.current = true;
        reject(err);
      }
    }
  });

  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      settled.current = true;
      reject(new Error('인증 요청 시간이 초과되었습니다. 다시 시도해주세요.'));
    }, LISTENER_TIMEOUT_MS);
  });

  return Promise.race([verificationPromise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
    settled.current = true;
    if (listenerRef) {
      listenerRef.removeAllListeners('state_changed');
    }
  });
}

// ============================================================================
// Hook
// ============================================================================

export function usePhoneSMS({
  mode,
  getOrCreateVerifier,
  cleanupOnError,
  onError,
}: UsePhoneSMSOptions): UsePhoneSMSReturn {
  const [phone, setPhone] = useState('');
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationResultLike | null>(null);

  const verificationIdRef = useRef<string | null>(null);
  const lastCheckedPhoneRef = useRef<string | null>(null);
  const phoneListenerSettledRef = useRef<{ current: boolean } | null>(null);
  const phoneListenerRef = useRef<{ removeAllListeners(event: string): void } | null>(null);
  const requestedModeRef = useRef<'signIn' | 'link'>(mode);

  /** 전화번호 입력 핸들러 (자동 포맷팅) */
  const handlePhoneChange = useCallback((text: string) => {
    const cleaned = cleanPhoneNumber(text);
    if (cleaned.length <= 11) {
      setPhone(formatPhoneNumber(cleaned));
    }
  }, []);

  /** 초기값 설정 (뒤로갔다 돌아올 때) */
  const setPhoneWithFormat = useCallback((value: string) => {
    if (value) {
      setPhone(value.startsWith('+82') ? formatE164ToDisplay(value) : formatPhoneNumber(value));
    } else {
      setPhone('');
    }
  }, []);

  /** signIn 모드: signInWithPhoneNumber로 OTP 요청 */
  const requestOtpForSignIn = useCallback(
    async (e164: string): Promise<ConfirmationResultLike> => {
      if (Platform.OS === 'web') {
        const verifier = await getOrCreateVerifier();
        if (!verifier) {
          throw new Error('reCAPTCHA verifier를 생성할 수 없습니다.');
        }
        return webSignInWithPhoneNumber(getFirebaseAuth(), e164, verifier);
      }
      if (!getNativeAuth || !nativeSignInWithPhoneNumber) {
        throw new Error('네이티브 Firebase Auth를 사용할 수 없습니다.');
      }
      return nativeSignInWithPhoneNumber(getNativeAuth(), e164);
    },
    [getOrCreateVerifier]
  );

  /** link 모드: verifyPhoneNumber로 OTP 요청 (기존 세션 보존) */
  const requestOtpForLink = useCallback(
    async (
      e164: string
    ): Promise<{
      autoCompleted: boolean;
      autoOtpData?: { verificationId: string; otpCode: string };
    }> => {
      if (Platform.OS === 'web') {
        const verifier = await getOrCreateVerifier();
        if (!verifier) {
          throw new Error('reCAPTCHA verifier를 생성할 수 없습니다.');
        }
        const phoneProvider = new WebPhoneAuthProvider(getFirebaseAuth());
        const verificationId = await phoneProvider.verifyPhoneNumber(e164, verifier);
        verificationIdRef.current = verificationId;
        setConfirmation(null);
        return { autoCompleted: false };
      }

      // 네이티브 link 모드: 이전 리스너 정리
      if (phoneListenerSettledRef.current) {
        phoneListenerSettledRef.current.current = true;
      }
      if (phoneListenerRef.current) {
        phoneListenerRef.current.removeAllListeners('state_changed');
        phoneListenerRef.current = null;
      }
      const linkResult = await requestVerificationForLink(e164);
      verificationIdRef.current = linkResult.verificationId;
      phoneListenerSettledRef.current = linkResult.settled;
      phoneListenerRef.current = linkResult.listener;
      setConfirmation(null);

      // Android 자동인증: linkWithCredential 대신 otpData를 서버에 전달
      if (linkResult.autoCode) {
        logger.info('Android 자동인증: 서버사이드 검증 모드로 전달', {
          hasAutoCode: true,
        });
        return {
          autoCompleted: true,
          autoOtpData: {
            verificationId: linkResult.verificationId,
            otpCode: linkResult.autoCode,
          },
        };
      }
      return { autoCompleted: false };
    },
    [getOrCreateVerifier]
  );

  /** 인증번호 요청 (SMS 발송) */
  const requestSMS = useCallback(
    async (
      onAutoCompleted: (otpData?: { verificationId: string; otpCode: string }) => void
    ): Promise<'otp' | 'autoCompleted' | null> => {
      const cleaned = cleanPhoneNumber(phone);
      if (!isValidKoreanPhone(cleaned)) {
        setError('올바른 전화번호를 입력해주세요');
        return null;
      }

      // link 모드: Web SDK currentUser만 확인
      // 서버사이드 OTP 검증으로 전환했으므로 Native SDK 상태는 불필요
      if (mode === 'link') {
        const webUser = getFirebaseAuth().currentUser;
        if (!webUser) {
          logger.error('link 모드 SMS 요청 실패: Web SDK 사용자 없음', {
            platform: Platform.OS,
          });
          setError('인증 세션이 만료되었습니다. 앱을 종료하고 다시 소셜 로그인해주세요.');
          return null;
        }
      }

      setIsRequesting(true);
      setError(null);

      try {
        const e164 = toE164(phone);
        logger.info('SMS 인증 요청', {
          phone: maskValue(e164, 'phone'),
          platform: Platform.OS,
          mode,
        });

        // 전화번호 중복 체크 (같은 번호 재발송 시 스킵)
        if (lastCheckedPhoneRef.current !== cleaned) {
          try {
            const exists = await checkPhoneExists(cleaned);
            if (exists) {
              setError(
                mode === 'link'
                  ? '이미 다른 계정에 등록된 전화번호입니다.'
                  : '이미 가입된 전화번호입니다.'
              );
              return null;
            }
            lastCheckedPhoneRef.current = cleaned;
          } catch (checkError) {
            logger.error('전화번호 중복 체크 실패 - SMS 발송 중단', { error: checkError });
            setError('전화번호 확인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
            return null;
          }
        }

        // OTP 요청 시점의 mode 기록
        requestedModeRef.current = mode;

        // 모드별 OTP 요청
        if (mode === 'link') {
          const { autoCompleted, autoOtpData } = await requestOtpForLink(e164);
          if (autoCompleted) {
            onAutoCompleted(autoOtpData);
            return 'autoCompleted';
          }
        } else {
          const result = await requestOtpForSignIn(e164);
          setConfirmation(result);
          const resultWithVid = result as unknown as Record<string, unknown>;
          if (typeof resultWithVid.verificationId === 'string') {
            verificationIdRef.current = resultWithVid.verificationId;
          }
        }

        return 'otp';
      } catch (err) {
        // reCAPTCHA 정리
        if (Platform.OS === 'web') {
          cleanupOnError();
        }
        const firebaseCode = (err as { code?: string })?.code;
        const errorMessage = getFirebasePhoneAuthErrorMessage(err);
        setError(errorMessage);
        onError?.(err instanceof Error ? err : new Error(errorMessage));
        logger.error('SMS 인증 요청 실패', err instanceof Error ? err : new Error(errorMessage), {
          mode,
          firebaseCode: firebaseCode ?? 'unknown',
        });
        return null;
      } finally {
        setIsRequesting(false);
      }
    },
    [phone, mode, requestOtpForSignIn, requestOtpForLink, cleanupOnError, onError]
  );

  /** 상태 초기화 */
  const resetState = useCallback(() => {
    setConfirmation(null);
    verificationIdRef.current = null;
    // lastCheckedPhoneRef는 유지 (같은 번호 재인증 시 중복 체크 스킵)
    if (phoneListenerSettledRef.current) {
      phoneListenerSettledRef.current.current = true;
      phoneListenerSettledRef.current = null;
    }
    if (phoneListenerRef.current) {
      phoneListenerRef.current.removeAllListeners('state_changed');
      phoneListenerRef.current = null;
    }
  }, []);

  // 컴포넌트 언마운트 시 리스너 정리 (메모리 누수 방지)
  useEffect(() => {
    return () => {
      if (phoneListenerSettledRef.current) {
        phoneListenerSettledRef.current.current = true;
        phoneListenerSettledRef.current = null;
      }
      if (phoneListenerRef.current) {
        phoneListenerRef.current.removeAllListeners('state_changed');
        phoneListenerRef.current = null;
      }
    };
  }, []);

  return {
    phone,
    setPhone: setPhoneWithFormat,
    handlePhoneChange,
    isRequesting,
    error,
    setError,
    confirmation,
    verificationIdRef,
    phoneListenerSettledRef,
    phoneListenerRef,
    requestedModeRef,
    requestSMS,
    resetState,
  };
}

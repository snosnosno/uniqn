/**
 * UNIQN Mobile - 전화번호 문자 인증 컴포넌트
 *
 * @description Firebase Phone Auth(SMS OTP) 기반 전화번호 인증
 *
 * [v1.2.0] BUG FIX - 10건 버그 수정
 *  - [C1] 웹 link 모드: signInWithPhoneNumber → PhoneAuthProvider.verifyPhoneNumber (세션 파괴 방지)
 *  - [C2] Native SDK 없을 때 Web SDK fallback (Apple→Phone 교착 해소)
 *  - [H2] reCAPTCHA clear() 호출 + DOM 컨테이너 재생성
 *  - [H5] iOS 개발 모드 reCAPTCHA fallback 안내
 *  - [M1] 리스너 타임아웃 조정 + 재발송 시 상태 초기화
 *  - [M2] onReset 콜백 추가 ("다시 인증하기" 시 부모 상태 동기화)
 *
 * @version 1.2.0
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator, Platform, useColorScheme } from 'react-native';
import {
  signInWithPhoneNumber as webSignInWithPhoneNumber,
  RecaptchaVerifier,
  PhoneAuthProvider as WebPhoneAuthProvider,
  linkWithCredential as webLinkWithCredential,
} from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { ShieldCheckIcon, CheckCircleIcon, XCircleIcon } from '@/components/icons';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { logger } from '@/utils/logger';
import { maskValue } from '@/errors/serviceErrorHandler';
import { formatPhoneNumber, cleanPhoneNumber, toE164, formatE164ToDisplay } from '@/utils/phone';
import { checkPhoneExists } from '@/services/authService';

import {
  getNativeAuth,
  nativeSignInWithPhoneNumber,
  nativeVerifyPhoneNumber,
  NativePhoneAuthProvider,
  nativeLinkWithCredential,
} from '@/lib/nativeAuth';

// ============================================================================
// Types
// ============================================================================

/** 플랫폼 공통 ConfirmationResult 인터페이스 */
interface ConfirmationResultLike {
  confirm(code: string): Promise<unknown>;
}

export interface PhoneVerificationProps {
  /** 인증 완료 콜백 (인증된 전화번호 전달) */
  onVerified: (phone: string) => void;
  /** 인증 초기화 콜백 ("다시 인증하기" 클릭 시 부모 상태 동기화) */
  onReset?: () => void;
  /** 인증 실패 콜백 */
  onError?: (error: Error) => void;
  /** 초기 전화번호 (뒤로갔다 돌아올 때) */
  initialPhone?: string;
  /** 비활성화 */
  disabled?: boolean;
  /** 컴팩트 모드 (헤더/아이콘/설명 숨김) */
  compact?: boolean;
  /** 인증 모드: signIn(기본)=새 계정 생성, link=기존 계정에 전화번호 링크 */
  mode?: 'signIn' | 'link';
}

type VerificationStep = 'input' | 'otp' | 'verified';

// ============================================================================
// Constants
// ============================================================================

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 60; // seconds
/** verifyPhoneNumber auto-verify timeout (Android용, iOS에서는 무시) */
const AUTO_VERIFY_TIMEOUT_SECONDS = 60;

// ============================================================================
// Helpers
// ============================================================================

/** PhoneAuthSnapshot의 state 리터럴 (SDK 타입과 일치) */
type PhoneAuthSnapshotState = 'sent' | 'timeout' | 'verified' | 'error';

/** SDK PhoneAuthSnapshot과 일치하는 타입 (verificationId는 null 가능) */
interface PhoneAuthSnapshotLike {
  state: PhoneAuthSnapshotState;
  verificationId: string | null;
  code?: string | null;
  error?: { code?: string; message?: string } | null;
}

/** PhoneAuthListener 참조를 외부에서 정리할 수 있도록 결과와 함께 반환 */
interface VerificationForLinkResult {
  verificationId: string;
  /** PhoneAuthListener 참조 — 컴포넌트 unmount 시 불필요한 콜백 방지용 */
  settled: { current: boolean };
  /** PhoneAuthListener 참조 — unmount 시 removeAllListeners('state_changed') 호출용 */
  listener: { removeAllListeners(event: string): void } | null;
  /** Android 자동인증 시 SDK가 수신한 OTP 코드 */
  autoCode?: string | null;
}

/**
 * [BUG #1 FIX] link 모드 전용: verifyPhoneNumber를 Promise로 래핑
 *
 * verifyPhoneNumber는 이벤트 기반 PhoneAuthListener를 반환합니다.
 * signInWithPhoneNumber와 달리 현재 로그인 세션을 교체하지 않으므로
 * 기존 Apple/소셜 로그인 세션이 안전하게 유지됩니다.
 *
 * @returns verificationId + settled ref (컴포넌트 unmount 시 settled.current=true로 후속 콜백 차단)
 */
function requestVerificationForLink(e164: string): Promise<VerificationForLinkResult> {
  // [W-1 FIX] Promise.race로 타임아웃 보호 — 이벤트가 발생하지 않으면 UI 영구 멈춤 방지
  // [M1 FIX] 재발송 쿨다운(60초)보다 약간 길게 설정 → 재발송 시 이전 리스너 확실히 종료
  const LISTENER_TIMEOUT_MS = (RESEND_COOLDOWN + 5) * 1000;

  const verificationPromise = new Promise<VerificationForLinkResult>((resolve, reject) => {
    if (!nativeVerifyPhoneNumber || !getNativeAuth) {
      reject(new Error('네이티브 Firebase Auth를 사용할 수 없습니다.'));
      return;
    }

    const settled = { current: false };
    let listenerRef: { removeAllListeners(event: string): void } | null = null;

    /** 공통: verificationId 검증 후 resolve */
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

      // [W-2 FIX] listener 캡처 — unmount 시 removeAllListeners로 구독 해제
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
              // [C-2 FIX] Android 자동인증: snapshot.code를 autoCode로 전달
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
      reject(new Error('인증 요청 시간이 초과되었습니다. 다시 시도해주세요.'));
    }, LISTENER_TIMEOUT_MS);
  });

  return Promise.race([verificationPromise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

// ============================================================================
// Component
// ============================================================================

export const PhoneVerification: React.FC<PhoneVerificationProps> = React.memo(
  ({
    onVerified,
    onReset,
    onError,
    initialPhone = '',
    disabled = false,
    compact = false,
    mode = 'signIn',
  }) => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const [step, setStep] = useState<VerificationStep>(initialPhone ? 'verified' : 'input');
    const [phone, setPhone] = useState(
      initialPhone
        ? initialPhone.startsWith('+82')
          ? formatE164ToDisplay(initialPhone)
          : formatPhoneNumber(initialPhone)
        : ''
    );
    const [otpCode, setOtpCode] = useState('');
    const [otpAttempts, setOtpAttempts] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [timer, setTimer] = useState(0);
    const [confirmation, setConfirmation] = useState<ConfirmationResultLike | null>(null);
    /** [H2 FIX] reCAPTCHA DOM 컨테이너 재생성용 key (에러 후 잔여 iframe 제거) */
    const [recaptchaKey, setRecaptchaKey] = useState(0);

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
    const verificationIdRef = useRef<string | null>(null);
    /** 마지막으로 중복체크한 전화번호 (재발송 시 스킵용) */
    const lastCheckedPhoneRef = useRef<string | null>(null);
    /** [C-1 FIX] PhoneAuthListener 정리용 — settled로 콜백 차단, unsubscribe로 구독 해제 */
    const phoneListenerSettledRef = useRef<{ current: boolean } | null>(null);
    const phoneListenerRef = useRef<{ removeAllListeners(event: string): void } | null>(null);

    // 타이머 관리
    const isTimerActive = timer > 0;
    useEffect(() => {
      if (isTimerActive) {
        timerRef.current = setInterval(() => {
          setTimer((prev) => {
            if (prev <= 1) {
              if (timerRef.current) clearInterval(timerRef.current);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }, [isTimerActive]);

    /** 전화번호 입력 핸들러 (자동 포맷팅) */
    const handlePhoneChange = useCallback((text: string) => {
      const cleaned = cleanPhoneNumber(text);
      if (cleaned.length <= 11) {
        setPhone(formatPhoneNumber(cleaned));
      }
    }, []);

    /** signIn 모드: signInWithPhoneNumber로 OTP 요청 */
    const requestOtpForSignIn = useCallback(
      async (e164: string): Promise<ConfirmationResultLike> => {
        if (Platform.OS === 'web') {
          const auth = getFirebaseAuth();
          if (!recaptchaVerifierRef.current) {
            recaptchaVerifierRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
              size: 'invisible',
            });
          }
          return webSignInWithPhoneNumber(auth, e164, recaptchaVerifierRef.current);
        }
        if (!getNativeAuth || !nativeSignInWithPhoneNumber) {
          throw new Error('네이티브 Firebase Auth를 사용할 수 없습니다.');
        }
        return nativeSignInWithPhoneNumber(getNativeAuth(), e164);
      },
      []
    );

    /** link 모드: verifyPhoneNumber로 OTP 요청 (기존 세션 보존) */
    const requestOtpForLink = useCallback(
      async (e164: string): Promise<{ autoCompleted: boolean }> => {
        if (Platform.OS === 'web') {
          const auth = getFirebaseAuth();
          if (!recaptchaVerifierRef.current) {
            recaptchaVerifierRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
              size: 'invisible',
            });
          }
          const phoneProvider = new WebPhoneAuthProvider(auth);
          const verificationId = await phoneProvider.verifyPhoneNumber(
            e164,
            recaptchaVerifierRef.current
          );
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

        // Android 자동인증 처리
        if (
          linkResult.autoCode &&
          NativePhoneAuthProvider &&
          nativeLinkWithCredential &&
          getNativeAuth
        ) {
          const nativeUser = getNativeAuth().currentUser;
          if (nativeUser) {
            try {
              const credential = NativePhoneAuthProvider.credential(
                linkResult.verificationId,
                linkResult.autoCode
              );
              await nativeLinkWithCredential(nativeUser, credential);
              logger.info('Android 자동인증: linkWithCredential 성공', { uid: nativeUser.uid });
              return { autoCompleted: true };
            } catch (autoLinkErr) {
              logger.warn('Android 자동인증 linkWithCredential 실패, 수동 입력 전환', {
                error: autoLinkErr,
              });
            }
          }
        }
        return { autoCompleted: false };
      },
      []
    );

    /** 인증번호 요청 */
    const handleRequestOTP = useCallback(async () => {
      const cleaned = cleanPhoneNumber(phone);
      if (cleaned.length < 10 || cleaned.length > 11) {
        setError('올바른 전화번호를 입력해주세요');
        return;
      }

      // link 모드: currentUser 사전 검증
      if (mode === 'link' && Platform.OS !== 'web') {
        const nativeUser = getNativeAuth?.()?.currentUser;
        const webUser = getFirebaseAuth().currentUser;
        if (!nativeUser && !webUser) {
          logger.error('link 모드 SMS 요청 실패: 양쪽 SDK 모두 사용자 없음', {
            platform: Platform.OS,
          });
          setError('인증 세션이 만료되었습니다. 앱을 종료하고 다시 소셜 로그인해주세요.');
          return;
        }
        // Native만 인증됨 — 이후 CF 호출 시 Web SDK 인증 토큰 부재로 실패
        if (nativeUser && !webUser) {
          logger.warn('link 모드 SMS 요청 실패: Native SDK만 인증됨 (Web SDK 없음)', {
            platform: Platform.OS,
            nativeUid: nativeUser.uid,
          });
          setError('인증 상태가 불완전합니다. 앱을 종료하고 다시 소셜 로그인해주세요.');
          return;
        }
      }

      setIsLoading(true);
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
              setIsLoading(false);
              return;
            }
            lastCheckedPhoneRef.current = cleaned;
          } catch (checkError) {
            logger.error('전화번호 중복 체크 실패 - SMS 발송 중단', { error: checkError });
            setError('전화번호 확인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
            setIsLoading(false);
            return;
          }
        }

        // 모드별 OTP 요청
        if (mode === 'link') {
          const { autoCompleted } = await requestOtpForLink(e164);
          if (autoCompleted) {
            setStep('verified');
            onVerified(toE164(phone));
            setIsLoading(false);
            return;
          }
        } else {
          const result = await requestOtpForSignIn(e164);
          setConfirmation(result);
          if ('verificationId' in result) {
            verificationIdRef.current = (result as { verificationId: string }).verificationId;
          }
        }

        // 공통 후처리
        setStep('otp');
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setTimer(RESEND_COOLDOWN);
        setOtpCode('');
        // OTP 시도 횟수 유지 (재발송 시 리셋하지 않음 — 세션 내 브루트포스 방지)
      } catch (err) {
        // reCAPTCHA 정리
        if (Platform.OS === 'web') {
          if (recaptchaVerifierRef.current) {
            try {
              recaptchaVerifierRef.current.clear();
            } catch {
              // clear 실패 무시
            }
            recaptchaVerifierRef.current = null;
          }
          setRecaptchaKey((prev) => prev + 1);
        }
        const errorMessage = getFirebasePhoneAuthErrorMessage(err);
        setError(errorMessage);
        onError?.(err instanceof Error ? err : new Error(errorMessage));
        logger.error('SMS 인증 요청 실패', {
          error: err,
          mode,
          firebaseCode: (err as { code?: string })?.code ?? 'unknown',
        });
      } finally {
        setIsLoading(false);
      }
    }, [phone, onError, onVerified, mode, step, requestOtpForSignIn, requestOtpForLink]);

    const MAX_OTP_ATTEMPTS = 5;

    /** OTP 코드 확인 */
    const handleConfirmOTP = useCallback(async () => {
      // [M7] OTP 시도 횟수 제한
      if (otpAttempts >= MAX_OTP_ATTEMPTS) {
        setError('인증번호 입력 횟수를 초과했습니다. 인증번호를 다시 요청해주세요.');
        setStep('input');
        setOtpAttempts(0);
        setOtpCode('');
        return;
      }

      // ─── [BUG #3 FIX] link 모드에서 verificationId 필수 검증 ───
      if (mode === 'link') {
        if (!verificationIdRef.current) {
          logger.error('link 모드 OTP 확인 실패: verificationId 없음', {
            hasConfirmation: !!confirmation,
          });
          setError('인증 세션이 만료되었습니다. 인증번호를 다시 요청해주세요.');
          setStep('input');
          return;
        }
      } else if (!confirmation) {
        setError('인증 세션이 만료되었습니다. 다시 시도해주세요.');
        setStep('input');
        return;
      }

      if (otpCode.length !== OTP_LENGTH) {
        setError(`인증번호 ${OTP_LENGTH}자리를 입력해주세요`);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        if (mode === 'link') {
          // ─── link 모드: PhoneAuthProvider.credential + linkWithCredential ───
          const vid = verificationIdRef.current;
          if (!vid) {
            throw new Error('인증 세션이 만료되었습니다. 인증번호를 다시 요청해주세요.');
          }

          // TOCTOU 방지: link 직전 전화번호 중복 재검증
          // signIn 모드는 이미 phone-only 계정을 보유하므로 재검증 불가 (CF Transaction이 최종 보호)
          try {
            const phoneStillAvailable = !(await checkPhoneExists(cleanPhoneNumber(phone)));
            if (!phoneStillAvailable) {
              setError('이미 다른 계정에 등록된 전화번호입니다. 다시 확인해주세요.');
              setIsLoading(false);
              return;
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
              // [C2 FIX] Native SDK 없음 → Web SDK fallback (Apple 로그인 후 Native sync 실패 시)
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

        setStep('verified');
        onVerified(toE164(phone));
        logger.info('SMS 인증 완료', { phone: maskValue(phone, 'phone'), mode });
      } catch (err) {
        // ─── 디버깅 강화: Firebase 에러 코드 명시적 로깅 ───
        const firebaseCode = (err as { code?: string })?.code;
        const errorMessage = firebaseCode
          ? getFirebaseOTPErrorMessage(err)
          : err instanceof Error
            ? err.message
            : '인증에 실패했습니다. 다시 시도해주세요.';
        setError(errorMessage);
        setOtpAttempts((prev) => prev + 1);
        onError?.(err instanceof Error ? err : new Error(errorMessage));
        logger.error('OTP 확인 실패', {
          error: err,
          mode,
          firebaseCode: firebaseCode ?? 'non-firebase-error',
          errorMessage: err instanceof Error ? err.message : String(err),
          hasNativeUser: Platform.OS !== 'web' ? !!getNativeAuth?.()?.currentUser : undefined,
          hasWebUser: !!getFirebaseAuth().currentUser,
          hasVerificationId: !!verificationIdRef.current,
        });
      } finally {
        setIsLoading(false);
      }
    }, [confirmation, otpCode, phone, onVerified, onError, mode, otpAttempts]);

    // reCAPTCHA + PhoneAuthListener cleanup on unmount
    useEffect(() => {
      return () => {
        if (recaptchaVerifierRef.current) {
          recaptchaVerifierRef.current.clear();
          recaptchaVerifierRef.current = null;
        }
        // [C-1 FIX] PhoneAuthListener 콜백 차단 + 구독 해제
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

    /** 재인증 (초기화) */
    const handleReset = useCallback(() => {
      setStep('input');
      setOtpCode('');
      setOtpAttempts(0);
      setError(null);
      setConfirmation(null);
      setTimer(0);
      verificationIdRef.current = null;
      if (recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current.clear();
        recaptchaVerifierRef.current = null;
      }
      // PhoneAuthListener 정리
      if (phoneListenerSettledRef.current) {
        phoneListenerSettledRef.current.current = true;
        phoneListenerSettledRef.current = null;
      }
      if (phoneListenerRef.current) {
        phoneListenerRef.current.removeAllListeners('state_changed');
        phoneListenerRef.current = null;
      }
      lastCheckedPhoneRef.current = null;
      // [M2 FIX] 부모 컴포넌트에 인증 해제 알림 (verifiedPhone 상태 동기화)
      onReset?.();
    }, [onReset]);

    // ========== 인증 완료 상태 ==========
    if (step === 'verified') {
      return (
        <View className="w-full">
          {!compact && (
            <View className="items-center mb-6">
              <View className="w-16 h-16 bg-success-100 dark:bg-success-900/30 rounded-full items-center justify-center mb-3">
                <CheckCircleIcon size={32} color="#22c55e" />
              </View>
              <Text className="text-xl font-bold text-gray-900 dark:text-white">문자인증 완료</Text>
            </View>
          )}

          <View
            className="rounded-xl p-4 border"
            style={{
              backgroundColor: isDark ? '#1f2937' : '#f0fdf4',
              borderColor: isDark ? '#166534' : '#bbf7d0',
            }}
          >
            <View className="flex-row items-center mb-3">
              <CheckCircleIcon size={20} color="#22c55e" />
              <Text className="ml-2 text-success-700 dark:text-success-400 font-semibold">
                인증 완료
              </Text>
            </View>
            <View
              className="rounded-lg p-3"
              style={{ backgroundColor: isDark ? '#374151' : '#ffffff' }}
            >
              <View className="flex-row justify-between">
                <Text className="text-gray-500 dark:text-gray-400 text-sm">휴대폰</Text>
                <Text className="text-gray-900 dark:text-white font-medium">{phone}</Text>
              </View>
            </View>
            <Pressable onPress={handleReset} className="mt-4 py-2 items-center">
              <Text className="text-sm text-gray-500 dark:text-gray-400 underline">
                다시 인증하기
              </Text>
            </Pressable>
          </View>
        </View>
      );
    }

    // ========== 전화번호 입력 + OTP 입력 ==========
    return (
      <View className="w-full">
        {/* 헤더 */}
        {!compact && (
          <View className="items-center mb-6">
            <View className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full items-center justify-center mb-3">
              <ShieldCheckIcon size={32} color="#6366f1" />
            </View>
            <Text className="text-xl font-bold text-gray-900 dark:text-white">문자인증</Text>
            <Text className="text-sm text-gray-500 dark:text-gray-400 text-center mt-1">
              안전한 서비스 이용을 위해 전화번호 인증이 필요합니다.
            </Text>
          </View>
        )}

        {/* 전화번호 입력 */}
        <View className="flex-col gap-3">
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Input
                placeholder="010-0000-0000"
                value={phone}
                onChangeText={handlePhoneChange}
                keyboardType="phone-pad"
                maxLength={13}
                editable={step === 'input' && !disabled && !isLoading}
                accessibilityLabel="전화번호 입력"
              />
            </View>
            <Button
              onPress={handleRequestOTP}
              disabled={
                disabled ||
                isLoading ||
                cleanPhoneNumber(phone).length < 10 ||
                (step === 'otp' && timer > 0)
              }
              variant={step === 'otp' ? 'outline' : 'primary'}
              className="min-w-[100px]"
            >
              {isLoading && step === 'input' ? (
                <ActivityIndicator color="white" size="small" />
              ) : step === 'otp' && timer > 0 ? (
                `${timer}초`
              ) : step === 'otp' ? (
                '재발송'
              ) : (
                '인증요청'
              )}
            </Button>
          </View>

          {/* OTP 입력 */}
          {step === 'otp' && (
            <View className="flex-col gap-3 mt-2">
              <Text className="text-sm text-gray-600 dark:text-gray-300">
                인증번호가 발송되었습니다. 수신까지 최대 1분 소요될 수 있습니다.
              </Text>
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Input
                    autoFocus
                    placeholder="인증번호 6자리"
                    value={otpCode}
                    onChangeText={(text) =>
                      setOtpCode(text.replace(/\D/g, '').slice(0, OTP_LENGTH))
                    }
                    keyboardType="number-pad"
                    maxLength={OTP_LENGTH}
                    editable={!disabled && !isLoading}
                    accessibilityLabel="인증번호 입력"
                    textContentType="oneTimeCode"
                    autoComplete="one-time-code"
                  />
                </View>
                <Button
                  onPress={handleConfirmOTP}
                  disabled={disabled || isLoading || otpCode.length !== OTP_LENGTH}
                  className="min-w-[100px]"
                >
                  {isLoading ? <ActivityIndicator color="white" size="small" /> : '확인'}
                </Button>
              </View>
            </View>
          )}
        </View>

        {/* 에러 메시지 */}
        {error && (
          <View className="flex-row items-center bg-error-50 dark:bg-error-900/20 rounded-lg p-3 mt-4">
            <XCircleIcon size={18} color="#ef4444" />
            <Text className="ml-2 text-error-600 dark:text-error-400 text-sm flex-1">{error}</Text>
          </View>
        )}

        {/* 개발 모드 안내 */}
        {__DEV__ && (
          <View className="items-center mt-4 gap-1">
            <View className="flex-row items-center justify-center">
              <View className="w-2 h-2 bg-yellow-500 rounded-full mr-2" />
              <Text className="text-xs text-gray-400 dark:text-gray-500">
                개발 모드: Firebase Console 테스트 번호를 사용하세요
              </Text>
            </View>
            {/* [H5] iOS 시뮬레이터에서 APNs 미작동 시 reCAPTCHA 표시 안내 */}
            {Platform.OS === 'ios' && (
              <Text className="text-xs text-gray-400 dark:text-gray-500">
                시뮬레이터: reCAPTCHA 인증이 표시될 수 있습니다
              </Text>
            )}
          </View>
        )}

        {/* 안내 문구 */}
        {step === 'input' && !compact && (
          <View className="mt-6">
            <Text className="text-xs text-gray-400 dark:text-gray-500 text-center">
              전화번호 인증 정보는 회원 확인 용도로만 사용되며,{'\n'}
              안전하게 보호됩니다.
            </Text>
          </View>
        )}

        {/* [H2 FIX] 웹용 invisible reCAPTCHA 컨테이너 (key로 에러 후 DOM 재생성) */}
        {Platform.OS === 'web' && (
          <View nativeID="recaptcha-container" key={`recaptcha-${recaptchaKey}`} />
        )}
      </View>
    );
  }
);

PhoneVerification.displayName = 'PhoneVerification';

// ============================================================================
// Error Helpers
// ============================================================================

function getFirebasePhoneAuthErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code;
  switch (code) {
    case 'auth/invalid-phone-number':
      return '올바른 전화번호 형식이 아닙니다.';
    case 'auth/too-many-requests':
      return '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.';
    case 'auth/quota-exceeded':
      return '일일 SMS 발송 한도를 초과했습니다.';
    case 'auth/missing-phone-number':
      return '전화번호를 입력해주세요.';
    case 'auth/network-request-failed':
      return '네트워크 연결을 확인해주세요.';
    default:
      return '인증번호 발송에 실패했습니다. 다시 시도해주세요.';
  }
}

function getFirebaseOTPErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code;
  switch (code) {
    case 'auth/invalid-verification-code':
      return '인증번호가 올바르지 않습니다.';
    case 'auth/session-expired':
      return '인증 시간이 만료되었습니다. 다시 요청해주세요.';
    case 'auth/code-expired':
      return '인증번호가 만료되었습니다. 다시 요청해주세요.';
    case 'auth/credential-already-in-use':
      return '이미 다른 계정에 등록된 전화번호입니다.';
    case 'auth/provider-already-linked':
      return '이미 전화번호가 연결되어 있습니다.';
    case 'auth/requires-recent-login':
      return '보안을 위해 다시 로그인이 필요합니다.';
    default:
      return '인증에 실패했습니다. 다시 시도해주세요.';
  }
}

export default PhoneVerification;

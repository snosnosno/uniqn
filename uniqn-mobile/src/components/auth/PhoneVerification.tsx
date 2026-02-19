/**
 * UNIQN Mobile - 전화번호 문자 인증 컴포넌트
 *
 * @description Firebase Phone Auth(SMS OTP) 기반 전화번호 인증
 *
 * [v1.1.0] BUG FIX - 소셜로그인 후 인증 실패 수정
 *  - BUG #1: link 모드에서 signInWithPhoneNumber → verifyPhoneNumber 전환
 *  - BUG #2: Native SDK currentUser null 감지 및 사전 차단
 *  - BUG #3: link 모드에서 confirm() fallback 차단
 *  - 디버깅: OTP 실패 시 Firebase 에러 코드 명시적 로깅
 *
 * @version 1.1.0
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, Pressable, ActivityIndicator, Platform, useColorScheme } from 'react-native';
import {
  signInWithPhoneNumber as webSignInWithPhoneNumber,
  RecaptchaVerifier,
  PhoneAuthProvider as WebPhoneAuthProvider,
  linkWithCredential as webLinkWithCredential,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { getFirebaseAuth, getFirebaseFunctions } from '@/lib/firebase';
import { ShieldCheckIcon, CheckCircleIcon, XCircleIcon } from '@/components/icons';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { logger } from '@/utils/logger';
import { maskValue } from '@/errors/serviceErrorHandler';

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
const COUNTRY_CODE = '+82';
/** verifyPhoneNumber auto-verify timeout (Android용, iOS에서는 무시) */
const AUTO_VERIFY_TIMEOUT_SECONDS = 60;

// ============================================================================
// Helpers
// ============================================================================

/** 전화번호 포맷팅 (010-1234-5678) */
function formatPhoneNumber(value: string): string {
  const cleaned = value.replace(/\D/g, '');
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 7) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7, 11)}`;
}

/** 전화번호에서 숫자만 추출 */
function cleanPhoneNumber(value: string): string {
  return value.replace(/\D/g, '');
}

/** 한국 전화번호를 E.164 형식으로 변환 (010... → +8210...) */
function toE164(phone: string): string {
  const cleaned = cleanPhoneNumber(phone);
  // 010으로 시작하면 0 제거
  const withoutLeadingZero = cleaned.startsWith('0') ? cleaned.slice(1) : cleaned;
  return `${COUNTRY_CODE}${withoutLeadingZero}`;
}

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
  const LISTENER_TIMEOUT_MS = (AUTO_VERIFY_TIMEOUT_SECONDS + 15) * 1000;

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

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error('인증 요청 시간이 초과되었습니다. 다시 시도해주세요.'));
    }, LISTENER_TIMEOUT_MS);
  });

  return Promise.race([verificationPromise, timeoutPromise]);
}

// ============================================================================
// Component
// ============================================================================

export const PhoneVerification: React.FC<PhoneVerificationProps> = React.memo(
  ({
    onVerified,
    onError,
    initialPhone = '',
    disabled = false,
    compact = false,
    mode = 'signIn',
  }) => {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const [step, setStep] = useState<VerificationStep>(initialPhone ? 'verified' : 'input');
    const [phone, setPhone] = useState(initialPhone ? formatPhoneNumber(initialPhone) : '');
    const [otpCode, setOtpCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [timer, setTimer] = useState(0);
    const [confirmation, setConfirmation] = useState<ConfirmationResultLike | null>(null);

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
    const verificationIdRef = useRef<string | null>(null);
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

    /** 인증번호 요청 */
    const handleRequestOTP = useCallback(async () => {
      const cleaned = cleanPhoneNumber(phone);
      if (cleaned.length < 10 || cleaned.length > 11) {
        setError('올바른 전화번호를 입력해주세요');
        return;
      }

      // ─── [BUG #2 FIX] link 모드: Native SDK currentUser 사전 검증 ───
      if (mode === 'link' && Platform.OS !== 'web') {
        const nativeUser = getNativeAuth?.()?.currentUser;
        if (!nativeUser) {
          logger.error('link 모드 SMS 요청 실패: Native SDK에 로그인된 사용자 없음', {
            platform: Platform.OS,
            webUser: !!getFirebaseAuth().currentUser,
          });
          setError('인증 세션이 만료되었습니다. 앱을 종료하고 다시 소셜 로그인해주세요.');
          return;
        }
        logger.info('link 모드: Native SDK currentUser 확인됨', {
          uid: nativeUser.uid,
        });
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

        // 전화번호 중복 체크 (SMS 발송 전)
        try {
          const functions = getFirebaseFunctions();
          const checkPhone = httpsCallable<{ phone: string }, { exists: boolean }>(
            functions,
            'checkPhoneExists'
          );
          const checkResult = await checkPhone({ phone: cleaned });
          if (checkResult.data.exists) {
            setError(
              mode === 'link'
                ? '이미 다른 계정에 등록된 전화번호입니다.'
                : '이미 가입된 전화번호입니다.'
            );
            setIsLoading(false);
            return;
          }
        } catch (checkError) {
          // 중복 체크 실패 시 SMS 발송 중단 (중복 계정 생성 및 SMS 비용 낭비 방지)
          logger.error('전화번호 중복 체크 실패 - SMS 발송 중단', { error: checkError });
          setError('전화번호 확인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
          setIsLoading(false);
          return;
        }

        // ─── [BUG #1 FIX] 모드별 분기: link → verifyPhoneNumber, signIn → signInWithPhoneNumber ───
        if (mode === 'link') {
          // link 모드: verifyPhoneNumber 사용 (현재 세션 교체 방지)
          if (Platform.OS === 'web') {
            // 웹 link 모드: signInWithPhoneNumber로 verificationId 추출
            const auth = getFirebaseAuth();
            if (!recaptchaVerifierRef.current) {
              recaptchaVerifierRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
                size: 'invisible',
              });
            }
            const result = await webSignInWithPhoneNumber(auth, e164, recaptchaVerifierRef.current);
            // 웹에서는 ConfirmationResult에서 verificationId 추출
            if ('verificationId' in result) {
              verificationIdRef.current = (result as { verificationId: string }).verificationId;
            }
            setConfirmation(result);
          } else {
            // 네이티브 link 모드: verifyPhoneNumber 사용 (세션 안전)
            // 이전 리스너가 있으면 정리
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
            // link 모드에서는 confirmation 불필요 (confirm() 사용 안 함)
            setConfirmation(null);

            // [C-2 FIX] Android 자동인증 완료 시 OTP 코드가 있으면 자동으로 linkWithCredential 실행
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
                  logger.info('Android 자동인증: linkWithCredential 성공', {
                    uid: nativeUser.uid,
                  });
                  setStep('verified');
                  onVerified(phone);
                  setIsLoading(false);
                  return; // 자동 완료 — OTP 입력 화면 스킵
                } catch (autoLinkErr) {
                  // 자동 링크 실패 시 수동 OTP 입력으로 fallback
                  logger.warn('Android 자동인증 linkWithCredential 실패, 수동 입력 전환', {
                    error: autoLinkErr,
                  });
                }
              }
            }
          }
        } else {
          // signIn 모드: 기존 signInWithPhoneNumber 사용
          let result: ConfirmationResultLike;

          if (Platform.OS === 'web') {
            const auth = getFirebaseAuth();
            if (!recaptchaVerifierRef.current) {
              recaptchaVerifierRef.current = new RecaptchaVerifier(auth, 'recaptcha-container', {
                size: 'invisible',
              });
            }
            result = await webSignInWithPhoneNumber(auth, e164, recaptchaVerifierRef.current);
          } else {
            if (!getNativeAuth || !nativeSignInWithPhoneNumber) {
              throw new Error('네이티브 Firebase Auth를 사용할 수 없습니다.');
            }
            result = await nativeSignInWithPhoneNumber(getNativeAuth(), e164);
          }

          setConfirmation(result);
          // signIn 모드에서도 verificationId 백업 (fallback 대비)
          if ('verificationId' in result) {
            verificationIdRef.current = (result as { verificationId: string }).verificationId;
          }
        }

        setStep('otp');
        // 기존 타이머 명시적 정리 후 리셋 (재발송 시 경쟁 조건 방지)
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setTimer(RESEND_COOLDOWN);
        setOtpCode('');
      } catch (err) {
        // reCAPTCHA 인스턴스 초기화 (재시도 대비)
        if (Platform.OS === 'web') {
          recaptchaVerifierRef.current = null;
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
    }, [phone, onError, onVerified, mode]);

    /** OTP 코드 확인 */
    const handleConfirmOTP = useCallback(async () => {
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
          if (
            Platform.OS !== 'web' &&
            NativePhoneAuthProvider &&
            nativeLinkWithCredential &&
            getNativeAuth
          ) {
            // [BUG #2 FIX] link 전 currentUser 재확인
            const nativeUser = getNativeAuth().currentUser;
            if (!nativeUser) {
              logger.error('link 모드 OTP 확인 실패: Native SDK currentUser null', {
                webUser: !!getFirebaseAuth().currentUser,
                verificationId: !!verificationIdRef.current,
              });
              throw new Error(
                '인증 세션이 만료되었습니다. 앱을 종료하고 다시 소셜 로그인해주세요.'
              );
            }

            // [W-5 FIX] 지역 변수 캡처 (non-null assertion 제거)
            const vid = verificationIdRef.current;
            if (!vid) {
              throw new Error('인증 세션이 만료되었습니다. 인증번호를 다시 요청해주세요.');
            }
            const credential = NativePhoneAuthProvider.credential(vid, otpCode);
            logger.info('link 모드: linkWithCredential 시도', {
              uid: nativeUser.uid,
            });
            await nativeLinkWithCredential(nativeUser, credential);
          } else {
            // 웹 플랫폼 link 모드
            if (!verificationIdRef.current) {
              throw new Error('인증 세션이 만료되었습니다. 다시 시도해주세요.');
            }
            const credential = WebPhoneAuthProvider.credential(verificationIdRef.current, otpCode);
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
        onVerified(phone);
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
    }, [confirmation, otpCode, phone, onVerified, onError, mode]);

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
    }, []);

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
                인증번호가 발송되었습니다. 60초 내에 입력해주세요.
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
          <View className="flex-row items-center justify-center mt-4">
            <View className="w-2 h-2 bg-yellow-500 rounded-full mr-2" />
            <Text className="text-xs text-gray-400 dark:text-gray-500">
              개발 모드: Firebase Console 테스트 번호를 사용하세요
            </Text>
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

        {/* 웹용 invisible reCAPTCHA 컨테이너 */}
        {Platform.OS === 'web' && <View nativeID="recaptcha-container" />}
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

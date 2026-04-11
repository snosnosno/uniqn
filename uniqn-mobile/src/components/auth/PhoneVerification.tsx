/**
 * UNIQN Mobile - 전화번호 문자 인증 컴포넌트
 *
 * @description Firebase Phone Auth(SMS OTP) 기반 전화번호 인증
 * @version 2.0.0
 *
 * 로직은 3개 훅으로 분리:
 * - useRecaptcha: reCAPTCHA verifier 관리 (웹 전용)
 * - usePhoneSMS: 전화번호 입력, SMS 발송, 중복 체크
 * - useOTPVerification: OTP 입력, 확인, 시도 횟수 제한
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, ActivityIndicator, Platform } from 'react-native';
import { ShieldCheckIcon, XCircleIcon } from '@/components/icons';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { cleanPhoneNumber, toE164 } from '@/utils/phone';
import { PhoneVerifiedView } from './PhoneVerifiedView';
import { useOTPVerification } from '@/hooks/auth/useOTPVerification';
// useRecaptcha and usePhoneSMS removed - phone SMS auth replaced by PortOne identity verification
// TODO: This component needs to be updated to use PortOne identity verification flow

/** @deprecated Stub - phone SMS auth replaced by PortOne identity verification */
function useRecaptcha(_onError?: (msg: string) => void) {
  return {
    recaptchaKey: 0,
    getOrCreateVerifier: () => null,
    cleanupOnError: () => {},
  };
}

/** @deprecated Stub - phone SMS auth replaced by PortOne identity verification */
function usePhoneSMS(_options: Record<string, unknown>) {
  return {
    phone: '',
    setPhone: (_v: string) => {},
    isLoading: false,
    isRequesting: false,
    error: null,
    setError: (_v: string | null) => {},
    confirmation: null,
    sendSMS: async () => {},
    requestSMS: async (_otpData?: unknown): Promise<string | void> => {},
    checkPhoneDuplicate: async () => false,
    cleanup: () => {},
    resetState: () => {},
    handlePhoneChange: (_v: string) => {},
    verificationIdRef: { current: null },
    requestedModeRef: { current: 'signIn' as const },
  };
}

// ============================================================================
// Types
// ============================================================================

export interface PhoneVerificationProps {
  /** 인증 완료 콜백 (인증된 전화번호 + 서버사이드 OTP 검증 데이터 전달) */
  onVerified: (phone: string, otpData?: { verificationId: string; otpCode: string }) => void;
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
const RESEND_COOLDOWN = 60;

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
    const [step, setStep] = useState<VerificationStep>(initialPhone ? 'verified' : 'input');
    const [timer, setTimer] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ─── Hooks ───
    const { recaptchaKey, getOrCreateVerifier, cleanupOnError } = useRecaptcha((msg) =>
      smsHook.setError(msg)
    );

    const smsHook = usePhoneSMS({
      mode,
      getOrCreateVerifier,
      cleanupOnError,
      onError,
    });

    const otpHook = useOTPVerification({
      mode,
      confirmation: smsHook.confirmation,
      verificationIdRef: smsHook.verificationIdRef,
      requestedModeRef: smsHook.requestedModeRef,
      clearVerificationState: smsHook.resetState,
      phone: smsHook.phone,
      onVerified,
      onError,
    });

    // 초기 전화번호 설정
    useEffect(() => {
      if (initialPhone) {
        smsHook.setPhone(initialPhone);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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

    // PhoneAuthListener cleanup은 usePhoneSMS 훅이 전담 (소유권 단일화)

    /** 인증번호 요청 */
    const handleRequestOTP = useCallback(async () => {
      otpHook.setError(null);
      const result = await smsHook.requestSMS(
        (otpData: { verificationId: string; otpCode: string } | undefined) => {
          // auto-completed callback (Android 자동인증)
          setStep('verified');
          onVerified(toE164(smsHook.phone), otpData);
        }
      );

      if (result === 'otp') {
        setStep('otp');
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setTimer(RESEND_COOLDOWN);
        otpHook.resetOTP();
      }
    }, [smsHook, otpHook, onVerified]);

    /** 전화번호 수정 */
    const handleEditPhone = useCallback(() => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setTimer(0);
      smsHook.resetState();
      smsHook.setError(null);
      otpHook.resetOTP();
      setStep('input');
    }, [smsHook, otpHook]);

    /** OTP 코드 확인 */
    const handleConfirmOTP = useCallback(async () => {
      const result = await otpHook.confirmOTP();
      if (result.status === 'verified') {
        setStep('verified');
        return;
      }

      if (result.status === 'expired') {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setTimer(0);
        return;
      }

      if (result.status === 'reset') {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setTimer(0);
        smsHook.setError(result.message ?? null);
        otpHook.setError(null);
        setStep('input');
      }
    }, [otpHook, smsHook]);

    // 통합 에러 (SMS 또는 OTP)
    const displayError = step === 'otp' ? (otpHook.error ?? smsHook.error) : smsHook.error;
    const isLoading = smsHook.isRequesting || otpHook.isVerifying;

    // ========== 인증 완료 상태 ==========
    if (step === 'verified') {
      return <PhoneVerifiedView phone={smsHook.phone} compact={compact} />;
    }

    // ========== 전화번호 입력 + OTP 입력 ==========
    return (
      <View className="w-full">
        {/* 헤더 */}
        {!compact && (
          <View className="items-center mb-6">
            <View className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-sm items-center justify-center mb-3">
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
                value={smsHook.phone}
                onChangeText={smsHook.handlePhoneChange}
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
                cleanPhoneNumber(smsHook.phone).length < 10 ||
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
                {'\n'}문자가 늦게 도착했거나 만료되면 상단의 다시 요청 버튼으로 새 번호를
                받아주세요.
              </Text>
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Input
                    autoFocus
                    placeholder="인증번호 6자리"
                    value={otpHook.otpCode}
                    onChangeText={otpHook.setOtpCode}
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
                  disabled={disabled || isLoading || otpHook.otpCode.length !== OTP_LENGTH}
                  className="min-w-[100px]"
                >
                  {isLoading ? <ActivityIndicator color="white" size="small" /> : '확인'}
                </Button>
              </View>
              <Button
                onPress={handleEditPhone}
                variant="ghost"
                size="sm"
                className="self-start px-0"
              >
                전화번호 수정
              </Button>
            </View>
          )}
        </View>

        {/* 에러 메시지 */}
        {displayError && (
          <View className="flex-row items-center bg-error-50 dark:bg-error-900/20 rounded-lg p-3 mt-4">
            <XCircleIcon size={18} color="#ef4444" />
            <Text className="ml-2 text-error-600 dark:text-error-400 text-sm flex-1">
              {displayError}
            </Text>
          </View>
        )}

        {/* 개발 모드 안내 */}
        {__DEV__ && (
          <View className="items-center mt-4 gap-1">
            <View className="flex-row items-center justify-center">
              <View className="w-2 h-2 bg-yellow-500 rounded-sm mr-2" />
              <Text className="text-xs text-gray-400 dark:text-gray-500">
                개발 모드: Firebase Console 테스트 번호를 사용하세요
              </Text>
            </View>
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

        {/* 웹용 invisible reCAPTCHA 컨테이너 */}
        {Platform.OS === 'web' && (
          <View nativeID="recaptcha-container" key={`recaptcha-${recaptchaKey}`} />
        )}
      </View>
    );
  }
);

PhoneVerification.displayName = 'PhoneVerification';

export default PhoneVerification;

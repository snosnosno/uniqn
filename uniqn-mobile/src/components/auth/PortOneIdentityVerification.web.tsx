import React, { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, View, Text } from 'react-native';
import { confirmAction } from '@/utils/confirmAction';
import { STATUS_COLORS } from '@/constants/colors';
import { requestIdentityVerification } from '@portone/browser-sdk/v2';
import {
  CheckCircleIcon,
  ClockIcon,
  LockIcon,
  ShieldCheckIcon,
  XCircleIcon,
} from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { useIsMounted } from '@/hooks/useIsMounted';
import { extractUserMessage } from '@/errors';
import {
  type PortOneInicisIdentityRequest,
  type VerifiedPortOneIdentity,
  buildPortOneInicisIdentityRequest,
  callVerifyPortOneIdentity,
  clearPendingPortOneIdentityRequest,
  savePendingPortOneIdentityRequest,
  savePortOneIdentityBindingToken,
} from '@/services/auth/portOneIdentityService';
import { formatBirthDate, formatGenderLabel } from '@/utils/formatters';
import { logger } from '@/utils/logger';

export interface PortOneIdentityVerificationProps {
  onVerified: (identity: VerifiedPortOneIdentity) => void;
  onError?: (error: Error) => void;
  initialIdentity?: VerifiedPortOneIdentity | null;
  disabled?: boolean;
  customerId?: string;
  customerFullName?: string;
  customerPhoneNumber?: string;
}

export function PortOneIdentityVerification({
  onVerified,
  onError,
  initialIdentity = null,
  disabled = false,
  customerId,
  customerFullName,
  customerPhoneNumber,
}: PortOneIdentityVerificationProps) {
  const isMountedRef = useIsMounted();
  const [verifiedIdentity, setVerifiedIdentity] = useState<VerifiedPortOneIdentity | null>(
    initialIdentity
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    setVerifiedIdentity(initialIdentity);
  }, [initialIdentity]);

  // B15: 에러 메시지 5초 후 자동 dismiss. stale 메시지 carry-over 방지.
  useEffect(() => {
    if (!errorMessage) return;
    const timer = setTimeout(() => {
      if (isMountedRef.current) setErrorMessage(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [errorMessage, isMountedRef]);

  const handleVerificationFailure = useCallback(
    (error: unknown, fallbackMessage?: string) => {
      // cleanup은 startVerification의 finally 블록에서 담당
      // A11: unmount 후 setState 차단 (onError 콜백은 caller 가 mount/unmount 관리)
      if (!isMountedRef.current) {
        onError?.(error instanceof Error ? error : new Error(fallbackMessage ?? 'unmounted'));
        return;
      }
      const rawMessage = error instanceof Error ? error.message : extractUserMessage(error);
      // 2026-05-16: Supabase FunctionsHttpError 의 영문 generic 메시지가 UI 노출되지 않도록 차단.
      // 정상 경로는 callVerifyPortOneIdentity 에서 typed ValidationError 로 변환되지만,
      // SDK 측 직접 raw Error 누출에 대비한 defense-in-depth.
      const safeMessage = rawMessage.startsWith('Edge Function returned')
        ? '본인인증 처리 중 일시적 오류가 발생했어요. 잠시 후 다시 시도해주세요.'
        : rawMessage;
      const resolvedMessage =
        fallbackMessage ?? safeMessage ?? '본인인증 처리 중 오류가 발생했습니다.';

      setErrorMessage(resolvedMessage);

      const normalizedError =
        error instanceof Error ? error : new Error(fallbackMessage ?? 'PortOne identity failed');

      logger.error('PortOne web identity verification failed', normalizedError, {
        component: 'PortOneIdentityVerification.web',
      });
      onError?.(normalizedError);
    },
    [isMountedRef, onError]
  );

  const startVerification = useCallback(async () => {
    let request: PortOneInicisIdentityRequest;
    let bindingToken: string;

    try {
      const bundle = buildPortOneInicisIdentityRequest({
        customerId,
        customerFullName,
        customerPhoneNumber,
      });
      request = bundle.request;
      bindingToken = bundle.bindingToken;
    } catch (error) {
      handleVerificationFailure(error);
      return;
    }

    savePendingPortOneIdentityRequest(request, bindingToken);
    setIsProcessing(true);
    setErrorMessage(null);
    setVerifiedIdentity(null);

    try {
      // redirectUrl 미설정 → iframe 방식 → Promise로 result 반환
      const result = await requestIdentityVerification({
        storeId: request.storeId,
        channelKey: request.channelKey,
        identityVerificationId: request.identityVerificationId,
        customer: request.customer,
        bypass: request.bypass,
        customData: request.customData,
      });

      // undefined → redirect 발생 (비정상)
      if (!result) {
        throw new Error('본인인증을 완료하지 못했어요. 다시 시도해주세요.');
      }

      // 에러 코드 → 실패/취소 (native와 동일하게 handleVerificationFailure 경유)
      if (result.code) {
        handleVerificationFailure(
          new Error(result.message ?? '본인인증이 완료되지 않았습니다.'),
          result.message ?? '본인인증이 완료되지 않았습니다.'
        );
        return; // finally가 cleanup 처리
      }

      // Supabase Edge Function으로 검증 (P0 #1 caller binding)
      const verification = await callVerifyPortOneIdentity({
        identityVerificationId: result.identityVerificationId,
        expectedBindingToken: bindingToken,
      });

      // B1: 에러 메시지 — 무엇 + 왜 + 어떻게 (다음 행동 명시)
      if (verification.hasDuplicatePhone) {
        throw new Error(
          '이미 가입된 번호예요. 기존 계정으로 로그인하시거나 비밀번호를 찾아주세요.'
        );
      }

      if (verification.hasDuplicateIdentity) {
        throw new Error('동일한 명의로 가입된 계정이 있어요. 기존 계정으로 로그인해주세요.');
      }

      if (!verification.phoneVerified || !verification.identity.phoneNumber) {
        throw new Error(
          '본인인증 결과에서 휴대폰 번호를 받지 못했어요. 다른 인증 수단(PASS·토스·카카오)으로 다시 시도해주세요.'
        );
      }

      // 2026-05-16: gender 는 PortOne 이니시스 통합인증에서 인증수단별로 응답이 다름.
      // 누락 시 차단하지 않고 후속 step (SignupStepIdentity) 에서 사용자가 직접 선택.

      // P0 #1 — 후속 callVerifyAndSavePortOneProfile (signUp 흐름)에서 자동 consume
      // C4 — SecureStore 저장 (async, 웹은 sessionStorage)
      await savePortOneIdentityBindingToken(bindingToken);

      // A11: 비동기 await 후 unmount 확인
      if (!isMountedRef.current) return;
      setVerifiedIdentity(verification.identity);
      // B14: 스크린리더에게 자동 채움 완료 announce
      AccessibilityInfo.announceForAccessibility('본인인증이 완료되었습니다');
      onVerified(verification.identity);
    } catch (error) {
      handleVerificationFailure(error);
    } finally {
      clearPendingPortOneIdentityRequest();
      if (isMountedRef.current) setIsProcessing(false);
    }
  }, [
    customerId,
    customerFullName,
    customerPhoneNumber,
    handleVerificationFailure,
    isMountedRef,
    onVerified,
  ]);

  // B3: 완료 상태에서 "다시 인증하기" 실수 클릭 방지 — confirm 후 재진행
  const handleRetryPress = useCallback(() => {
    confirmAction({
      title: '본인인증을 다시 하시겠어요?',
      message: '이미 인증된 정보를 잃고 처음부터 다시 진행합니다.',
      confirmText: '다시 인증',
      destructive: true,
      onConfirm: () => void startVerification(),
    });
  }, [startVerification]);

  return (
    <View className="w-full">
      {verifiedIdentity ? (
        <View className="rounded-md border border-success-600/20 bg-success-50 p-4 dark:border-success-500/20 dark:bg-success-100">
          <View className="mb-3 flex-row items-center">
            <CheckCircleIcon size={20} color={STATUS_COLORS.success} />
            <Text className="ml-2 font-sans-semibold text-success-700 dark:text-success-500">
              이니시스 본인인증 완료
            </Text>
          </View>

          {/* B10: Truncation 정책 — 이름은 tail, 다른 값은 overflow 안전망 */}
          <View className="gap-2">
            <View className="flex-row justify-between gap-3">
              <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                이름
              </Text>
              <Text
                className="font-sans-medium text-content-primary dark:text-off-white flex-1 min-w-0 text-right"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {verifiedIdentity.name}
              </Text>
            </View>
            <View className="h-px bg-divider" />
            <View className="flex-row justify-between gap-3">
              <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                생년월일
              </Text>
              <Text
                className="font-sans-medium text-content-primary dark:text-off-white"
                numberOfLines={1}
              >
                {formatBirthDate(verifiedIdentity.birthDate)}
              </Text>
            </View>
            {/* 2026-05-16: gender 누락은 PortOne 이니시스 통합인증에서 인증수단별로 발생.
                "확인 필요" 표시로 사용자 혼란을 주지 않도록 응답에 있을 때만 렌더한다.
                가입 후 마이페이지/프로필 화면에서 사용자가 직접 선택. */}
            {verifiedIdentity.gender && (
              <>
                <View className="h-px bg-divider" />
                <View className="flex-row justify-between gap-3">
                  <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                    성별
                  </Text>
                  <Text
                    className="font-sans-medium text-content-primary dark:text-off-white"
                    numberOfLines={1}
                  >
                    {formatGenderLabel(verifiedIdentity.gender)}
                  </Text>
                </View>
              </>
            )}
            <View className="h-px bg-divider" />
            <View className="flex-row justify-between gap-3">
              <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                휴대폰 번호
              </Text>
              <Text
                className="font-sans-medium text-content-primary dark:text-off-white"
                numberOfLines={1}
              >
                {verifiedIdentity.phoneNumber}
              </Text>
            </View>
          </View>

          <Button
            onPress={handleRetryPress}
            variant="outline"
            disabled={disabled || isProcessing}
            className="mt-3"
            fullWidth
          >
            다시 인증하기
          </Button>
        </View>
      ) : (
        // B9: 빈 상태 = 온보딩 — (1) 인지(헤더) (2) 가치(소요시간·인증수단·프라이버시) (3) 행동(CTA)
        <View className="rounded-md border border-secondary-200 bg-surface-page p-5 dark:border-surface-overlay dark:bg-surface-elevated gap-4">
          <View className="flex-row items-center gap-2">
            <ShieldCheckIcon size={20} color="#2563EB" />
            <Text className="font-sans-semibold text-content-primary dark:text-off-white">
              이니시스 본인인증
            </Text>
          </View>

          <View className="flex-row items-center gap-2">
            <ClockIcon size={16} />
            <Text className="text-sm text-content-muted dark:text-secondary-300 font-sans">
              약 30초~1분이면 끝나요
            </Text>
          </View>

          <View>
            <Text className="mb-2 text-xs text-content-muted dark:text-secondary-400 font-sans-medium">
              사용 가능한 인증 수단
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {['PASS', '토스', '카카오', '네이버', '신한', 'KB'].map((label) => (
                <View
                  key={label}
                  className="px-3 py-1 rounded-md bg-secondary-100 dark:bg-surface-overlay"
                >
                  <Text className="text-xs text-content-secondary dark:text-secondary-300 font-sans-medium">
                    {label}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View className="flex-row items-start gap-2 rounded-lg bg-secondary-50 dark:bg-surface p-3">
            <LockIcon size={14} />
            <Text className="flex-1 text-xs leading-4 text-content-muted dark:text-secondary-400 font-sans">
              인증 정보(이름, 생년월일, 성별, 휴대폰)는 본인 확인 목적으로만 사용되며 암호화되어
              안전하게 처리됩니다.
            </Text>
          </View>

          <Button onPress={startVerification} disabled={disabled || isProcessing} fullWidth>
            {isProcessing ? '인증 확인 중...' : '본인인증 시작'}
          </Button>
        </View>
      )}

      {errorMessage && (
        <View className="mt-3 flex-row items-center rounded-lg bg-error-50 p-3 dark:bg-error-900/20">
          <XCircleIcon size={18} color={STATUS_COLORS.error} />
          <Text className="ml-2 flex-1 text-sm text-error-600 dark:text-error-400 font-sans">
            {errorMessage}
          </Text>
        </View>
      )}
    </View>
  );
}

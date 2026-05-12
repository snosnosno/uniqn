import React, { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { STATUS_COLORS } from '@/constants/colors';
import { requestIdentityVerification } from '@portone/browser-sdk/v2';
import { CheckCircleIcon, ShieldCheckIcon, XCircleIcon } from '@/components/icons';
import { Button } from '@/components/ui/Button';
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
import { formatGenderLabel } from '@/utils/formatters';
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

function formatBirthDate(value: string): string {
  if (!/^\d{8}$/.test(value)) return value;
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
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
  const [verifiedIdentity, setVerifiedIdentity] = useState<VerifiedPortOneIdentity | null>(
    initialIdentity
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    setVerifiedIdentity(initialIdentity);
  }, [initialIdentity]);

  const handleVerificationFailure = useCallback(
    (error: unknown, fallbackMessage?: string) => {
      // cleanup은 startVerification의 finally 블록에서 담당
      const resolvedMessage =
        fallbackMessage ??
        (error instanceof Error ? error.message : extractUserMessage(error)) ??
        '본인인증 처리 중 오류가 발생했습니다.';

      setErrorMessage(resolvedMessage);

      const normalizedError =
        error instanceof Error ? error : new Error(fallbackMessage ?? 'PortOne identity failed');

      logger.error('PortOne web identity verification failed', normalizedError, {
        component: 'PortOneIdentityVerification.web',
      });
      onError?.(normalizedError);
    },
    [onError]
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
        throw new Error('본인인증 창이 닫혔습니다.');
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

      if (verification.hasDuplicatePhone) {
        throw new Error('이미 가입된 휴대폰 번호입니다.');
      }

      if (verification.hasDuplicateIdentity) {
        throw new Error('이미 가입된 본인인증 정보입니다.');
      }

      if (!verification.phoneVerified || !verification.identity.phoneNumber) {
        throw new Error('본인인증 결과에 휴대폰 번호가 없습니다. 채널 설정을 확인해주세요.');
      }

      if (!verification.identity.gender) {
        throw new Error('본인인증 결과에 성별 정보가 없습니다. 인증 수단을 다시 선택해주세요.');
      }

      // P0 #1 — 후속 callVerifyAndSavePortOneProfile (signUp 흐름)에서 자동 consume
      // C4 — SecureStore 저장 (async, 웹은 sessionStorage)
      await savePortOneIdentityBindingToken(bindingToken);

      setVerifiedIdentity(verification.identity);
      onVerified(verification.identity);
    } catch (error) {
      handleVerificationFailure(error);
    } finally {
      clearPendingPortOneIdentityRequest();
      setIsProcessing(false);
    }
  }, [customerId, customerFullName, customerPhoneNumber, handleVerificationFailure, onVerified]);

  return (
    <View className="w-full">
      {verifiedIdentity ? (
        <View className="rounded-md border border-success-200 bg-success-50 p-4 dark:border-success-900/40 dark:bg-success-900/10">
          <View className="mb-3 flex-row items-center">
            <CheckCircleIcon size={20} color={STATUS_COLORS.success} />
            <Text className="ml-2 font-sans-semibold text-success-700 dark:text-success-400">
              이니시스 본인인증 완료
            </Text>
          </View>

          <View className="gap-2 rounded-lg bg-white p-3 dark:bg-surface">
            <View className="flex-row justify-between">
              <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                이름
              </Text>
              <Text className="font-sans-medium text-content-primary dark:text-off-white">
                {verifiedIdentity.name}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                생년월일
              </Text>
              <Text className="font-sans-medium text-content-primary dark:text-off-white">
                {formatBirthDate(verifiedIdentity.birthDate)}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                성별
              </Text>
              <Text className="font-sans-medium text-content-primary dark:text-off-white">
                {formatGenderLabel(verifiedIdentity.gender)}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
                휴대폰 번호
              </Text>
              <Text className="font-sans-medium text-content-primary dark:text-off-white">
                {verifiedIdentity.phoneNumber}
              </Text>
            </View>
          </View>

          <Button
            onPress={startVerification}
            variant="outline"
            disabled={disabled || isProcessing}
            className="mt-3"
            fullWidth
          >
            다시 인증하기
          </Button>
        </View>
      ) : (
        <View className="rounded-md border border-secondary-200 bg-surface-page dark:bg-surface p-4 dark:border-surface-overlay dark:bg-surface-elevated">
          <View className="mb-3 flex-row items-center">
            <ShieldCheckIcon size={20} color="#2563EB" />
            <Text className="ml-2 font-sans-semibold text-content-primary dark:text-off-white">
              이니시스 본인인증
            </Text>
          </View>
          <Text className="mb-4 text-sm leading-5 text-content-muted dark:text-secondary-300 font-sans">
            PASS, 토스, 카카오, 네이버 등 이니시스 통합인증 수단으로 본인인증을 진행합니다.
          </Text>
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

export default PortOneIdentityVerification;

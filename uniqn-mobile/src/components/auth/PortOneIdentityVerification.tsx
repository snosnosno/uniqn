import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, useWindowDimensions } from 'react-native';
import { STATUS_COLORS } from '@/constants/colors';
import { IdentityVerification } from '@portone/react-native-sdk';
import { CheckCircleIcon, ShieldCheckIcon, XCircleIcon } from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { extractUserMessage } from '@/errors';
import {
  type PortOneInicisIdentityRequest,
  type PortOneIdentityVerificationResult,
  type VerifiedPortOneIdentity,
  buildPortOneInicisIdentityRequest,
  callVerifyPortOneIdentity,
  clearPendingPortOneIdentityRequest,
  savePendingPortOneIdentityRequest,
  savePortOneIdentityBindingToken,
  savePortOneIdentityVerificationResult,
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
  if (!/^\d{8}$/.test(value)) {
    return value;
  }

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
  const { height } = useWindowDimensions();
  const [modalVisible, setModalVisible] = useState(false);
  const [request, setRequest] = useState<PortOneInicisIdentityRequest | null>(null);
  const [bindingToken, setBindingToken] = useState<string | null>(null);
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
      clearPendingPortOneIdentityRequest();
      setModalVisible(false);
      setIsProcessing(false);

      const resolvedMessage =
        fallbackMessage ??
        (error instanceof Error ? error.message : extractUserMessage(error)) ??
        '본인인증 처리 중 오류가 발생했습니다.';

      setErrorMessage(resolvedMessage);

      const normalizedError =
        error instanceof Error ? error : new Error(fallbackMessage ?? 'PortOne identity failed');

      logger.error('PortOne identity verification failed', normalizedError, {
        component: 'PortOneIdentityVerification',
      });
      onError?.(normalizedError);
    },
    [onError]
  );

  const handleVerificationComplete = useCallback(
    async (result: PortOneIdentityVerificationResult) => {
      savePortOneIdentityVerificationResult(result);
      clearPendingPortOneIdentityRequest();
      setModalVisible(false);

      if (result.code || result.message) {
        handleVerificationFailure(
          new Error(result.message ?? '본인인증이 완료되지 않았습니다.'),
          result.message ?? '본인인증이 완료되지 않았습니다.'
        );
        return;
      }

      setIsProcessing(true);
      setErrorMessage(null);

      try {
        const verification = await callVerifyPortOneIdentity({
          identityVerificationId: result.identityVerificationId,
          expectedBindingToken: bindingToken ?? undefined,
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
        // C4 — SecureStore 저장 (async)
        if (bindingToken) {
          await savePortOneIdentityBindingToken(bindingToken);
        }

        setVerifiedIdentity(verification.identity);
        onVerified(verification.identity);
      } catch (error) {
        handleVerificationFailure(error);
      } finally {
        setIsProcessing(false);
      }
    },
    [bindingToken, handleVerificationFailure, onVerified]
  );

  const handleSdkError = useCallback(
    (error: Error) => {
      handleVerificationFailure(error);
    },
    [handleVerificationFailure]
  );

  const startVerification = useCallback(() => {
    try {
      const { request: nextRequest, bindingToken: nextToken } = buildPortOneInicisIdentityRequest({
        customerId,
        customerFullName,
        customerPhoneNumber,
      });

      savePendingPortOneIdentityRequest(nextRequest, nextToken);
      setRequest(nextRequest);
      setBindingToken(nextToken);
      setErrorMessage(null);
      setVerifiedIdentity(null);
      setModalVisible(true);
    } catch (error) {
      handleVerificationFailure(error);
    }
  }, [customerFullName, customerId, customerPhoneNumber, handleVerificationFailure]);

  const modalHeight = Math.max(420, Math.floor(height * 0.7));

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
            PASS, 토스, 카카오, 네이버 등 이니시스 통합인증 수단으로 본인인증을 진행합니다. 인증
            완료 후 검증된 이름, 생년월일, 성별, 휴대폰 번호를 자동으로 반영합니다.
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

      {request && (
        <Modal
          visible={modalVisible}
          onClose={() => {
            clearPendingPortOneIdentityRequest();
            setModalVisible(false);
          }}
          title="본인인증"
          size="full"
        >
          <View style={{ height: modalHeight }}>
            <IdentityVerification
              request={request}
              onComplete={handleVerificationComplete}
              onError={handleSdkError}
            />
          </View>
        </Modal>
      )}
    </View>
  );
}

export default PortOneIdentityVerification;

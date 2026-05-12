import React, { useCallback, useEffect, useState } from 'react';
import { Alert, View, Text, useColorScheme, useWindowDimensions } from 'react-native';
import { setStatusBarStyle } from 'expo-status-bar';
import { STATUS_COLORS } from '@/constants/colors';
import { IdentityVerification } from '@portone/react-native-sdk';
import { CheckCircleIcon, ShieldCheckIcon, XCircleIcon } from '@/components/icons';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useIsMounted } from '@/hooks/useIsMounted';
import { triggerHaptic } from '@/utils/haptics';
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
  const { height } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const isMountedRef = useIsMounted();
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

  // B8: PortOne iframe 은 항상 라이트 배경 → 다크 모드에서도 statusBar 를 dark 로 강제.
  // 모달이 닫히면 시스템 테마 기반으로 원복.
  useEffect(() => {
    if (!modalVisible) return;
    setStatusBarStyle('dark');
    return () => {
      setStatusBarStyle(colorScheme === 'dark' ? 'light' : 'dark');
    };
  }, [colorScheme, modalVisible]);

  const handleVerificationFailure = useCallback(
    (error: unknown, fallbackMessage?: string) => {
      clearPendingPortOneIdentityRequest();
      // A11: unmount 이후 setState 호출 차단 — SDK 콜백이 뒤늦게 도달해도 안전
      if (!isMountedRef.current) return;
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
      // B5: 실패는 결정적 순간 — Warning haptic
      void triggerHaptic('warning');
      onError?.(normalizedError);
    },
    [isMountedRef, onError]
  );

  const handleVerificationComplete = useCallback(
    async (result: PortOneIdentityVerificationResult) => {
      savePortOneIdentityVerificationResult(result);
      clearPendingPortOneIdentityRequest();
      // A11: 콜백 도달 시 컴포넌트가 이미 unmount 되었을 수 있음 — storage 정리만 하고 종료
      if (!isMountedRef.current) return;
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

        if (!verification.identity.gender) {
          throw new Error('성별 정보가 누락되었어요. 다른 인증 수단으로 다시 시도해주세요.');
        }

        // P0 #1 — 후속 callVerifyAndSavePortOneProfile (signUp 흐름)에서 자동 consume
        // C4 — SecureStore 저장 (async)
        if (bindingToken) {
          await savePortOneIdentityBindingToken(bindingToken);
        }

        // A11: 비동기 await 후 다시 mount 상태 확인 (조회 도중 unmount 가능)
        if (!isMountedRef.current) return;
        setVerifiedIdentity(verification.identity);
        // B5: 본인인증 완료는 결정적 순간 — Success haptic
        void triggerHaptic('success');
        onVerified(verification.identity);
      } catch (error) {
        handleVerificationFailure(error);
      } finally {
        if (isMountedRef.current) setIsProcessing(false);
      }
    },
    [bindingToken, handleVerificationFailure, isMountedRef, onVerified]
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
      // B5: 본인인증 진입은 결정적 순간 — Light haptic
      void triggerHaptic('light');
    } catch (error) {
      handleVerificationFailure(error);
    }
  }, [customerFullName, customerId, customerPhoneNumber, handleVerificationFailure]);

  // B3: 완료 상태에서 "다시 인증하기" 실수 클릭 방지 — confirm 후 재진행
  const handleRetryPress = useCallback(() => {
    Alert.alert(
      '본인인증을 다시 하시겠어요?',
      '이미 인증된 정보를 잃고 처음부터 다시 진행합니다.',
      [
        { text: '취소', style: 'cancel' },
        { text: '다시 인증', style: 'destructive', onPress: () => startVerification() },
      ]
    );
  }, [startVerification]);

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

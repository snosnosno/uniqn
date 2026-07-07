import React, { useCallback, useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Alert,
  View,
  Text,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';
import { setStatusBarStyle } from 'expo-status-bar';
import { STATUS_COLORS } from '@/constants/colors';
import { IdentityVerification } from '@portone/react-native-sdk';
import {
  CheckCircleIcon,
  ClockIcon,
  LockIcon,
  ShieldCheckIcon,
  XCircleIcon,
} from '@/components/icons';
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

  // B15: 에러 메시지 5초 후 자동 dismiss. 모달 닫은 후에도 stale 메시지가 남는 carry-over 방지.
  useEffect(() => {
    if (!errorMessage) return;
    const timer = setTimeout(() => {
      if (isMountedRef.current) setErrorMessage(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [errorMessage, isMountedRef]);

  const handleVerificationFailure = useCallback(
    (error: unknown, fallbackMessage?: string) => {
      clearPendingPortOneIdentityRequest();
      // A11: unmount 이후 setState 호출 차단 — SDK 콜백이 뒤늦게 도달해도 안전
      if (!isMountedRef.current) return;
      setModalVisible(false);
      setIsProcessing(false);

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

        // 2026-05-16: gender 는 PortOne 이니시스 통합인증에서 인증수단별로 응답이 다름.
        // 누락 시 차단하지 않고 후속 step (SignupStepIdentity) 에서 사용자가 직접 선택.

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
        // B14: 스크린리더에게 자동 채움 완료 announce
        AccessibilityInfo.announceForAccessibility('본인인증이 완료되었습니다');
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

  // B18: iPhone SE 1세대(568px) 등 작은 기기에서 SafeAreaView 잘림 방지.
  // Modal 헤더(~45px) + content 패딩(~40px) + SafeArea 버퍼(60px) 를 빼고 남는 영역만 iframe 에 할당.
  // min 360px (PortOne iframe responsive 하한), max 640px (큰 화면 과도 expand 방지).
  const MODAL_MAX_RATIO = 0.85;
  const MODAL_CHROME = 45 + 40 + 60; // header + content padding + safe area buffer
  const availableHeight = height * MODAL_MAX_RATIO - MODAL_CHROME;
  const modalHeight = Math.max(360, Math.min(640, availableHeight));

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

          {/* B10: Truncation 정책 — 이름은 numberOfLines=1 tail, 생년월일/성별/번호는 안전망 (overflow 방지) */}
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

      {request && (
        <Modal
          visible={modalVisible}
          onClose={() => {
            clearPendingPortOneIdentityRequest();
            setModalVisible(false);
          }}
          title="본인인증"
          size="full"
          // B16: 진행 중 모달은 "취소" 시맨틱 — 자동 완료 시 모달이 사라지므로 항상 진행 컨텍스트.
          closeAccessibilityLabel="본인인증 취소"
        >
          <View style={{ height: modalHeight, width: '100%' }}>
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

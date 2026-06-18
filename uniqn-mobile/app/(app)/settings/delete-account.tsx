/**
 * UNIQN Mobile - 회원탈퇴 화면
 *
 * @description 회원탈퇴 요청 화면 (법적 필수)
 * @version 2.0.0
 *
 * Apple 사용자와 이메일 사용자의 재인증 방식이 다름:
 * - Apple: Apple Sign In 다이얼로그 (비밀번호 불필요)
 * - 이메일: 비밀번호 재입력
 */

import { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StackHeader } from '@/components/headers';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { useAuthStore, useToastStore } from '@/stores';
import {
  requestAccountDeletion,
  retryAppleTokenRevocation,
  signOut,
  DELETION_GRACE_PERIOD_DAYS,
  DELETION_REASONS,
  type DeletionReason,
} from '@/services';
import { useIsAppleUser } from '@/hooks/auth/useCurrentUser';
import { STATUS_COLORS } from '@/constants/colors';
import { extractErrorMessage } from '@/shared/errors';
import { logger } from '@/utils/logger';

// Reason Select Component

interface ReasonSelectProps {
  selectedReason: DeletionReason | null;
  onSelect: (reason: DeletionReason) => void;
}

function ReasonSelect({ selectedReason, onSelect }: ReasonSelectProps) {
  return (
    <View className="flex-col gap-2">
      <Text className="text-micro uppercase tracking-wider text-content-muted font-sans-bold mb-2">
        탈퇴 사유를 선택해주세요
      </Text>
      {(Object.entries(DELETION_REASONS) as [DeletionReason, string][]).map(([key, label]) => (
        <Pressable
          key={key}
          onPress={() => onSelect(key)}
          className={`p-4 rounded-lg border ${
            selectedReason === key
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
              : 'border-divider bg-surface-card dark:bg-surface-elevated'
          }`}
        >
          <View className="flex-row items-center">
            <View
              className={`w-5 h-5 rounded-sm border-2 mr-3 items-center justify-center ${
                selectedReason === key ? 'border-primary-500 bg-primary-500' : 'border-divider'
              }`}
            >
              {selectedReason === key && <View className="w-2 h-2 rounded-sm bg-white" />}
            </View>
            <Text
              className={`flex-1 font-sans ${
                selectedReason === key
                  ? 'text-primary-700 dark:text-primary-300 font-sans-medium'
                  : 'text-content-primary'
              }`}
            >
              {label}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

export default function DeleteAccountScreen() {
  useAuthStore(); // Auth state check
  const { addToast } = useToastStore();

  const [selectedReason, setSelectedReason] = useState<DeletionReason | null>(null);
  const [reasonDetail, setReasonDetail] = useState('');
  const [password, setPassword] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showRevokeRetryModal, setShowRevokeRetryModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // Apple 사용자 여부 확인
  const isAppleUser = useIsAppleUser();

  const finalizeDeletion = useCallback(async () => {
    await signOut();
    addToast({
      type: 'success',
      message: `회원탈퇴가 요청되었습니다. ${DELETION_GRACE_PERIOD_DAYS}일 후 완전히 삭제됩니다.`,
    });
    router.replace('/(auth)/login');
  }, [addToast]);

  // Apple 토큰 파기 재시도
  const handleRetryRevocation = useCallback(async () => {
    setIsRetrying(true);
    let shouldFinalizeDeletion = false;

    try {
      const success = await retryAppleTokenRevocation();
      setShowRevokeRetryModal(false);

      if (success) {
        addToast({ type: 'success', message: 'Apple 계정 연결이 해제되었습니다.' });
      } else {
        addToast({
          type: 'warning',
          message: 'Apple 토큰 파기에 실패했습니다. Apple ID 설정에서 수동으로 해제해주세요.',
        });
      }
      shouldFinalizeDeletion = true;
    } catch (error) {
      const userMessage = (error as { userMessage?: string }).userMessage;
      if (userMessage === '') {
        return;
      }

      setShowRevokeRetryModal(false);
      addToast({
        type: 'warning',
        message:
          userMessage || 'Apple 토큰 파기에 실패했습니다. Apple ID 설정에서 수동으로 해제해주세요.',
      });
      shouldFinalizeDeletion = true;
    } finally {
      setIsRetrying(false);
      if (shouldFinalizeDeletion) {
        await finalizeDeletion();
      }
    }
  }, [addToast, finalizeDeletion]);

  // 재시도 건너뛰기
  const handleSkipRevocation = useCallback(async () => {
    setShowRevokeRetryModal(false);
    addToast({
      type: 'info',
      message: 'Apple ID > 설정 > 로그인 및 보안에서 앱 연결을 수동으로 해제해주세요.',
    });
    await finalizeDeletion();
  }, [addToast, finalizeDeletion]);

  // 탈퇴 요청 처리
  const handleRequestDeletion = useCallback(async () => {
    if (!selectedReason) {
      addToast({ type: 'error', message: '탈퇴 사유를 선택해주세요' });
      return;
    }

    // 이메일 사용자만 비밀번호 필요
    if (!isAppleUser && !password) {
      addToast({ type: 'error', message: '비밀번호를 입력해주세요' });
      return;
    }

    setIsSubmitting(true);

    try {
      logger.info('회원탈퇴 요청', { reason: selectedReason });

      const result = await requestAccountDeletion(
        selectedReason,
        isAppleUser ? undefined : password,
        selectedReason === 'other' ? reasonDetail : undefined
      );

      setShowConfirmModal(false);

      // Apple 토큰 파기 실패 시 재시도 옵션 제공
      if (!result.appleTokenRevoked) {
        setShowRevokeRetryModal(true);
        return;
      }

      // 로그아웃
      await signOut();

      addToast({
        type: 'success',
        message: `회원탈퇴가 요청되었습니다. ${DELETION_GRACE_PERIOD_DAYS}일 후 완전히 삭제됩니다.`,
      });

      // 로그인 화면으로 이동
      router.replace('/(auth)/login');
    } catch (error) {
      const userMessage = (error as { userMessage?: string }).userMessage;
      if (userMessage === '') {
        return;
      }

      logger.error('회원탈퇴 실패', error as Error);
      addToast({
        type: 'error',
        message: userMessage || extractErrorMessage(error, '탈퇴 처리에 실패했습니다.'),
      });
    } finally {
      setIsSubmitting(false);
      setShowConfirmModal(false);
    }
  }, [selectedReason, password, reasonDetail, isAppleUser, addToast]);

  // 탈퇴 버튼 활성화 여부 (Apple: 사유만, 이메일: 사유+비밀번호)
  const canSubmit = selectedReason && (isAppleUser || password.length >= 8);

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      <StackHeader title="회원탈퇴" fallbackHref="/(app)/settings" />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 경고 카드 */}
        <Card className="mb-6 bg-error-50 dark:bg-error-900/20 border-error-200 dark:border-error-800">
          <View className="flex-row items-start">
            <Text className="text-2xl mr-3 font-sans">{''}</Text>
            <View className="flex-1">
              <Text className="text-error-800 dark:text-error-200 font-sans-semibold mb-1">
                회원탈퇴 안내
              </Text>
              <Text className="text-error-700 dark:text-error-300 text-sm leading-5 font-sans">
                • 탈퇴 요청 후 {DELETION_GRACE_PERIOD_DAYS}일간 복구 가능합니다{'\n'}•{' '}
                {DELETION_GRACE_PERIOD_DAYS}일 후 모든 데이터가 영구 삭제됩니다{'\n'}• 진행 중인
                지원 내역이 모두 취소됩니다{'\n'}• 삭제된 데이터는 복구할 수 없습니다
              </Text>
            </View>
          </View>
        </Card>

        {/* 탈퇴 사유 선택 */}
        <View className="mb-6">
          <ReasonSelect selectedReason={selectedReason} onSelect={setSelectedReason} />
        </View>

        {/* 기타 사유 입력 */}
        {selectedReason === 'other' && (
          <View className="mb-6">
            <Input
              label="기타 사유 (선택)"
              value={reasonDetail}
              onChangeText={setReasonDetail}
              placeholder="탈퇴 사유를 입력해주세요"
              multiline
              numberOfLines={3}
            />
          </View>
        )}

        {/* 비밀번호 확인 (이메일 사용자만) */}
        {!isAppleUser && (
          <View className="mb-6">
            <Input
              label="비밀번호 확인"
              value={password}
              onChangeText={setPassword}
              placeholder="현재 비밀번호를 입력해주세요"
              secureTextEntry
              autoComplete="password"
            />
            <Text className="text-xs text-content-muted mt-1 font-sans">
              본인 확인을 위해 비밀번호를 입력해주세요
            </Text>
          </View>
        )}

        {/* Apple 사용자 안내 */}
        {isAppleUser && (
          <View className="mb-6 rounded-lg bg-info-50 dark:bg-info-900/20 p-4">
            <Text className="text-sm text-info-700 dark:text-info-300 font-sans">
              Apple 계정으로 로그인하셨습니다.{'\n'}
              탈퇴 시 Apple 재인증 다이얼로그가 표시됩니다.
            </Text>
          </View>
        )}

        {/* 데이터 확인 링크 */}
        <Pressable onPress={() => router.push('/(app)/settings/my-data')} className="mb-6">
          <Text className="text-primary-600 dark:text-primary-400 text-center underline font-sans">
            탈퇴 전 내 데이터 확인하기 →
          </Text>
        </Pressable>

        {/* 탈퇴 버튼 */}
        <Button
          onPress={() => setShowConfirmModal(true)}
          variant="outline"
          fullWidth
          disabled={!canSubmit}
          className="border-error-500"
        >
          <Text className="text-error-600 dark:text-error-400 font-sans-semibold">
            회원탈퇴 요청
          </Text>
        </Button>
      </ScrollView>

      {/* 최종 확인 모달 */}
      <Modal
        visible={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="정말 탈퇴하시겠습니까?"
      >
        <View className="p-4">
          <Text className="text-content-secondary text-center mb-6 font-sans">
            회원탈퇴를 요청하면 {DELETION_GRACE_PERIOD_DAYS}일 후{'\n'}
            모든 데이터가 영구 삭제됩니다.
          </Text>

          <View className="flex-col gap-3">
            <Button
              onPress={handleRequestDeletion}
              variant="outline"
              fullWidth
              disabled={isSubmitting}
              className="border-error-500"
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={STATUS_COLORS.error} />
              ) : (
                <Text className="text-error-600 dark:text-error-400 font-sans-semibold">
                  네, 탈퇴하겠습니다
                </Text>
              )}
            </Button>

            <Button onPress={() => setShowConfirmModal(false)} fullWidth disabled={isSubmitting}>
              취소
            </Button>
          </View>
        </View>
      </Modal>

      {/* Apple 토큰 파기 재시도 모달 */}
      <Modal
        visible={showRevokeRetryModal}
        onClose={() => {
          /* 모달 닫기 방지 — 반드시 선택해야 함 */
        }}
        title="Apple 계정 연결 해제"
      >
        <View className="p-4">
          <Text className="text-content-secondary text-center mb-4 font-sans">
            Apple 계정 연결 해제에 실패했습니다.{'\n'}
            재시도하시겠습니까?
          </Text>
          <Text className="text-xs text-content-muted text-center mb-6 font-sans">
            건너뛰면 탈퇴는 진행되지만, Apple ID 설정에서{'\n'}
            수동으로 앱 연결을 해제해야 할 수 있습니다.
          </Text>

          <View className="flex-col gap-3">
            <Button onPress={handleRetryRevocation} fullWidth disabled={isRetrying}>
              {isRetrying ? <ActivityIndicator size="small" color="#FFFFFF" /> : '재시도'}
            </Button>

            <Button
              onPress={handleSkipRevocation}
              variant="outline"
              fullWidth
              disabled={isRetrying}
            >
              건너뛰기
            </Button>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

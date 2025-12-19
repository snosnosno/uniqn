/**
 * UNIQN Mobile - 회원탈퇴 화면
 *
 * @description 회원탈퇴 요청 화면 (법적 필수)
 * @version 1.0.0
 */

import { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { router, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { useAuthStore, useThemeStore, useToastStore } from '@/stores';
import { requestAccountDeletion, signOut, DELETION_REASONS, type DeletionReason } from '@/services';
import { logger } from '@/utils/logger';

// ============================================================================
// Constants
// ============================================================================

const DELETION_GRACE_PERIOD_DAYS = 30;

// ============================================================================
// Reason Select Component
// ============================================================================

interface ReasonSelectProps {
  selectedReason: DeletionReason | null;
  onSelect: (reason: DeletionReason) => void;
}

function ReasonSelect({ selectedReason, onSelect }: ReasonSelectProps) {
  return (
    <View className="space-y-2">
      <Text className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        탈퇴 사유를 선택해주세요
      </Text>
      {(Object.entries(DELETION_REASONS) as [DeletionReason, string][]).map(([key, label]) => (
        <Pressable
          key={key}
          onPress={() => onSelect(key)}
          className={`p-4 rounded-lg border ${
            selectedReason === key
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
          }`}
        >
          <View className="flex-row items-center">
            <View
              className={`w-5 h-5 rounded-full border-2 mr-3 items-center justify-center ${
                selectedReason === key
                  ? 'border-primary-500 bg-primary-500'
                  : 'border-gray-300 dark:border-gray-600'
              }`}
            >
              {selectedReason === key && (
                <View className="w-2 h-2 rounded-full bg-white" />
              )}
            </View>
            <Text
              className={`flex-1 ${
                selectedReason === key
                  ? 'text-primary-700 dark:text-primary-300 font-medium'
                  : 'text-gray-700 dark:text-gray-300'
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

// ============================================================================
// Screen Component
// ============================================================================

export default function DeleteAccountScreen() {
  const { isDarkMode } = useThemeStore();
  useAuthStore(); // Auth state check
  const { addToast } = useToastStore();

  const [selectedReason, setSelectedReason] = useState<DeletionReason | null>(null);
  const [reasonDetail, setReasonDetail] = useState('');
  const [password, setPassword] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 탈퇴 요청 처리
  const handleRequestDeletion = useCallback(async () => {
    if (!selectedReason) {
      addToast({ type: 'error', message: '탈퇴 사유를 선택해주세요' });
      return;
    }

    if (!password) {
      addToast({ type: 'error', message: '비밀번호를 입력해주세요' });
      return;
    }

    setIsSubmitting(true);

    try {
      logger.info('회원탈퇴 요청', { reason: selectedReason });

      await requestAccountDeletion(
        selectedReason,
        password,
        selectedReason === 'other' ? reasonDetail : undefined
      );

      // 로그아웃
      await signOut();

      addToast({
        type: 'success',
        message: `회원탈퇴가 요청되었습니다. ${DELETION_GRACE_PERIOD_DAYS}일 후 완전히 삭제됩니다.`,
      });

      // 로그인 화면으로 이동
      router.replace('/(auth)/login');
    } catch (error) {
      logger.error('회원탈퇴 실패', error as Error);
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : '탈퇴 처리에 실패했습니다',
      });
    } finally {
      setIsSubmitting(false);
      setShowConfirmModal(false);
    }
  }, [selectedReason, password, reasonDetail, addToast]);

  // 탈퇴 버튼 활성화 여부
  const canSubmit = selectedReason && password.length >= 8;

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '회원탈퇴',
          headerStyle: {
            backgroundColor: isDarkMode ? '#111827' : '#ffffff',
          },
          headerTintColor: isDarkMode ? '#ffffff' : '#111827',
        }}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 경고 카드 */}
        <Card className="mb-6 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
          <View className="flex-row items-start">
            <Text className="text-2xl mr-3">⚠️</Text>
            <View className="flex-1">
              <Text className="text-red-800 dark:text-red-200 font-semibold mb-1">
                회원탈퇴 안내
              </Text>
              <Text className="text-red-700 dark:text-red-300 text-sm leading-5">
                • 탈퇴 요청 후 {DELETION_GRACE_PERIOD_DAYS}일간 복구 가능합니다{'\n'}
                • {DELETION_GRACE_PERIOD_DAYS}일 후 모든 데이터가 영구 삭제됩니다{'\n'}
                • 진행 중인 지원 내역이 모두 취소됩니다{'\n'}
                • 삭제된 데이터는 복구할 수 없습니다
              </Text>
            </View>
          </View>
        </Card>

        {/* 탈퇴 사유 선택 */}
        <View className="mb-6">
          <ReasonSelect
            selectedReason={selectedReason}
            onSelect={setSelectedReason}
          />
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

        {/* 비밀번호 확인 */}
        <View className="mb-6">
          <Input
            label="비밀번호 확인"
            value={password}
            onChangeText={setPassword}
            placeholder="현재 비밀번호를 입력해주세요"
            secureTextEntry
            autoComplete="password"
          />
          <Text className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            본인 확인을 위해 비밀번호를 입력해주세요
          </Text>
        </View>

        {/* 데이터 확인 링크 */}
        <Pressable
          onPress={() => router.push('/(app)/settings/my-data')}
          className="mb-6"
        >
          <Text className="text-primary-600 dark:text-primary-400 text-center underline">
            탈퇴 전 내 데이터 확인하기 →
          </Text>
        </Pressable>

        {/* 탈퇴 버튼 */}
        <Button
          onPress={() => setShowConfirmModal(true)}
          variant="outline"
          fullWidth
          disabled={!canSubmit}
          className="border-red-500"
        >
          <Text className="text-red-600 dark:text-red-400 font-semibold">
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
          <Text className="text-gray-700 dark:text-gray-300 text-center mb-6">
            회원탈퇴를 요청하면 {DELETION_GRACE_PERIOD_DAYS}일 후{'\n'}
            모든 데이터가 영구 삭제됩니다.
          </Text>

          <View className="space-y-3">
            <Button
              onPress={handleRequestDeletion}
              variant="outline"
              fullWidth
              disabled={isSubmitting}
              className="border-red-500"
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#ef4444" />
              ) : (
                <Text className="text-red-600 dark:text-red-400 font-semibold">
                  네, 탈퇴하겠습니다
                </Text>
              )}
            </Button>

            <Button
              onPress={() => setShowConfirmModal(false)}
              fullWidth
              disabled={isSubmitting}
            >
              취소
            </Button>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

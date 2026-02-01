/**
 * UNIQN Mobile - 구인자 등록 화면
 *
 * @description staff → employer 역할 변경
 * - 본인인증 정보 확인
 * - 프로필 정보 확인
 * - 이용약관 및 서약서 동의
 */

import { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { StackHeader } from '@/components/headers';
import { Button, Card, Loading } from '@/components';
import { CheckCircleIcon, ExclamationCircleIcon } from '@/components/icons';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/authStore';
import { registerAsEmployer } from '@/services/authService';
import { useToast } from '@/stores/toastStore';
import { logger } from '@/utils/logger';

// ============================================================================
// Sub-components
// ============================================================================

interface InfoRowProps {
  label: string;
  value: string | undefined;
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <View className="flex-row justify-between py-2">
      <Text className="text-sm text-gray-500 dark:text-gray-400">{label}</Text>
      <Text className="text-sm font-medium text-gray-900 dark:text-white">
        {value || '-'}
      </Text>
    </View>
  );
}

interface AgreementCheckboxProps {
  checked: boolean;
  onToggle: () => void;
  title: string;
  description?: string;
  onViewDetail?: () => void;
}

function AgreementCheckbox({
  checked,
  onToggle,
  title,
  description,
  onViewDetail,
}: AgreementCheckboxProps) {
  return (
    <View className="mb-4">
      <Pressable
        onPress={onToggle}
        className="flex-row items-start"
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
      >
        <View
          className={`mr-3 mt-0.5 h-6 w-6 items-center justify-center rounded-md border-2 ${
            checked
              ? 'border-primary-600 bg-primary-600'
              : 'border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800'
          }`}
        >
          {checked && <CheckCircleIcon size={16} color="#fff" />}
        </View>
        <View className="flex-1">
          <View className="flex-row items-center">
            <Text className="text-base font-medium text-gray-900 dark:text-white">
              {title}
            </Text>
            {onViewDetail && (
              <Pressable onPress={onViewDetail} className="ml-2">
                <Text className="text-sm text-primary-600 dark:text-primary-400">
                  [보기]
                </Text>
              </Pressable>
            )}
          </View>
          {description && (
            <Text className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {description}
            </Text>
          )}
        </View>
      </Pressable>
    </View>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function EmployerRegisterScreen() {
  const { profile } = useAuth();
  const setProfile = useAuthStore((state) => state.setProfile);
  const toast = useToast();

  // 동의 상태
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [agreeToLiability, setAgreeToLiability] = useState(false);

  // 로딩 상태
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 본인인증 여부
  const isVerified = profile?.identityVerified === true;

  // 모든 동의 완료 여부
  const canSubmit = isVerified && agreeToTerms && agreeToLiability;

  // 이미 구인자인 경우 리다이렉트
  useEffect(() => {
    if (profile?.role === 'employer' || profile?.role === 'admin') {
      router.replace('/(app)/(tabs)/employer');
    }
  }, [profile?.role]);

  // 이용약관 보기 (인앱 화면)
  const handleViewTerms = useCallback(() => {
    router.push('/(app)/settings/employer-terms');
  }, []);

  // 서약서 보기 (인앱 화면)
  const handleViewLiability = useCallback(() => {
    router.push('/(app)/settings/liability-waiver');
  }, []);

  // 등록 처리
  const handleSubmit = useCallback(async () => {
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);

    try {
      // 서비스에서 업데이트된 프로필 반환
      const updatedProfile = await registerAsEmployer();

      // 프로필 저장 (Timestamp → Date 변환)
      setProfile({
        ...updatedProfile,
        createdAt: updatedProfile.createdAt?.toDate?.() ?? new Date(),
        updatedAt: updatedProfile.updatedAt?.toDate?.() ?? new Date(),
        employerAgreements: updatedProfile.employerAgreements ? {
          termsAgreedAt: updatedProfile.employerAgreements.termsAgreedAt?.toDate?.() ?? new Date(),
          liabilityWaiverAgreedAt: updatedProfile.employerAgreements.liabilityWaiverAgreedAt?.toDate?.() ?? new Date(),
        } : undefined,
        employerRegisteredAt: updatedProfile.employerRegisteredAt?.toDate?.() ?? undefined,
      });

      toast.success('구인자로 등록되었습니다');

      // 내 공고 탭으로 이동
      router.replace('/(app)/(tabs)/employer');
    } catch (error) {
      logger.error('구인자 등록 실패', error instanceof Error ? error : new Error(String(error)));
      toast.error(
        error instanceof Error ? error.message : '구인자 등록에 실패했습니다'
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [canSubmit, isSubmitting, setProfile, toast]);

  // 본인인증 안내 (현재 별도 화면 없음 - 프로필에서 안내)
  // 본인인증 전용 화면 구현 시 경로 변경 필요
  const handleGoToVerification = useCallback(() => {
    toast.info('회원가입 시 본인인증이 완료되어야 합니다');
    router.push('/(app)/settings/profile');
  }, [toast]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['top']}>
      <StackHeader title="구인자 등록" />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 안내 문구 */}
        <Text className="mb-6 text-center text-base text-gray-600 dark:text-gray-400">
          구인자로 등록하면 공고를 등록하고{'\n'}스태프를 모집할 수 있습니다.
        </Text>

        {/* 본인인증 정보 */}
        <Card variant="outlined" padding="md" className="mb-4">
          <View className="mb-3 flex-row items-center">
            {isVerified ? (
              <CheckCircleIcon size={20} color="#22C55E" />
            ) : (
              <ExclamationCircleIcon size={20} color="#EF4444" />
            )}
            <Text className="ml-2 text-base font-semibold text-gray-900 dark:text-white">
              본인인증 정보
            </Text>
          </View>

          {isVerified ? (
            <>
              <InfoRow label="이름" value={profile?.verifiedName || profile?.name} />
              <InfoRow label="연락처" value={profile?.verifiedPhone || profile?.phone} />
              <View className="mt-2 rounded-md bg-green-50 px-3 py-2 dark:bg-green-900/20">
                <Text className="text-sm text-green-700 dark:text-green-400">
                  본인인증이 완료되었습니다
                </Text>
              </View>
            </>
          ) : (
            <View>
              <Text className="mb-3 text-sm text-gray-500 dark:text-gray-400">
                구인자 등록을 위해 본인인증이 필요합니다
              </Text>
              <Button
                variant="outline"
                size="sm"
                onPress={handleGoToVerification}
              >
                <Text className="text-primary-600 dark:text-primary-400">
                  본인인증 하러가기
                </Text>
              </Button>
            </View>
          )}
        </Card>

        {/* 프로필 정보 */}
        <Card variant="outlined" padding="md" className="mb-6">
          <Text className="mb-3 text-base font-semibold text-gray-900 dark:text-white">
            프로필 정보
          </Text>
          <InfoRow label="닉네임" value={profile?.nickname} />
          <InfoRow label="이메일" value={profile?.email} />
        </Card>

        {/* 동의 항목 */}
        <View className="mb-6">
          <Text className="mb-4 text-base font-semibold text-gray-900 dark:text-white">
            필수 동의 항목
          </Text>

          <AgreementCheckbox
            checked={agreeToTerms}
            onToggle={() => setAgreeToTerms(!agreeToTerms)}
            title="구인자 이용약관 동의"
            onViewDetail={handleViewTerms}
          />

          <AgreementCheckbox
            checked={agreeToLiability}
            onToggle={() => setAgreeToLiability(!agreeToLiability)}
            title="서약서 동의"
            description="업체 또는 구인자의 불법적인 행위나 사고에 대한 책임은 UNIQN이 아닌 업체 또는 구인자에게 있습니다."
            onViewDetail={handleViewLiability}
          />
        </View>

        {/* 등록 버튼 */}
        <Button
          variant="primary"
          onPress={handleSubmit}
          disabled={!canSubmit || isSubmitting}
          className="w-full"
        >
          {isSubmitting ? (
            <Loading size="small" color="#fff" />
          ) : (
            <Text className="font-semibold text-white">구인자로 등록하기</Text>
          )}
        </Button>

        {!isVerified && (
          <Text className="mt-4 text-center text-sm text-red-500 dark:text-red-400">
            본인인증을 먼저 완료해주세요
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

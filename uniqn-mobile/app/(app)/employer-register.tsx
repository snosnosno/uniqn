/**
 * UNIQN Mobile - 구인자 등록 화면
 *
 * @description staff → employer 역할 변경
 * - 본인인증 정보 확인
 * - 프로필 정보 확인
 * - 이용약관 및 서약서 동의
 */

import { useState, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { StackHeader } from '@/components/headers';
import { Button, Card, Loading } from '@/components';
import { STATUS_COLORS } from '@/constants/colors';
import { CheckCircleIcon, ExclamationCircleIcon } from '@/components/icons';
import { useAuth } from '@/hooks/useAuth';
import { useEmployerApplication } from '@/hooks/auth/useEmployerApplication';
import { registerAsEmployer } from '@/services/auth';
import { useToast } from '@/stores/toastStore';
import { logger } from '@/utils/logger';
import { formatE164ToDisplay } from '@/utils/phone';
import {
  EMPLOYER_TERMS_VERSION_TAG as EMPLOYER_TERMS_VERSION,
  LIABILITY_WAIVER_VERSION_TAG as EMPLOYER_LIABILITY_WAIVER_VERSION,
} from '@/constants/legal';
import { employerIntroSchema } from '@/schemas';

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
      <Text className="text-sm text-content-secondary font-sans">{label}</Text>
      <Text className="text-sm font-sans-medium text-content-primary dark:text-off-white">
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
              : 'border-secondary-300 bg-white dark:border-surface-overlay dark:bg-surface'
          }`}
        >
          {checked && <CheckCircleIcon size={16} color="#09090B" />}
        </View>
        <View className="flex-1">
          <View className="flex-row items-center">
            <Text className="text-base font-sans-medium text-content-primary dark:text-off-white">
              {title}
            </Text>
            {onViewDetail && (
              <Pressable onPress={onViewDetail} className="ml-2">
                <Text className="text-sm text-primary-600 dark:text-primary-400 font-sans">
                  [보기]
                </Text>
              </Pressable>
            )}
          </View>
          {description && (
            <Text className="mt-1 text-sm text-content-secondary font-sans">{description}</Text>
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
  const toast = useToast();

  const { data: currentApplication, isLoading: isApplicationLoading } = useEmployerApplication();

  // 동의 상태
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [agreeToLiability, setAgreeToLiability] = useState(false);

  // 구인 소개글 (주로 구인하는 지역/매장/대회)
  const [intro, setIntro] = useState('');

  const introResult = employerIntroSchema.safeParse(intro);
  const introValid = introResult.success;
  // 입력을 시작한 뒤에만 에러를 보여준다 (빈 상태에서 빨간 메시지 방지)
  const introError = intro.length > 0 && !introValid ? introResult.error.issues[0]?.message : null;

  // 로딩 상태
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 본인인증 여부 — identity_verified 컬럼이 본인인증 진위 기준 (phone_verified 와는 의미 분리)
  const isVerified = profile?.identityVerified === true;

  // 모든 동의 완료 여부
  const canSubmit = isVerified && agreeToTerms && agreeToLiability && introValid;

  // 이미 구인자인 경우 또는 pending 신청 중인 경우 리다이렉트
  useEffect(() => {
    if (profile?.role === 'employer' || profile?.role === 'admin') {
      router.replace('/(app)/(tabs)/employer');
      return;
    }
    // pending 중인 신청이 있으면 상태 화면으로 redirect
    if (!isApplicationLoading && currentApplication?.status === 'pending') {
      router.replace('/(app)/employer-application-status');
    }
  }, [profile?.role, currentApplication?.status, isApplicationLoading]);

  // 이용약관 보기 (인앱 화면)
  const handleViewTerms = useCallback(() => {
    router.push('/(app)/settings/employer-terms');
  }, []);

  // 서약서 보기 (인앱 화면)
  const handleViewLiability = useCallback(() => {
    router.push('/(app)/settings/liability-waiver');
  }, []);

  // 등록 신청 처리 (관리자 승인 대기 플로우)
  const handleSubmit = useCallback(async () => {
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const now = new Date().toISOString();
      const agreementsSnapshot = {
        termsVersion: EMPLOYER_TERMS_VERSION,
        termsAcceptedAt: now,
        liabilityWaiverVersion: EMPLOYER_LIABILITY_WAIVER_VERSION,
        liabilityWaiverAcceptedAt: now,
      };

      await registerAsEmployer(agreementsSnapshot, intro.trim());

      toast.success('구인자 등록 신청이 접수되었습니다. 관리자 승인 후 이용 가능합니다');

      router.replace('/(app)/employer-application-status');
    } catch (error) {
      logger.error(
        '구인자 등록 신청 실패',
        error instanceof Error ? error : new Error(String(error))
      );
      toast.error(error instanceof Error ? error.message : '구인자 등록 신청에 실패했습니다');
    } finally {
      setIsSubmitting(false);
    }
  }, [canSubmit, isSubmitting, toast, intro]);

  // 본인인증 진행 — signup?mode=reverify 단일 진입점.
  // redirect 보존: 인증 완료 후 홈이 아닌 이 등록 화면으로 복귀시킨다.
  const handleGoToVerification = useCallback(() => {
    const redirect = encodeURIComponent('/(app)/employer-register');
    router.push(`/(auth)/signup?mode=reverify&redirect=${redirect}`);
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      <StackHeader title="구인자 등록" fallbackHref="/(app)/(tabs)/home-jobs" />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 안내 문구 */}
        <Text className="mb-6 text-center text-base text-content-muted dark:text-secondary-400 font-sans">
          구인자로 등록하면 공고를 등록하고{'\n'}스태프를 모집할 수 있습니다.
        </Text>

        {/* 본인인증 정보 */}
        <Card variant="outlined" padding="md" className="mb-4">
          <View className="mb-3 flex-row items-center">
            {isVerified ? (
              <CheckCircleIcon size={20} color={STATUS_COLORS.success} />
            ) : (
              <ExclamationCircleIcon size={20} color={STATUS_COLORS.error} />
            )}
            <Text className="ml-2 text-base font-sans-semibold text-content-primary dark:text-off-white">
              본인인증 정보
            </Text>
          </View>

          {isVerified ? (
            <>
              <InfoRow label="이름" value={profile?.name} />
              <InfoRow
                label="연락처"
                value={profile?.phone ? formatE164ToDisplay(profile.phone) : undefined}
              />
              <View className="mt-2 rounded-md bg-success-50 px-3 py-2 dark:bg-success-900/20">
                <Text className="text-sm text-success-700 dark:text-success-400 font-sans">
                  본인인증이 완료되었습니다
                </Text>
              </View>
            </>
          ) : (
            <View>
              <Text className="mb-3 text-sm text-content-secondary font-sans">
                구인자 등록을 위해 본인인증이 필요합니다
              </Text>
              <Button variant="outline" size="sm" onPress={handleGoToVerification}>
                <Text className="text-primary-600 dark:text-primary-400 font-sans">
                  본인인증 하러가기
                </Text>
              </Button>
            </View>
          )}
        </Card>

        {/* 프로필 정보 */}
        <Card variant="outlined" padding="md" className="mb-6">
          <Text className="mb-3 text-base font-sans-semibold text-content-primary dark:text-off-white">
            프로필 정보
          </Text>
          <InfoRow label="닉네임" value={profile?.nickname} />
          <InfoRow label="이메일" value={profile?.email} />
        </Card>

        {/* 구인 소개 */}
        <Card variant="outlined" padding="md" className="mb-6">
          <Text className="mb-1 text-base font-sans-semibold text-content-primary dark:text-off-white">
            구인 소개
          </Text>
          <Text className="mb-3 text-sm text-content-secondary font-sans">
            주로 구인하는 지역/매장/대회를 알려주세요. 관리자 심사에 참고됩니다.
          </Text>

          <TextInput
            value={intro}
            onChangeText={setIntro}
            placeholder={'예) 강남 일대 홀덤펍, OO포커 대회 딜러를 주로 모집합니다'}
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            maxLength={300}
            className="min-h-[120px] rounded-md border border-secondary-300 bg-white px-3 py-2 text-base text-content-primary dark:border-surface-overlay dark:bg-surface dark:text-off-white font-sans"
          />

          <View className="mt-1 flex-row items-center justify-between">
            <Text className="flex-1 text-xs text-error-500 dark:text-error-400 font-sans">
              {introError ?? ''}
            </Text>
            <Text className="text-xs text-content-placeholder font-sans">{intro.length}/300</Text>
          </View>
        </Card>

        {/* 동의 항목 */}
        <View className="mb-6">
          <Text className="mb-4 text-base font-sans-semibold text-content-primary dark:text-off-white">
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
            <Text className="font-sans-semibold text-content-onGold">구인자로 등록하기</Text>
          )}
        </Button>

        {!isVerified && (
          <Text className="mt-4 text-center text-sm text-error-500 dark:text-error-400 font-sans">
            본인인증을 먼저 완료해주세요
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

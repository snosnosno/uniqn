/**
 * UNIQN Mobile - 공고 수정 화면 (5단계)
 *
 * @description 구인자가 기존 공고를 수정하는 5단계 폼
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StepIndicator, type StepInfo } from '@/components/auth/StepIndicator';
import { Button, Loading, MobileHeader } from '@/components';
import { useAuth } from '@/hooks/useAuth';
import { useJobDetail } from '@/hooks/useJobDetail';
import { useUpdateJobPosting } from '@/hooks/useJobManagement';
import { useToastStore } from '@/stores/toastStore';
import { logger } from '@/utils/logger';
import type { UpdateJobPostingInput, JobPostingFormData } from '@/types';

// Step Components
import {
  Step1BasicInfo,
  Step2DateTime,
  Step3Roles,
  Step4Salary,
  Step5Confirm,
} from '@/components/employer/job-form';

// ============================================================================
// Constants
// ============================================================================

const JOB_POSTING_STEPS: StepInfo[] = [
  { label: '기본 정보', shortLabel: '기본' },
  { label: '일정', shortLabel: '일정' },
  { label: '역할/인원', shortLabel: '역할' },
  { label: '급여', shortLabel: '급여' },
  { label: '확인', shortLabel: '확인' },
];

// ============================================================================
// Main Component
// ============================================================================

export default function EditJobPostingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { addToast } = useToastStore();

  // 기존 공고 데이터 불러오기
  const { job: existingJob, isLoading: isJobLoading, error: jobError } = useJobDetail(id || '');

  // Form State
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<JobPostingFormData | null>(null);
  const [hasConfirmedApplicants, setHasConfirmedApplicants] = useState(false);

  // Mutations
  const updateJobPosting = useUpdateJobPosting();

  // 기존 데이터로 폼 초기화
  useEffect(() => {
    if (existingJob && !formData) {
      setFormData({
        title: existingJob.title || '',
        location: existingJob.location || null,
        detailedAddress: existingJob.detailedAddress || '',
        contactPhone: existingJob.contactPhone || '',
        description: existingJob.description || '',
        workDate: existingJob.workDate || '',
        timeSlot: existingJob.timeSlot || '',
        roles: existingJob.roles || [],
        salary: existingJob.salary || {
          type: 'daily',
          amount: 0,
          useRoleSalary: false,
        },
        allowances: existingJob.allowances || {},
        isUrgent: existingJob.isUrgent || false,
        tags: existingJob.tags || [],
      });

      // 확정된 지원자가 있는지 확인
      const confirmedCount = existingJob.filledPositions ?? 0;
      setHasConfirmedApplicants(confirmedCount > 0);

      if (confirmedCount > 0) {
        addToast({
          type: 'warning',
          message: '확정된 지원자가 있어 일정/역할 수정이 제한됩니다',
        });
      }
    }
  }, [existingJob, formData, addToast]);

  // 단계 데이터 업데이트
  const updateFormData = useCallback((data: Partial<JobPostingFormData>) => {
    setFormData((prev) => prev ? { ...prev, ...data } : null);
  }, []);

  // 다음 단계
  const handleNextStep = useCallback(() => {
    if (currentStep < JOB_POSTING_STEPS.length) {
      setCurrentStep((prev) => prev + 1);
    }
  }, [currentStep]);

  // 이전 단계
  const handlePrevStep = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  // 공고 수정 제출
  const handleSubmit = useCallback(async () => {
    if (!user?.uid || !formData?.location || !id) {
      addToast({ type: 'error', message: '필수 정보가 누락되었습니다' });
      return;
    }

    try {
      const input: UpdateJobPostingInput = {
        title: formData.title,
        description: formData.description || undefined,
        location: formData.location,
        detailedAddress: formData.detailedAddress || undefined,
        contactPhone: formData.contactPhone || undefined,
        // 확정된 지원자가 있으면 일정/역할 수정 불가
        ...(hasConfirmedApplicants ? {} : {
          workDate: formData.workDate,
          timeSlot: formData.timeSlot,
          roles: formData.roles,
        }),
        salary: formData.salary,
        allowances: formData.allowances,
        isUrgent: formData.isUrgent,
        tags: formData.tags,
      };

      await updateJobPosting.mutateAsync({ jobPostingId: id, input });

      addToast({ type: 'success', message: '공고가 수정되었습니다' });
      router.back();
    } catch (error) {
      logger.error('공고 수정 실패', error as Error, { jobPostingId: id });
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : '공고 수정에 실패했습니다'
      });
    }
  }, [user, formData, hasConfirmedApplicants, id, updateJobPosting, addToast, router]);

  // 로딩 상태
  if (isJobLoading || !formData) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900">
        <View className="flex-1 items-center justify-center">
          <Loading size="large" />
          <Text className="mt-4 text-gray-500 dark:text-gray-400">
            공고 정보를 불러오는 중...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // 에러 상태
  if (jobError || !existingJob) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900">
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            공고를 불러올 수 없습니다
          </Text>
          <Text className="text-gray-500 dark:text-gray-400 text-center mb-4">
            {jobError?.message || '공고 정보를 찾을 수 없습니다.'}
          </Text>
          <Button variant="primary" onPress={() => router.back()}>
            돌아가기
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  // 현재 단계 렌더링
  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <Step1BasicInfo
            data={formData}
            onUpdate={updateFormData}
            onNext={handleNextStep}
          />
        );
      case 2:
        return (
          <Step2DateTime
            data={formData}
            onUpdate={updateFormData}
            onNext={handleNextStep}
            onPrev={handlePrevStep}
            disabled={hasConfirmedApplicants}
          />
        );
      case 3:
        return (
          <Step3Roles
            data={formData}
            onUpdate={updateFormData}
            onNext={handleNextStep}
            onPrev={handlePrevStep}
            disabled={hasConfirmedApplicants}
          />
        );
      case 4:
        return (
          <Step4Salary
            data={formData}
            onUpdate={updateFormData}
            onNext={handleNextStep}
            onPrev={handlePrevStep}
          />
        );
      case 5:
        return (
          <Step5Confirm
            data={formData}
            onSubmit={handleSubmit}
            onPrev={handlePrevStep}
            isSubmitting={updateJobPosting.isPending}
            isEditMode={true}
          />
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['bottom']}>
      {/* 헤더 */}
      <MobileHeader
        title="공고 수정"
        showBack
        onBack={() => {
          Alert.alert(
            '수정 취소',
            '변경 사항이 저장되지 않습니다. 나가시겠습니까?',
            [
              { text: '계속 수정', style: 'cancel' },
              {
                text: '나가기',
                style: 'destructive',
                onPress: () => router.back(),
              },
            ]
          );
        }}
      />

      {/* 확정된 지원자 경고 */}
      {hasConfirmedApplicants && (
        <View className="mx-4 mt-2 p-3 bg-warning-50 dark:bg-warning-900/20 rounded-lg border border-warning-200 dark:border-warning-800">
          <Text className="text-sm text-warning-700 dark:text-warning-300">
            확정된 지원자가 있어 일정과 역할 정보는 수정할 수 없습니다.
          </Text>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* 단계 표시기 */}
        <View className="px-4 py-4 bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
          <StepIndicator
            currentStep={currentStep}
            steps={JOB_POSTING_STEPS}
            showLabels={true}
          />
        </View>

        {/* 폼 컨텐츠 */}
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {renderCurrentStep()}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

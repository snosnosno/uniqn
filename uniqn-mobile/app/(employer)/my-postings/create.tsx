/**
 * UNIQN Mobile - 공고 작성 화면 (5단계)
 *
 * @description 구인자가 새 공고를 작성하는 5단계 폼
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
  BackHandler,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StepIndicator, type StepInfo } from '@/components/auth/StepIndicator';
import { Button, Loading, MobileHeader } from '@/components';
import { useAuth } from '@/hooks/useAuth';
import { useCreateJobPosting, useSaveDraft, useDraft, useDeleteDraft } from '@/hooks/useJobManagement';
import { useToastStore } from '@/stores/toastStore';
import { logger } from '@/utils/logger';
import type { CreateJobPostingInput, JobPostingFormData } from '@/types';

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

// 폼 초기값 (타입 파일에서 export)
const INITIAL_FORM_DATA: JobPostingFormData = {
  title: '',
  location: null,
  detailedAddress: '',
  contactPhone: '',
  description: '',
  workDate: '',
  timeSlot: '',
  roles: [],
  salary: {
    type: 'daily',
    amount: 0,
    useRoleSalary: false,
  },
  allowances: {},
  isUrgent: false,
  tags: [],
};

// ============================================================================
// Main Component
// ============================================================================

export default function CreateJobPostingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { addToast } = useToastStore();

  // Form State
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<JobPostingFormData>(INITIAL_FORM_DATA);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Mutations
  const createJobPosting = useCreateJobPosting();
  const saveDraft = useSaveDraft();
  const deleteDraft = useDeleteDraft();
  const { data: existingDraft, isLoading: isDraftLoading } = useDraft();

  // 임시저장 불러오기
  useEffect(() => {
    if (existingDraft) {
      Alert.alert(
        '임시저장 불러오기',
        '작성 중이던 공고가 있습니다. 이어서 작성하시겠습니까?',
        [
          {
            text: '새로 작성',
            style: 'destructive',
            onPress: () => {
              if (existingDraft.id) {
                deleteDraft.mutate(existingDraft.id);
              }
            },
          },
          {
            text: '이어서 작성',
            onPress: () => {
              setFormData((prev) => ({
                ...prev,
                title: existingDraft.title || '',
                location: existingDraft.location || null,
                detailedAddress: existingDraft.detailedAddress || '',
                contactPhone: existingDraft.contactPhone || '',
                description: existingDraft.description || '',
                workDate: existingDraft.workDate || '',
                timeSlot: existingDraft.timeSlot || '',
                roles: existingDraft.roles || [],
                salary: existingDraft.salary || INITIAL_FORM_DATA.salary,
                allowances: existingDraft.allowances || {},
                isUrgent: existingDraft.isUrgent || false,
                tags: existingDraft.tags || [],
              }));
              setCurrentStep(existingDraft.step || 1);
              setDraftId(existingDraft.id || null);
            },
          },
        ]
      );
    }
  }, [existingDraft]);

  // 뒤로가기 처리
  useEffect(() => {
    const handleBackPress = () => {
      if (hasUnsavedChanges) {
        Alert.alert(
          '작성 취소',
          '작성 중인 내용이 있습니다. 나가시겠습니까?',
          [
            { text: '계속 작성', style: 'cancel' },
            {
              text: '임시저장',
              onPress: handleSaveDraft,
            },
            {
              text: '나가기',
              style: 'destructive',
              onPress: () => router.back(),
            },
          ]
        );
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => subscription.remove();
  }, [hasUnsavedChanges, router]);

  // 단계 데이터 업데이트
  const updateFormData = useCallback((data: Partial<JobPostingFormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
    setHasUnsavedChanges(true);
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

  // 임시저장
  const handleSaveDraft = useCallback(async () => {
    if (!user?.uid) return;

    try {
      const draftData: Partial<CreateJobPostingInput> = {
        title: formData.title,
        description: formData.description,
        location: formData.location || undefined,
        detailedAddress: formData.detailedAddress,
        contactPhone: formData.contactPhone,
        workDate: formData.workDate,
        timeSlot: formData.timeSlot,
        roles: formData.roles,
        salary: formData.salary,
        allowances: formData.allowances,
        isUrgent: formData.isUrgent,
        tags: formData.tags,
      };

      const newDraftId = await saveDraft.mutateAsync({
        draft: draftData,
        step: currentStep,
        draftId: draftId || undefined,
      });

      setDraftId(newDraftId);
      setHasUnsavedChanges(false);
      addToast({ type: 'success', message: '임시저장되었습니다' });
    } catch (error) {
      logger.error('임시저장 실패', error as Error);
      addToast({ type: 'error', message: '임시저장에 실패했습니다' });
    }
  }, [user, formData, currentStep, draftId, saveDraft, addToast]);

  // 공고 등록
  const handleSubmit = useCallback(async () => {
    if (!user?.uid || !formData.location) {
      addToast({ type: 'error', message: '필수 정보가 누락되었습니다' });
      return;
    }

    try {
      const input: CreateJobPostingInput = {
        title: formData.title,
        description: formData.description || undefined,
        location: formData.location,
        detailedAddress: formData.detailedAddress || undefined,
        contactPhone: formData.contactPhone || undefined,
        workDate: formData.workDate,
        timeSlot: formData.timeSlot,
        roles: formData.roles,
        salary: formData.salary,
        allowances: formData.allowances,
        isUrgent: formData.isUrgent,
        tags: formData.tags,
      };

      await createJobPosting.mutateAsync({ input });

      // 임시저장 삭제
      if (draftId) {
        await deleteDraft.mutateAsync(draftId);
      }

      addToast({ type: 'success', message: '공고가 등록되었습니다' });
      router.replace('/(employer)/my-postings');
    } catch (error) {
      logger.error('공고 등록 실패', error as Error);
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : '공고 등록에 실패했습니다'
      });
    }
  }, [user, formData, draftId, createJobPosting, deleteDraft, addToast, router]);

  // 로딩 상태
  if (isDraftLoading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900">
        <View className="flex-1 items-center justify-center">
          <Loading size="large" />
          <Text className="mt-4 text-gray-500 dark:text-gray-400">
            임시저장 확인 중...
          </Text>
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
          />
        );
      case 3:
        return (
          <Step3Roles
            data={formData}
            onUpdate={updateFormData}
            onNext={handleNextStep}
            onPrev={handlePrevStep}
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
            isSubmitting={createJobPosting.isPending}
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
        title="새 공고 작성"
        showBack
        onBack={() => {
          if (hasUnsavedChanges) {
            Alert.alert(
              '작성 취소',
              '작성 중인 내용이 있습니다.',
              [
                { text: '계속 작성', style: 'cancel' },
                {
                  text: '임시저장',
                  onPress: async () => {
                    await handleSaveDraft();
                    router.back();
                  },
                },
                {
                  text: '나가기',
                  style: 'destructive',
                  onPress: () => router.back(),
                },
              ]
            );
          } else {
            router.back();
          }
        }}
        rightAction={
          currentStep < 5 ? (
            <Button
              variant="ghost"
              size="sm"
              onPress={handleSaveDraft}
              disabled={saveDraft.isPending}
            >
              <Text className="text-primary-600 dark:text-primary-400 font-medium">
                임시저장
              </Text>
            </Button>
          ) : undefined
        }
      />

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

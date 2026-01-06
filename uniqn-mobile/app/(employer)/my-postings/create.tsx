/**
 * UNIQN Mobile - 공고 작성 화면 (6단계)
 *
 * @description 구인자가 새 공고를 작성하는 6단계 폼 (4가지 타입 지원)
 * @version 2.0.0 - 4가지 공고 타입 + 6단계 플로우
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
import { INITIAL_JOB_POSTING_FORM_DATA } from '@/types/jobPostingForm';

// Step Components
import {
  Step1BasicInfo,
  Step2DateTime,
  Step2FixedSchedule,
  Step2TournamentDates,
  Step3Roles,
  Step4Salary,
  Step5PreQuestions,
  Step6Confirm,
} from '@/components/employer/job-form';

// ============================================================================
// Constants
// ============================================================================

const JOB_POSTING_STEPS: StepInfo[] = [
  { label: '타입/기본정보', shortLabel: '기본' },
  { label: '일정', shortLabel: '일정' },
  { label: '역할/인원', shortLabel: '역할' },
  { label: '급여', shortLabel: '급여' },
  { label: '사전질문', shortLabel: '질문' },
  { label: '확인', shortLabel: '확인' },
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 역할 라벨 매핑 (StaffRole -> 한글)
 */
const ROLE_LABELS: Record<string, string> = {
  dealer: '딜러',
  floor: '플로어',
  manager: '매니저',
  chiprunner: '칩러너',
  admin: '관리자',
};

/**
 * RoleRequirement[] 또는 FormRoleWithCount[]를 FormRoleWithCount[]로 변환
 */
function convertToFormRoles(
  roles: Array<{ role?: string; name?: string; count: number }>
): Array<{ name: string; count: number; isCustom?: boolean }> {
  return roles.map((r) => ({
    name: r.name || ROLE_LABELS[r.role || ''] || r.role || '알 수 없음',
    count: r.count,
    isCustom: !!(r.name && !ROLE_LABELS[r.name]),
  }));
}

// ============================================================================
// Main Component
// ============================================================================

export default function CreateJobPostingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { addToast } = useToastStore();

  // Form State
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<JobPostingFormData>(INITIAL_JOB_POSTING_FORM_DATA);
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
              // Draft 데이터를 폼 데이터로 변환
              const loadedData: JobPostingFormData = {
                ...INITIAL_JOB_POSTING_FORM_DATA,
                // Step 1: 기본 정보
                postingType: existingDraft.postingType || 'regular',
                title: existingDraft.title || '',
                location: existingDraft.location || null,
                detailedAddress: existingDraft.detailedAddress || '',
                contactPhone: existingDraft.contactPhone || '',
                description: existingDraft.description || '',
                // Step 2: 일정
                workDate: existingDraft.workDate || '',
                startTime: existingDraft.startTime || '',
                tournamentDates: existingDraft.tournamentDates || [],
                daysPerWeek: existingDraft.daysPerWeek || 5,
                workDays: existingDraft.workDays || [],
                // Step 3: 역할
                roles: existingDraft.roles
                  ? convertToFormRoles(existingDraft.roles as Array<{ role?: string; name?: string; count: number }>)
                  : INITIAL_JOB_POSTING_FORM_DATA.roles,
                // Step 4: 급여
                salary: existingDraft.salary || INITIAL_JOB_POSTING_FORM_DATA.salary,
                allowances: existingDraft.allowances || {},
                useRoleSalary: existingDraft.useRoleSalary || false,
                roleSalaries: existingDraft.roleSalaries || {},
                // Step 5: 사전질문
                usesPreQuestions: existingDraft.usesPreQuestions || false,
                preQuestions: existingDraft.preQuestions || [],
                // 기타
                tags: existingDraft.tags || [],
              };
              setFormData(loadedData);
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

  // 특정 단계로 이동 (Step6에서 수정 버튼)
  const handleEditStep = useCallback((step: number) => {
    if (step >= 1 && step <= JOB_POSTING_STEPS.length) {
      setCurrentStep(step);
    }
  }, []);

  // 임시저장
  const handleSaveDraft = useCallback(async () => {
    if (!user?.uid) return;

    try {
      const draftData: Partial<CreateJobPostingInput> & Record<string, unknown> = {
        // Step 1
        postingType: formData.postingType,
        title: formData.title,
        description: formData.description,
        location: formData.location || undefined,
        detailedAddress: formData.detailedAddress,
        contactPhone: formData.contactPhone,
        // Step 2
        workDate: formData.workDate,
        startTime: formData.startTime,
        tournamentDates: formData.tournamentDates,
        daysPerWeek: formData.daysPerWeek,
        workDays: formData.workDays,
        // Step 3
        roles: formData.roles,
        // Step 4
        salary: formData.salary,
        allowances: formData.allowances,
        useRoleSalary: formData.useRoleSalary,
        roleSalaries: formData.roleSalaries,
        // Step 5
        usesPreQuestions: formData.usesPreQuestions,
        preQuestions: formData.preQuestions,
        // 기타
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
        // Step 1
        postingType: formData.postingType,
        title: formData.title,
        description: formData.description || undefined,
        location: formData.location,
        detailedAddress: formData.detailedAddress || undefined,
        contactPhone: formData.contactPhone || undefined,
        // Step 2 (타입별)
        workDate: formData.workDate,
        startTime: formData.startTime,
        tournamentDates: formData.tournamentDates,
        daysPerWeek: formData.daysPerWeek,
        workDays: formData.workDays,
        // Step 3
        roles: formData.roles,
        // Step 4
        salary: formData.salary,
        allowances: formData.allowances,
        useRoleSalary: formData.useRoleSalary,
        roleSalaries: formData.roleSalaries,
        // Step 5
        usesPreQuestions: formData.usesPreQuestions,
        preQuestions: formData.preQuestions,
        // 기타
        tags: formData.tags,
      };

      await createJobPosting.mutateAsync({ input });

      // 임시저장 삭제
      if (draftId) {
        await deleteDraft.mutateAsync(draftId);
      }

      const successMessage = formData.postingType === 'tournament'
        ? '공고가 등록되었습니다. 관리자 승인 후 게시됩니다.'
        : '공고가 등록되었습니다';
      addToast({ type: 'success', message: successMessage });
      router.replace('/(employer)/my-postings');
    } catch (error) {
      logger.error('공고 등록 실패', error as Error);
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : '공고 등록에 실패했습니다'
      });
    }
  }, [user, formData, draftId, createJobPosting, deleteDraft, addToast, router]);

  // Step2 타입별 분기 렌더링 (반드시 조건부 반환 이전에 선언)
  const renderStep2 = useCallback(() => {
    const commonProps = {
      data: formData,
      onUpdate: updateFormData,
      onNext: handleNextStep,
      onBack: handlePrevStep,
    };

    switch (formData.postingType) {
      case 'fixed':
        return <Step2FixedSchedule {...commonProps} />;
      case 'tournament':
        return <Step2TournamentDates {...commonProps} />;
      case 'regular':
      case 'urgent':
      default:
        return <Step2DateTime {...commonProps} />;
    }
  }, [formData, updateFormData, handleNextStep, handlePrevStep]);

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
        return renderStep2();
      case 3:
        return (
          <Step3Roles
            data={formData}
            onUpdate={updateFormData}
            onNext={handleNextStep}
            onBack={handlePrevStep}
          />
        );
      case 4:
        return (
          <Step4Salary
            data={formData}
            onUpdate={updateFormData}
            onNext={handleNextStep}
            onBack={handlePrevStep}
          />
        );
      case 5:
        return (
          <Step5PreQuestions
            data={formData}
            onUpdate={updateFormData}
            onNext={handleNextStep}
            onBack={handlePrevStep}
          />
        );
      case 6:
        return (
          <Step6Confirm
            data={formData}
            onSubmit={handleSubmit}
            onBack={handlePrevStep}
            onEditStep={handleEditStep}
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
          currentStep < 6 ? (
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

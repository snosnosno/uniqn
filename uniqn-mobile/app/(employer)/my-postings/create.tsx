/**
 * UNIQN Mobile - 공고 작성 화면 (스크롤 폼)
 *
 * @description 구인자가 새 공고를 작성하는 한 페이지 스크롤 폼
 * @version 3.0.0 - 스크롤 폼으로 변경 (웹앱과 동일한 UX)
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  Alert,
  BackHandler,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Loading, MobileHeader } from '@/components';
import { useAuth } from '@/hooks/useAuth';
import { useCreateJobPosting, useSaveDraft, useDraft, useDeleteDraft } from '@/hooks/useJobManagement';
import { useToastStore } from '@/stores/toastStore';
import { logger } from '@/utils/logger';
import type { CreateJobPostingInput, JobPostingFormData } from '@/types';
import { INITIAL_JOB_POSTING_FORM_DATA } from '@/types/jobPostingForm';
import { JobPostingScrollForm } from '@/components/employer/job-form';

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
  roles: { role?: string; name?: string; count: number }[]
): { name: string; count: number; isCustom?: boolean }[] {
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
              const loadedData: JobPostingFormData = {
                ...INITIAL_JOB_POSTING_FORM_DATA,
                postingType: existingDraft.postingType || 'regular',
                title: existingDraft.title || '',
                location: existingDraft.location || null,
                detailedAddress: existingDraft.detailedAddress || '',
                contactPhone: existingDraft.contactPhone || '',
                description: existingDraft.description || '',
                workDate: existingDraft.workDate || '',
                startTime: existingDraft.startTime || '',
                tournamentDates: existingDraft.tournamentDates || [],
                daysPerWeek: existingDraft.daysPerWeek || 5,
                workDays: existingDraft.workDays || [],
                roles: existingDraft.roles
                  ? convertToFormRoles(existingDraft.roles as { role?: string; name?: string; count: number }[])
                  : INITIAL_JOB_POSTING_FORM_DATA.roles,
                salary: existingDraft.salary || INITIAL_JOB_POSTING_FORM_DATA.salary,
                allowances: existingDraft.allowances || {},
                useRoleSalary: existingDraft.useRoleSalary || false,
                roleSalaries: existingDraft.roleSalaries || {},
                usesPreQuestions: existingDraft.usesPreQuestions || false,
                preQuestions: existingDraft.preQuestions || [],
                tags: existingDraft.tags || [],
              };
              setFormData(loadedData);
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

  // 폼 데이터 업데이트
  const updateFormData = useCallback((data: Partial<JobPostingFormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
    setHasUnsavedChanges(true);
  }, []);

  // 임시저장
  const handleSaveDraft = useCallback(async () => {
    if (!user?.uid) return;

    try {
      const draftData: Partial<CreateJobPostingInput> & Record<string, unknown> = {
        postingType: formData.postingType,
        title: formData.title,
        description: formData.description,
        location: formData.location || undefined,
        detailedAddress: formData.detailedAddress,
        contactPhone: formData.contactPhone,
        workDate: formData.workDate,
        startTime: formData.startTime,
        tournamentDates: formData.tournamentDates,
        daysPerWeek: formData.daysPerWeek,
        workDays: formData.workDays,
        roles: formData.roles,
        salary: formData.salary,
        allowances: formData.allowances,
        useRoleSalary: formData.useRoleSalary,
        roleSalaries: formData.roleSalaries,
        usesPreQuestions: formData.usesPreQuestions,
        preQuestions: formData.preQuestions,
        tags: formData.tags,
      };

      const newDraftId = await saveDraft.mutateAsync({
        draft: draftData,
        step: 1, // 스크롤 폼에서는 step이 의미없지만 호환성 유지
        draftId: draftId || undefined,
      });

      setDraftId(newDraftId);
      setHasUnsavedChanges(false);
      addToast({ type: 'success', message: '임시저장되었습니다' });
    } catch (error) {
      logger.error('임시저장 실패', error as Error);
      addToast({ type: 'error', message: '임시저장에 실패했습니다' });
    }
  }, [user, formData, draftId, saveDraft, addToast]);

  // 공고 등록
  const handleSubmit = useCallback(async () => {
    if (!user?.uid || !formData.location) {
      addToast({ type: 'error', message: '필수 정보가 누락되었습니다' });
      return;
    }

    try {
      // Firebase는 undefined 값을 허용하지 않으므로 빈 문자열 또는 필드 제외 처리
      const input: CreateJobPostingInput = {
        postingType: formData.postingType,
        title: formData.title,
        // description은 선택 필드 - 빈 문자열이면 제외
        ...(formData.description ? { description: formData.description } : {}),
        location: formData.location,
        // 선택 필드들 - 값이 있을 때만 포함
        ...(formData.detailedAddress ? { detailedAddress: formData.detailedAddress } : {}),
        ...(formData.contactPhone ? { contactPhone: formData.contactPhone } : {}),
        workDate: formData.workDate,
        startTime: formData.startTime,
        tournamentDates: formData.tournamentDates,
        daysPerWeek: formData.daysPerWeek,
        workDays: formData.workDays,
        roles: formData.roles,
        salary: formData.salary,
        allowances: formData.allowances,
        useRoleSalary: formData.useRoleSalary,
        roleSalaries: formData.roleSalaries,
        usesPreQuestions: formData.usesPreQuestions,
        preQuestions: formData.preQuestions,
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
      router.replace('/(app)/(tabs)/employer');
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
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* 스크롤 폼 */}
        <JobPostingScrollForm
          data={formData}
          onUpdate={updateFormData}
          onSubmit={handleSubmit}
          onSaveDraft={handleSaveDraft}
          isSubmitting={createJobPosting.isPending}
          isSavingDraft={saveDraft.isPending}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Loading } from '@/components';
import {
  SectionCard,
  BasicInfoSection,
  DateRequirementsSection,
  RolesSection,
  SalarySection,
  ScheduleSection,
  PreQuestionsSection,
} from '@/components/employer/job-form';
import { useAuth } from '@/hooks/useAuth';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useJobDetail } from '@/hooks/useJobDetail';
import { useUpdateJobPosting } from '@/hooks/useJobManagement';
import { useToastStore } from '@/stores/toastStore';
import { logger } from '@/utils/logger';
import {
  type SectionErrors,
  validateAllSections,
  getFirstErrorSection,
} from '@/utils/job-posting/validation';
import {
  buildJobPostingDraft,
  buildUpdateJobPostingInput,
  draftToFormData,
  patchJobPostingDraft,
} from '@/utils/job-posting/submission';
import { isEmployerManageablePosting } from '@/utils/jobPostingVisibility';
import type { UpdateJobPostingInput, JobPostingFormData } from '@/types';
import type { JobPostingDraft } from '@/types/jobPostingDraft';

export default function EditJobPostingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { addToast } = useToastStore();

  const { job: existingJob, isLoading: isJobLoading, error: jobError } = useJobDetail(id || '');

  const scrollViewRef = useRef<ScrollView>(null);
  const [draft, setDraft] = useState<JobPostingDraft | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [hasConfirmedApplicants, setHasConfirmedApplicants] = useState(false);
  const [errors, setErrors] = useState<SectionErrors>({
    basicInfo: {},
    schedule: {},
    roles: {},
    salary: {},
    preQuestions: {},
  });

  useUnsavedChangesGuard(isDirty);

  const sectionPositions = useRef<Record<string, number>>({});
  const updateJobPosting = useUpdateJobPosting();
  const formData = useMemo(() => (draft ? draftToFormData(draft) : null), [draft]);
  const isFixed = formData?.postingType === 'fixed';
  const allowScheduleFallback = useMemo(() => {
    if (!formData) {
      return false;
    }

    return (formData.dateSpecificRequirements?.length ?? 0) === 0 && !!formData.workDate;
  }, [formData]);

  useEffect(() => {
    if (existingJob && !draft) {
      if (!isEmployerManageablePosting(existingJob)) {
        addToast({
          type: 'warning',
          message: '지원하지 않는 공고 형식입니다.',
        });
        router.replace('/(app)/(tabs)/employer');
        return;
      }

      setDraft(buildJobPostingDraft(existingJob));

      const confirmedCount = existingJob.filledPositions ?? 0;
      setHasConfirmedApplicants(confirmedCount > 0);

      if (confirmedCount > 0) {
        addToast({
          type: 'warning',
          message: '확정된 지원자가 있어 일정과 역할 정보 수정이 제한됩니다.',
        });
      }
    }
  }, [existingJob, draft, addToast, router]);

  useEffect(() => {
    if (!allowScheduleFallback) {
      return;
    }

    addToast({
      type: 'warning',
      message: '기존 일정 정보가 비어 있어 날짜 정보를 다시 확인해 주세요.',
    });
  }, [allowScheduleFallback, addToast]);

  const updateFormData = useCallback((data: Partial<JobPostingFormData>) => {
    setIsDirty(true);
    setDraft((prev) => (prev ? patchJobPostingDraft(prev, data) : null));
  }, []);

  const validateAll = useCallback((): boolean => {
    if (!formData) return false;

    const skipSections: (keyof SectionErrors)[] = hasConfirmedApplicants
      ? ['schedule', 'roles']
      : [];

    const newErrors = validateAllSections(formData, {
      allowLegacyFallback: allowScheduleFallback,
      skipSections,
    });

    setErrors(newErrors);

    const firstError = getFirstErrorSection(newErrors);
    if (firstError) {
      const position = sectionPositions.current[firstError];
      if (position !== undefined && scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ y: position - 20, animated: true });
      }
      return false;
    }

    return true;
  }, [allowScheduleFallback, formData, hasConfirmedApplicants]);

  const handleSubmit = useCallback(async () => {
    if (!user?.uid || !formData?.location || !draft || !id) {
      addToast({ type: 'error', message: '필수 정보가 누락되었습니다.' });
      return;
    }

    if (!validateAll()) {
      addToast({ type: 'error', message: '입력 정보를 확인해 주세요.' });
      return;
    }

    try {
      const input: UpdateJobPostingInput = buildUpdateJobPostingInput(draft, {
        hasConfirmedApplicants,
      });

      await updateJobPosting.mutateAsync({ jobPostingId: id, input });
      setIsDirty(false);

      addToast({ type: 'success', message: '공고가 수정되었습니다.' });
      router.back();
    } catch (error) {
      logger.error('공고 수정 실패', error as Error, { jobPostingId: id });
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : '공고 수정에 실패했습니다.',
      });
    }
  }, [
    user,
    formData,
    draft,
    hasConfirmedApplicants,
    id,
    validateAll,
    updateJobPosting,
    addToast,
    router,
  ]);

  const handleSectionLayout = useCallback((section: string, y: number) => {
    sectionPositions.current[section] = y;
  }, []);

  const getErrorCount = useCallback((sectionErrors: Record<string, string>): number => {
    return Object.keys(sectionErrors).length;
  }, []);

  if (isJobLoading || !formData) {
    return (
      <SafeAreaView className="flex-1 bg-secondary-50 dark:bg-surface-dark" edges={['bottom']}>
        <View className="flex-1 items-center justify-center">
          <Loading size="large" />
          <Text className="mt-4 text-secondary-500 dark:text-secondary-400">
            공고 정보를 불러오는 중...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (jobError || !existingJob) {
    return (
      <SafeAreaView className="flex-1 bg-secondary-50 dark:bg-surface-dark" edges={['bottom']}>
        <View className="flex-1 items-center justify-center p-4">
          <Text className="mb-2 text-lg font-semibold text-secondary-900 dark:text-white">
            공고를 불러올 수 없습니다
          </Text>
          <Text className="mb-4 text-center text-secondary-500 dark:text-secondary-400">
            {jobError?.message || '공고 정보를 찾을 수 없습니다.'}
          </Text>
          <Button variant="primary" onPress={() => router.back()}>
            <Text className="font-semibold text-white">돌아가기</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-secondary-50 dark:bg-surface-dark" edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          ref={scrollViewRef}
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {hasConfirmedApplicants && (
            <View className="mb-4 rounded-lg border border-amber-200 bg-warning-50 p-3 dark:border-amber-800 dark:bg-warning-900/20">
              <Text className="text-sm text-warning-700 dark:text-warning-300">
                확정된 지원자가 있어 일정과 역할 정보는 수정할 수 없습니다.
              </Text>
            </View>
          )}

          <View onLayout={(e) => handleSectionLayout('basicInfo', e.nativeEvent.layout.y)}>
            <SectionCard
              title="기본 정보"
              required
              hasError={getErrorCount(errors.basicInfo) > 0}
              errorCount={getErrorCount(errors.basicInfo)}
            >
              <BasicInfoSection
                data={formData}
                onUpdate={updateFormData}
                errors={errors.basicInfo}
                isEdit
              />
            </SectionCard>
          </View>

          <View onLayout={(e) => handleSectionLayout('schedule', e.nativeEvent.layout.y)}>
            <SectionCard
              title="일정"
              required
              hasError={getErrorCount(errors.schedule) > 0}
              errorCount={getErrorCount(errors.schedule)}
            >
              {hasConfirmedApplicants ? (
                <View className="rounded-lg bg-secondary-100 p-4 dark:bg-surface">
                  <Text className="text-center text-secondary-500 dark:text-secondary-400">
                    확정된 지원자가 있어 일정은 수정할 수 없습니다.
                  </Text>
                </View>
              ) : isFixed ? (
                <ScheduleSection
                  data={formData}
                  onUpdate={updateFormData}
                  errors={errors.schedule}
                />
              ) : (
                <DateRequirementsSection
                  data={formData}
                  onUpdate={updateFormData}
                  errors={errors.schedule}
                />
              )}
            </SectionCard>
          </View>

          {isFixed && (
            <View onLayout={(e) => handleSectionLayout('roles', e.nativeEvent.layout.y)}>
              <SectionCard
                title="모집 역할"
                required
                hasError={getErrorCount(errors.roles) > 0}
                errorCount={getErrorCount(errors.roles)}
              >
                {hasConfirmedApplicants ? (
                  <View className="rounded-lg bg-secondary-100 p-4 dark:bg-surface">
                    <Text className="text-center text-secondary-500 dark:text-secondary-400">
                      확정된 지원자가 있어 역할 정보는 수정할 수 없습니다.
                    </Text>
                  </View>
                ) : (
                  <RolesSection data={formData} onUpdate={updateFormData} errors={errors.roles} />
                )}
              </SectionCard>
            </View>
          )}

          <View onLayout={(e) => handleSectionLayout('salary', e.nativeEvent.layout.y)}>
            <SectionCard
              title="급여"
              required
              hasError={getErrorCount(errors.salary) > 0}
              errorCount={getErrorCount(errors.salary)}
            >
              <SalarySection data={formData} onUpdate={updateFormData} errors={errors.salary} />
            </SectionCard>
          </View>

          <View onLayout={(e) => handleSectionLayout('preQuestions', e.nativeEvent.layout.y)}>
            <SectionCard
              title="사전질문"
              optional
              hasError={getErrorCount(errors.preQuestions) > 0}
              errorCount={getErrorCount(errors.preQuestions)}
            >
              <PreQuestionsSection
                data={formData}
                onUpdate={updateFormData}
                errors={errors.preQuestions}
              />
            </SectionCard>
          </View>
        </ScrollView>

        <View className="absolute bottom-0 left-0 right-0 border-t border-secondary-200 bg-white p-4 dark:border-surface-overlay dark:bg-surface-dark">
          <Button
            variant="primary"
            size="lg"
            onPress={handleSubmit}
            disabled={updateJobPosting.isPending}
            fullWidth
            accessibilityLabel="공고 수정"
            testID="job-posting-edit-submit"
          >
            <Text className="font-semibold text-white">
              {updateJobPosting.isPending ? '수정 중...' : '공고 수정'}
            </Text>
          </Button>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

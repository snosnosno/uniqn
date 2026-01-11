/**
 * UNIQN Mobile - 공고 작성 화면 (스크롤 폼)
 *
 * @description 구인자가 새 공고를 작성하는 한 페이지 스크롤 폼
 * @version 4.0.0 - 임시저장 → 템플릿 기능으로 변경
 */

import React, { useState, useCallback } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { useCreateJobPosting } from '@/hooks/useJobManagement';
import { useTemplateManager } from '@/hooks/useTemplateManager';
import { useToastStore } from '@/stores/toastStore';
import { logger } from '@/utils/logger';
import type { CreateJobPostingInput, JobPostingFormData, DateSpecificRequirement } from '@/types';
import { INITIAL_JOB_POSTING_FORM_DATA } from '@/types/jobPostingForm';
import { JobPostingScrollForm } from '@/components/employer/job-form';
import { TemplateModal } from '@/components/employer/job-form/modals/TemplateModal';
import { LoadTemplateModal } from '@/components/employer/job-form/modals/LoadTemplateModal';

// ============================================================================
// Main Component
// ============================================================================

export default function CreateJobPostingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { addToast } = useToastStore();

  // Form State
  const [formData, setFormData] = useState<JobPostingFormData>(INITIAL_JOB_POSTING_FORM_DATA);

  // Mutations
  const createJobPosting = useCreateJobPosting();

  // Template Manager
  const templateManager = useTemplateManager();

  // 폼 데이터 업데이트
  const updateFormData = useCallback((data: Partial<JobPostingFormData>) => {
    setFormData((prev) => ({ ...prev, ...data }));
  }, []);

  // 템플릿 저장
  const handleSaveTemplate = useCallback(async () => {
    await templateManager.handleSaveTemplate(formData);
  }, [templateManager, formData]);

  // 템플릿 불러오기
  const handleLoadTemplateFromModal = useCallback(async (template: Parameters<typeof templateManager.handleLoadTemplate>[0]) => {
    const loadedData = await templateManager.handleLoadTemplate(template);
    // 불러온 템플릿 데이터를 폼에 병합
    setFormData((prev) => ({
      ...prev,
      ...loadedData,
    }));
    return loadedData;
  }, [templateManager]);

  // 공고 등록
  const handleSubmit = useCallback(async () => {
    if (!user?.uid || !formData.location) {
      addToast({ type: 'error', message: '필수 정보가 누락되었습니다' });
      return;
    }

    try {
      // useSameSalary일 때 salary 필드를 roleSalaries의 첫 번째 값으로 동기화
      // (JobCard에서 useSameSalary일 때 salary 필드를 사용하므로)
      let finalSalary = formData.salary;
      const roleSalaryEntries = Object.entries(formData.roleSalaries);
      if (roleSalaryEntries.length > 0) {
        // roleSalaries가 있으면 첫 번째 값을 salary로 사용
        // useSameSalary === true일 때 모든 역할이 같은 급여이므로 첫 번째 값 사용
        // useSameSalary === false일 때도 대표 급여로 첫 번째 값 사용 (표시용)
        const [, firstSalary] = roleSalaryEntries[0];
        finalSalary = {
          type: firstSalary.type,
          amount: firstSalary.amount,
        };
      }

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
        // v2.0: 날짜별 요구사항 (일정 데이터) - 새 형식을 레거시 형식으로 캐스팅
        dateSpecificRequirements: formData.dateSpecificRequirements as unknown as DateSpecificRequirement[],
        daysPerWeek: formData.daysPerWeek,
        isStartTimeNegotiable: formData.isStartTimeNegotiable,
        roles: formData.roles,
        salary: finalSalary,
        allowances: formData.allowances,
        useSameSalary: formData.useSameSalary,
        roleSalaries: formData.roleSalaries,
        usesPreQuestions: formData.usesPreQuestions,
        preQuestions: formData.preQuestions,
        tags: formData.tags,
      };

      await createJobPosting.mutateAsync({ input });

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
  }, [user, formData, createJobPosting, addToast, router]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-gray-900" edges={['bottom']}>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* 스크롤 폼 */}
        <JobPostingScrollForm
          data={formData}
          onUpdate={updateFormData}
          onSubmit={handleSubmit}
          onSaveTemplate={templateManager.openTemplateModal}
          onLoadTemplate={templateManager.openLoadTemplateModal}
          isSubmitting={createJobPosting.isPending}
          isSavingTemplate={templateManager.isSavingTemplate}
        />
      </KeyboardAvoidingView>

      {/* 템플릿 저장 모달 */}
      <TemplateModal
        visible={templateManager.isTemplateModalOpen}
        onClose={templateManager.closeTemplateModal}
        templateName={templateManager.templateName}
        templateDescription={templateManager.templateDescription}
        onTemplateNameChange={templateManager.setTemplateName}
        onTemplateDescriptionChange={templateManager.setTemplateDescription}
        onSave={handleSaveTemplate}
        isSaving={templateManager.isSavingTemplate}
      />

      {/* 템플릿 불러오기 모달 */}
      <LoadTemplateModal
        visible={templateManager.isLoadTemplateModalOpen}
        onClose={templateManager.closeLoadTemplateModal}
        templates={templateManager.templates}
        templatesLoading={templateManager.templatesLoading}
        onLoadTemplate={handleLoadTemplateFromModal}
        onDeleteTemplate={templateManager.handleDeleteTemplate}
        isLoadingTemplate={templateManager.isLoadingTemplate}
        isDeletingTemplate={templateManager.isDeletingTemplate}
      />
    </SafeAreaView>
  );
}

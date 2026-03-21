import React, { useState, useCallback, useMemo } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { useCreateJobPosting } from '@/hooks/useJobManagement';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useTemplateManager } from '@/hooks/useTemplateManager';
import { useToastStore } from '@/stores/toastStore';
import { logger } from '@/utils/logger';
import type { JobPostingFormData } from '@/types';
import type { JobPostingDraft } from '@/types/jobPostingDraft';
import { INITIAL_JOB_POSTING_DRAFT } from '@/types/jobPostingDraft';
import {
  buildCreateJobPostingInput,
  draftToFormData,
  patchJobPostingDraft,
} from '@/utils/job-posting/submission';
import { JobPostingScrollForm } from '@/components/employer/job-form';
import { TemplateModal } from '@/components/employer/job-form/modals/TemplateModal';
import { LoadTemplateModal } from '@/components/employer/job-form/modals/LoadTemplateModal';

export default function CreateJobPostingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { addToast } = useToastStore();

  const [draft, setDraft] = useState<JobPostingDraft>(INITIAL_JOB_POSTING_DRAFT);
  const [isDirty, setIsDirty] = useState(false);
  const formData = useMemo(() => draftToFormData(draft), [draft]);

  useUnsavedChangesGuard(isDirty);

  const createJobPosting = useCreateJobPosting();
  const templateManager = useTemplateManager();

  const updateFormData = useCallback((data: Partial<JobPostingFormData>) => {
    setIsDirty(true);
    setDraft((prev) => {
      const currentFormData = draftToFormData(prev);
      const nextPatch = { ...data };

      if (data.postingType === 'fixed' && currentFormData.postingType !== 'fixed') {
        nextPatch.roles = [
          { name: '직원', count: 1, isCustom: false },
          { name: '매니저', count: 1, isCustom: false },
        ];
      }

      return patchJobPostingDraft(prev, nextPatch);
    });
  }, []);

  const handleSaveTemplate = useCallback(async () => {
    await templateManager.handleSaveTemplate(draft);
  }, [templateManager, draft]);

  const handleLoadTemplateFromModal = useCallback(
    async (template: Parameters<typeof templateManager.handleLoadTemplate>[0]) => {
      const loadedDraft = await templateManager.handleLoadTemplate(template);
      setDraft(loadedDraft);
      return draftToFormData(loadedDraft);
    },
    [templateManager]
  );

  const handleSubmit = useCallback(async () => {
    if (!user?.uid || !formData.location) {
      addToast({ type: 'error', message: '필수 정보가 누락되었습니다.' });
      return;
    }

    try {
      const input = buildCreateJobPostingInput(draft);

      await createJobPosting.mutateAsync({ input });
      setIsDirty(false);

      const successMessage =
        formData.postingType === 'tournament'
          ? '공고가 등록되었습니다. 관리자 확인 후 게시됩니다.'
          : '공고가 등록되었습니다.';
      addToast({ type: 'success', message: successMessage });
      router.replace('/(app)/(tabs)/employer');
    } catch (error) {
      logger.error('공고 등록 실패', error as Error);
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : '공고 등록에 실패했습니다.',
      });
    }
  }, [user, formData.location, formData.postingType, draft, createJobPosting, addToast, router]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50 dark:bg-surface-dark" edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
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

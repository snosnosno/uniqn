import React, { useState, useCallback, useMemo } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { useCreateJobPosting } from '@/hooks/useJobManagement';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useTemplateManager } from '@/hooks/useTemplateManager';
import { useToastStore } from '@/stores/toastStore';
import { logger } from '@/utils/logger';
import type { JobPostingFormData } from '@/types';
import type { JobPostingDraft } from '@/types/jobPostingDraft';
import {
  buildCreateJobPostingInput,
  draftToFormData,
  patchJobPostingDraft,
} from '@/utils/job-posting/submission';
import { buildGridPrefillDraft } from '@/utils/job-posting/gridPrefill';
import { JobPostingScrollForm } from '@/components/employer/job-form';
import { TemplateModal } from '@/components/employer/job-form/modals/TemplateModal';
import { LoadTemplateModal } from '@/components/employer/job-form/modals/LoadTemplateModal';
import { StackHeader } from '@/components/headers';

export default function CreateJobPostingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { addToast } = useToastStore();

  // 주간 배치 그리드 "공고 열기/부족 모집" 진입 — venueId(운영처)·date(선택일)·count(부족 인원)를
  // 받아 초기 draft 에 프리필(P2-1). 일반 생성(파라미터 없음)은 완전 무회귀(buildGridPrefillDraft 폴백).
  const params = useLocalSearchParams<{
    venueId?: string | string[];
    date?: string | string[];
    count?: string | string[];
  }>();
  const firstParam = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v);
  const venueId = firstParam(params.venueId);
  const prefillDate = firstParam(params.date);
  const prefillCountRaw = firstParam(params.count);
  const prefillCount = prefillCountRaw ? Number.parseInt(prefillCountRaw, 10) : undefined;

  const [draft, setDraft] = useState<JobPostingDraft>(() =>
    buildGridPrefillDraft({ venueId, date: prefillDate, count: prefillCount })
  );
  const [isDirty, setIsDirty] = useState(false);
  const formData = useMemo(() => draftToFormData(draft), [draft]);

  useUnsavedChangesGuard(isDirty);

  const createJobPosting = useCreateJobPosting();
  const templateManager = useTemplateManager();

  const updateFormData = useCallback((data: Partial<JobPostingFormData>) => {
    setIsDirty(true);
    setDraft((prev) => patchJobPostingDraft(prev, data));
  }, []);

  const handleSaveTemplate = useCallback(async () => {
    await templateManager.handleSaveTemplate(draft);
  }, [templateManager, draft]);

  const handleLoadTemplateFromModal = useCallback(
    async (template: Parameters<typeof templateManager.handleLoadTemplate>[0]) => {
      const loadedDraft = await templateManager.handleLoadTemplate(template);
      // 템플릿은 운영처 FK 를 보유하지 않으므로(footgun 회피, P6-1), 그리드에서 진입한
      // venueId 바인딩은 템플릿 로드 후에도 유지한다.
      const mergedDraft = venueId ? { ...loadedDraft, venueId } : loadedDraft;
      setDraft(mergedDraft);
      return draftToFormData(mergedDraft);
    },
    [templateManager, venueId]
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
          ? '공고가 등록되었습니다. 관리자 승인 후 게시됩니다.'
          : '공고가 등록되었습니다.';
      addToast({ type: 'success', message: successMessage });
      // P2-2: 그리드 진입(venueId)이면 스택 하부의 그리드로 복귀(선택 운영처·날짜 보존).
      // 셀 +N 뱃지 갱신은 useCreateJobPosting 의 weeklyGrid 무효화가 담당.
      if (venueId && router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(app)/(tabs)/employer');
      }
    } catch (error) {
      logger.error('공고 등록 실패', error as Error);
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : '공고 등록에 실패했습니다.',
      });
    }
  }, [
    user,
    formData.location,
    formData.postingType,
    draft,
    createJobPosting,
    addToast,
    router,
    venueId,
  ]);

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      <StackHeader title="공고 작성" fallbackHref="/(app)/(tabs)/employer" />
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

      {templateManager.isTemplateModalOpen ? (
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
      ) : null}

      {templateManager.isLoadTemplateModalOpen ? (
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
      ) : null}
    </SafeAreaView>
  );
}

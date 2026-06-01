import React, { useState, useCallback, useMemo } from 'react';
import { KeyboardAvoidingView, Platform, View, Text } from 'react-native';
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
import { StackHeader } from '@/components/headers';
import { PaywallModal, WalletBalanceBadge } from '@/components/wallet';
import { usePostingCost } from '@/hooks/usePostingCost';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { usePurchaseSheetStore } from '@/stores/purchaseSheetStore';
import { isAppError, ERROR_CODES } from '@/errors';

export default function CreateJobPostingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { addToast } = useToastStore();

  const [draft, setDraft] = useState<JobPostingDraft>(INITIAL_JOB_POSTING_DRAFT);
  const [isDirty, setIsDirty] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const openPurchaseSheet = usePurchaseSheetStore((s) => s.open);
  const wallet = useWalletBalance();
  const formData = useMemo(() => draftToFormData(draft), [draft]);

  useUnsavedChangesGuard(isDirty);

  const createJobPosting = useCreateJobPosting();
  const templateManager = useTemplateManager();
  const postingCost = usePostingCost(formData.postingType ?? 'regular', user?.uid);

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
          ? '공고가 등록되었습니다. 관리자 승인 후 게시됩니다.'
          : '공고가 등록되었습니다.';
      addToast({ type: 'success', message: successMessage });
      router.replace('/(app)/(tabs)/employer');
    } catch (error) {
      if (isAppError(error) && error.code === ERROR_CODES.BUSINESS_INSUFFICIENT_BALANCE) {
        setShowPaywall(true);
        return;
      }
      logger.error('공고 등록 실패', error as Error);
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : '공고 등록에 실패했습니다.',
      });
    }
  }, [user, formData.location, formData.postingType, draft, createJobPosting, addToast, router]);

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      <StackHeader title="공고 작성" fallbackHref="/(app)/(tabs)/employer" />
      <View className="flex-row items-center justify-between px-4 py-2">
        <Text className="text-xs font-sans text-secondary-500 dark:text-secondary-400">
          보유 잔액
        </Text>
        <WalletBalanceBadge testID="create-wallet-badge" />
      </View>
      <View className="flex-row items-center justify-between px-4 pb-2">
        <Text className="text-xs font-sans text-secondary-500 dark:text-secondary-400">
          게시 비용
        </Text>
        <Text className="text-sm font-sans-semibold text-content-primary dark:text-secondary-100">
          {postingCost.data === null || postingCost.data === undefined
            ? '—'
            : postingCost.data.cost === 0
              ? '무료'
              : `${postingCost.data.cost}${postingCost.data.currency_hint === 'heart_first' ? '💖' : '💎'}`}
        </Text>
      </View>
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

      <PaywallModal
        visible={showPaywall}
        cost={postingCost.data?.cost ?? 0}
        currencyHint={postingCost.data?.currency_hint ?? 'diamond'}
        heartBalance={wallet.data?.heart_balance ?? 0}
        diamondBalance={wallet.data?.diamond_balance ?? 0}
        onClose={() => setShowPaywall(false)}
        onCharge={() => {
          setShowPaywall(false);
          openPurchaseSheet();
        }}
      />
    </SafeAreaView>
  );
}

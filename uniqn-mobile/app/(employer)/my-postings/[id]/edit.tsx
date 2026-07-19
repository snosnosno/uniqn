import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Loading } from '@/components';
import { StackHeader } from '@/components/headers';
import { OrderSheetScreen } from '@/components/employer/order-sheet/OrderSheetScreen';
import { TemplateModal } from '@/components/employer/job-form/modals/TemplateModal';
import { useAuth } from '@/hooks/useAuth';
import { useJobDetail } from '@/hooks/useJobDetail';
import { useUpdateJobPosting } from '@/hooks/useJobManagement';
import { useTemplateManager } from '@/hooks/useTemplateManager';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useToastStore } from '@/stores/toastStore';
import { logger } from '@/utils/logger';
import { toError } from '@/errors';
import { buildJobPostingDraft } from '@/utils/job-posting/submission';
import { isEmployerManageablePosting } from '@/utils/jobPostingVisibility';
import { draftToValues, formValuesToDraft, valuesToUpdateInput } from '@/utils/order-sheet/mappers';
import { HeaderQRAction, JobTitleSuffix, useJobDetailContext } from './_layout';
import type { OrderSheetFormValues, OrderSheetValues } from '@/schemas/orderSheet.schema';
import type { JobPostingDraft } from '@/types/jobPostingDraft';

/**
 * 공고 수정(S3) — 전 타입(지원·급구·대회·고정) 주문서 단일 경로.
 * 레거시 섹션 폼(JobPostingScrollForm 계열)은 S4에서 은퇴 완료(주문서 단일 경로).
 * 대회 편집은 approvalStatus 보존(설계 확정 ⑥) — valuesToUpdateInput이 tournamentConfig를
 * 만질 수 없고(타입 계약), update 직렬화가 current에서 보존한다.
 */
export default function EditJobPostingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const { addToast } = useToastStore();

  const { job: existingJob, isLoading: isJobLoading, error: jobError } = useJobDetail(id || '');
  const { job: contextJob, handleShowQR } = useJobDetailContext();
  const headerBackHref = `/(employer)/my-postings/${id ?? ''}`;
  const headerJobTitle = existingJob?.title ?? contextJob?.title ?? null;
  const headerTitleSuffix = <JobTitleSuffix jobTitle={headerJobTitle} />;
  const headerRightAction = <HeaderQRAction onPress={handleShowQR} />;

  const [isDirty, setIsDirty] = useState(false);
  const { markClean } = useUnsavedChangesGuard(isDirty);

  const updateJobPosting = useUpdateJobPosting();
  const templateManager = useTemplateManager();

  const isManageable = existingJob ? isEmployerManageablePosting(existingJob) : true;
  const hasConfirmedApplicants = (existingJob?.filledPositions ?? 0) > 0;

  // 진입 안내 — 저장 후 쿼리 무효화로 existingJob이 갱신돼도 재발행 금지(1회 가드)
  const notifiedRef = useRef(false);
  useEffect(() => {
    if (!existingJob || notifiedRef.current) return;
    notifiedRef.current = true;
    if (!isEmployerManageablePosting(existingJob)) {
      addToast({ type: 'warning', message: '지원하지 않는 공고 형식입니다.' });
      router.replace('/(app)/(tabs)/employer');
      return;
    }
    if ((existingJob.filledPositions ?? 0) > 0) {
      addToast({
        type: 'warning',
        message: '확정된 지원자가 있어 일정과 역할 정보 수정이 제한됩니다.',
      });
    }
  }, [existingJob, addToast, router]);

  // 편집 하이드레이션 — draftToValues는 전 타입 복원(S1 dated 그룹핑·S2 fixed·대회 보존).
  // RHF defaultValues는 첫 마운트만 소비하므로 existingJob 갱신에 따른 재계산은 무해.
  const initialValues = useMemo<OrderSheetFormValues | null>(() => {
    if (!existingJob || !isEmployerManageablePosting(existingJob)) return null;
    try {
      return draftToValues(buildJobPostingDraft(existingJob));
    } catch (error) {
      // 복원 불가 형상(손상 데이터) — 프리셋 방어(create.tsx)와 동형. 아래 에러 화면으로 유도.
      logger.error('공고 편집 하이드레이션 실패', toError(error), { jobPostingId: id });
      return null;
    }
  }, [existingJob, id]);

  const handleSubmit = useCallback(
    async (values: OrderSheetValues) => {
      if (!id) return;
      try {
        const input = valuesToUpdateInput(values, { hasConfirmedApplicants });
        await updateJobPosting.mutateAsync({ jobPostingId: id, input });
        setIsDirty(false);
        // 저장 성공 — setIsDirty(false) 리렌더 전 같은 틱의 back()이 stale 가드에 걸리지 않게
        // 동기 표식(S3 이월 ④). markClean 없이는 저장 후에도 "변경사항 저장 안 됨"이 뜰 수 있다.
        markClean();
        // 성공·실패 토스트는 useUpdateJobPosting(onSuccess/onError)가 담당 — 화면 중복 발행 제거.
        router.back();
      } catch (error) {
        logger.error('주문서 공고 수정 실패', toError(error), { jobPostingId: id });
      }
    },
    [id, hasConfirmedApplicants, updateJobPosting, router, markClean]
  );

  // 템플릿 저장 — create.tsx와 동일 굳힘 패턴.
  // ⚠️ handleSaveTemplate 직접 호출 금지: templateName이 비면 조용한 no-op(useTemplateManager) →
  //    반드시 openTemplateModal + TemplateModal 경유로 저장한다.
  const [orderSheetSaveDraft, setOrderSheetSaveDraft] = useState<JobPostingDraft | null>(null);
  const handleOrderSheetSaveTemplate = useCallback(
    (values: OrderSheetFormValues) => {
      setOrderSheetSaveDraft(formValuesToDraft(values));
      templateManager.openTemplateModal();
    },
    [templateManager]
  );
  const handleSaveOrderSheetTemplate = useCallback(async () => {
    if (!orderSheetSaveDraft) return;
    await templateManager.handleSaveTemplate(orderSheetSaveDraft);
  }, [templateManager, orderSheetSaveDraft]);

  if (isJobLoading || (existingJob && !isManageable)) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <StackHeader
          title="공고 수정"
          titleSuffix={headerTitleSuffix}
          fallbackHref={headerBackHref}
          rightAction={headerRightAction}
        />
        <View className="flex-1 items-center justify-center">
          <Loading size="large" />
          <Text className="mt-4 text-content-secondary font-sans">공고 정보를 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (jobError || !existingJob || initialValues === null) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <StackHeader
          title="공고 수정"
          titleSuffix={headerTitleSuffix}
          fallbackHref={headerBackHref}
          rightAction={headerRightAction}
        />
        <View className="flex-1 items-center justify-center p-4">
          <Text className="mb-2 text-lg font-display-semibold text-content-primary dark:text-off-white">
            공고를 불러올 수 없습니다
          </Text>
          <Text className="mb-4 text-center text-content-secondary font-sans">
            {jobError?.message || '공고 정보를 찾을 수 없습니다.'}
          </Text>
          <Button variant="primary" onPress={() => router.back()}>
            <Text className="font-sans-semibold text-content-onGold">돌아가기</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top']}>
      <StackHeader
        title="공고 수정"
        titleSuffix={headerTitleSuffix}
        fallbackHref={headerBackHref}
        rightAction={headerRightAction}
      />
      <OrderSheetScreen
        mode="edit"
        initialValues={initialValues}
        onSubmit={handleSubmit}
        isSubmitting={updateJobPosting.isPending}
        onDirtyChange={setIsDirty}
        myPhone={profile?.phone ?? ''}
        scheduleLocked={hasConfirmedApplicants}
        onSaveTemplate={handleOrderSheetSaveTemplate}
      />
      {/* 템플릿 이름 입력 모달 — 주문서 시트 닫힘 상태에서만 열려 중첩 RN Modal(#244) 위험 없음 */}
      {templateManager.isTemplateModalOpen ? (
        <TemplateModal
          visible={templateManager.isTemplateModalOpen}
          onClose={templateManager.closeTemplateModal}
          templateName={templateManager.templateName}
          templateDescription={templateManager.templateDescription}
          onTemplateNameChange={templateManager.setTemplateName}
          onTemplateDescriptionChange={templateManager.setTemplateDescription}
          onSave={handleSaveOrderSheetTemplate}
          isSaving={templateManager.isSavingTemplate}
        />
      ) : null}
    </SafeAreaView>
  );
}

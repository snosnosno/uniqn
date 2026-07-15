import React, { useState, useCallback, useMemo } from 'react';
import { KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { useCreateJobPosting, useMyJobPostings } from '@/hooks/useJobManagement';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useTemplateManager } from '@/hooks/useTemplateManager';
import { useToastStore } from '@/stores/toastStore';
import { logger } from '@/utils/logger';
import { toError } from '@/errors';
import type { JobPostingFormData } from '@/types';
import type { JobPostingDraft } from '@/types/jobPostingDraft';
import {
  buildCreateJobPostingInput,
  buildJobPostingDraft,
  draftToFormData,
  patchJobPostingDraft,
} from '@/utils/job-posting/submission';
import { buildGridPrefillDraft } from '@/utils/job-posting/gridPrefill';
import {
  draftToValues,
  formValuesToDraft,
  gridParamsToValues,
  primaryScheduleInfo,
  templateToValues,
  valuesToCreateInput,
  valuesToDraft,
} from '@/utils/order-sheet/mappers';
import { setLastSubmittedDraft } from '@/utils/order-sheet/lastSubmitted';
import { formatShortDate } from '@/utils/formatters/date';
import { JobPostingScrollForm } from '@/components/employer/job-form';
import { TemplateModal } from '@/components/employer/job-form/modals/TemplateModal';
import { LoadTemplateModal } from '@/components/employer/job-form/modals/LoadTemplateModal';
import { StackHeader } from '@/components/headers';
import { OrderSheetScreen } from '@/components/employer/order-sheet/OrderSheetScreen';
import type { OrderSheetPreset } from '@/components/employer/order-sheet/PresetCarousel';
import type { OrderSheetFormValues, OrderSheetValues } from '@/schemas/orderSheet.schema';

export default function CreateJobPostingScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
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
  const prefillCountParsed = prefillCountRaw ? Number.parseInt(prefillCountRaw, 10) : undefined;
  // gridParamsToValues/buildGridPrefillDraft는 NaN을 그대로 투과 → 유한값만 통과(비정상 count → 1 폴백)
  const prefillCount = Number.isFinite(prefillCountParsed) ? prefillCountParsed : undefined;

  const [draft, setDraft] = useState<JobPostingDraft>(() =>
    buildGridPrefillDraft({ venueId, date: prefillDate, count: prefillCount })
  );
  const [isDirty, setIsDirty] = useState(false);
  // 주문서(기본) vs 레거시 상세폼(고정 전용) 모드 분기 — legacyType!==null이면 상세폼 (대회는 S1에서 주문서로 이관)
  const [legacyType, setLegacyType] = useState<'fixed' | 'tournament' | null>(null);
  const isLegacyForm = legacyType !== null;
  const formData = useMemo(() => draftToFormData(draft), [draft]);

  // 주문서 초기값: 그리드 프리필 흡수(정규화 내장) + 프로필 연락처 프리필(리뷰 H4 — "재공고 타이핑 0")
  // useAuth().user는 AuthUser(phone 없음, phoneNumber만) → profile(UserProfile.phone) 사용
  const initialValues = useMemo<OrderSheetFormValues>(
    () => ({
      ...gridParamsToValues({ venueId, date: prefillDate, count: prefillCount }),
      contactPhone: profile?.phone ?? '',
    }),
    [venueId, prefillDate, prefillCount, profile?.phone]
  );

  useUnsavedChangesGuard(isDirty);

  const createJobPosting = useCreateJobPosting();
  const templateManager = useTemplateManager();

  // 프리셋 캐러셀 데이터 소스 — 내 공고 목록에서 진짜 최신 1건("마지막 공고").
  // 목록은 status 버킷별 concat(active→capacity_full→closed, 각 created_at desc)이라 [0]이
  // 전역 최신이 아닐 수 있어 createdAt 최댓값으로 선별한다(jobService.getMyJobPostings 실측).
  const myPostingsQuery = useMyJobPostings();
  const lastPosting = useMemo(() => {
    const list = myPostingsQuery.data ?? [];
    if (list.length === 0) return undefined;
    return list.reduce((latest, p) =>
      (p.createdAt?.getTime() ?? 0) > (latest.createdAt?.getTime() ?? 0) ? p : latest
    );
  }, [myPostingsQuery.data]);

  // 프리셋 조립 — 마지막 공고 + 저장된 템플릿. 주문서로 표현 불가한 공고/템플릿(fixed·대회·
  // 날짜별 시간대 상이)은 draftToValues/templateToValues 가 throw 하므로 try/catch 로 조용히 제외한다.
  const presets = useMemo<OrderSheetPreset[]>(() => {
    const out: OrderSheetPreset[] = [];
    if (lastPosting) {
      try {
        const values = draftToValues(buildJobPostingDraft(lastPosting));
        out.push({
          id: 'last',
          title: '마지막 공고',
          icon: 'zap',
          subtitle: values.title,
          values: {
            ...values,
            scheduleGroups: (values.scheduleGroups ?? []).map((g) => ({ ...g, dates: [] })),
          },
        });
      } catch {
        // fixed·대회 등 주문서 밖 공고는 프리셋에서 제외
      }
    }
    for (const t of templateManager.templates) {
      try {
        out.push({
          id: t.id,
          title: t.name,
          subtitle: t.templateData.title ?? '',
          values: templateToValues(t),
        });
      } catch {
        // dated 아닌 템플릿은 제외
      }
    }
    return out;
  }, [lastPosting, templateManager.templates]);

  // 주문서 "＋ 저장" — 현재 폼 값을 draft 로 굳혀 두고(검증 우회) 템플릿 이름 입력 모달을 연다.
  // ⚠️ handleSaveTemplate 직접 호출 금지: templateName 이 비면 조용한 no-op(useTemplateManager) →
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

  const updateFormData = useCallback((data: Partial<JobPostingFormData>) => {
    // M7 복귀 경로: 레거시 상세폼에서 유형을 지원/급구로 되돌리면 주문서로 복귀
    if (data.postingType === 'regular' || data.postingType === 'urgent') {
      setLegacyType(null);
    }
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

  const handleOrderSheetSubmit = useCallback(
    async (values: OrderSheetValues) => {
      try {
        const input = valuesToCreateInput(values);
        const created = await createJobPosting.mutateAsync({ input });
        setIsDirty(false);
        // 그리드 진입(venueId)이면 스택 하부 그리드로 복귀(선택 운영처·날짜 보존) — 완료 화면 우회.
        // 셀 +N 뱃지 갱신은 useCreateJobPosting 의 weeklyGrid 무효화가 담당.
        if (venueId && router.canGoBack()) {
          addToast({
            type: 'success',
            message:
              values.postingType === 'tournament'
                ? '공고가 등록됐어요. 관리자 승인 후 게시돼요.'
                : '공고가 등록되었습니다.',
          });
          router.back();
        } else {
          // 완료 화면 전달 — draft 는 파라미터로 넘기기엔 커 모듈 캐시로 1회 전달(공유 X, 프리셋 저장용).
          setLastSubmittedDraft(valuesToDraft(values));
          // 다중 그룹 요약 규칙(리뷰 Eng-M2): 최소 날짜 + 그 그룹 첫 슬롯 + "외 N일" 접미
          const { primaryDate, startTime, totalDates } = primaryScheduleInfo(values);
          const summary = [
            primaryDate
              ? `${formatShortDate(primaryDate)}${totalDates > 1 ? ` 외 ${totalDates - 1}일` : ''}`
              : null,
            startTime ? `출근 ${startTime}` : null,
          ]
            .filter(Boolean)
            .join(' · ');
          router.replace({
            pathname: '/(employer)/my-postings/create-success',
            params: {
              id: created.id, // CreateJobPostingResult { id, jobPosting } — 실측 확정
              title: values.title,
              summary,
              suggestPreset: templateManager.templates.length === 0 ? '1' : '0',
              // 대회는 승인 후 게시 — 완료 화면 안내 문구 분기용(표시 전용, 서버 무변경)
              pending: values.postingType === 'tournament' ? '1' : '0',
            },
          });
        }
      } catch (error) {
        // 기존 handleSubmit과 동일 — unhandled rejection 금지(리뷰 MEDIUM)
        logger.error('주문서 공고 등록 실패', toError(error));
        addToast({
          type: 'error',
          message: error instanceof Error ? error.message : '공고 등록에 실패했습니다.',
        });
      }
    },
    [createJobPosting, venueId, router, addToast, templateManager.templates.length]
  );

  const handleSwitchToLegacyForm = useCallback(
    (t: 'fixed' | 'tournament') => {
      // 주문서 입력이 있으면 무경고 소실 금지(리뷰 M7) — 확인 후 전환
      const doSwitch = () => {
        setLegacyType(t);
        updateFormData({ postingType: t });
      };
      if (isDirty) {
        Alert.alert(
          '작성 중인 내용이 있어요',
          '고정 공고는 상세 폼에서 작성해요. 지금까지 입력한 내용은 사라져요.',
          [
            { text: '취소', style: 'cancel' },
            { text: '전환', style: 'destructive', onPress: doSwitch },
          ]
        );
      } else {
        doSwitch();
      }
    },
    [isDirty, updateFormData]
  );

  // 기본 진입 = 주문서(지원·급구·대회). 고정 선택 시에만 레거시 상세폼으로 전환.
  if (!isLegacyForm) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top']}>
        <StackHeader title="공고 작성" fallbackHref="/(app)/(tabs)/employer" />
        <OrderSheetScreen
          initialValues={initialValues}
          onSubmit={handleOrderSheetSubmit}
          isSubmitting={createJobPosting.isPending}
          onSwitchToLegacyForm={handleSwitchToLegacyForm}
          onDirtyChange={setIsDirty}
          myPhone={profile?.phone ?? ''}
          presets={presets}
          onSaveTemplate={handleOrderSheetSaveTemplate}
        />
        {/* 프리셋 "＋ 저장" 이름 입력 모달 — 주문서 시트가 닫힌 상태(캐러셀은 본문 스크롤)에서만 열려
            중첩 RN Modal(#244) 위험이 없다. onSave 는 굳혀 둔 orderSheetSaveDraft 로 저장. */}
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

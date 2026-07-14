/**
 * UNIQN Mobile - 공고 등록 완료 화면
 *
 * @description 주문서 제출 성공 후 진입하는 확정 화면. (1) 등록 확인 (2) 공유로 지원자 유입 유도
 * (3) 방금 만든 구성을 프리셋으로 저장 제안 (4) 다음 행동(공고 보기 / 하나 더 등록)을 제시한다.
 * create.tsx handleOrderSheetSubmit 이 created.id 와 요약 파라미터를 넘겨 replace 한다.
 */
import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { TemplateModal } from '@/components/employer/job-form/modals/TemplateModal';
import { BookmarkOutlineIcon, CheckIcon, PlusIcon, ShareIcon } from '@/components/icons';
import { STATUS_COLORS, TEXT_COLORS } from '@/constants/colors';
import { useShare } from '@/hooks/useShare';
import { useTemplateManager } from '@/hooks/useTemplateManager';
import { clearLastSubmittedDraft, getLastSubmittedDraft } from '@/utils/order-sheet/lastSubmitted';

const first = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v);

export default function CreateSuccessScreen() {
  const params = useLocalSearchParams<{
    id?: string | string[];
    title?: string | string[];
    summary?: string | string[];
    suggestPreset?: string | string[];
  }>();
  const postingId = first(params.id);
  const title = first(params.title);
  const summary = first(params.summary);
  const suggestPreset = first(params.suggestPreset) === '1';
  const hasPostingId = !!postingId;

  const { shareJobById, isSharing } = useShare();
  const templateManager = useTemplateManager();

  // 방금 등록한 draft 를 mount 시 1회 snapshot 후 즉시 캐시를 비운다(1회성 계약) —
  // 앱 수명 잔류·조작 딥링크 재진입 시 이전 draft 재노출 경로 차단. snapshot 이라 이후 저장 대상은 고정.
  const [savedDraft] = useState(() => {
    const draft = getLastSubmittedDraft();
    clearLastSubmittedDraft();
    return draft;
  });
  const canSavePreset = suggestPreset && savedDraft !== null;

  const handleShare = useCallback(() => {
    if (!postingId) return;
    void shareJobById(postingId);
  }, [postingId, shareJobById]);

  const handleViewPosting = useCallback(() => {
    if (!postingId) return;
    router.replace(`/(employer)/my-postings/${postingId}`);
  }, [postingId]);

  const handleCreateAnother = useCallback(() => {
    router.replace('/(employer)/my-postings/create');
  }, []);

  const handleSavePreset = useCallback(async () => {
    if (!savedDraft) return;
    await templateManager.handleSaveTemplate(savedDraft);
  }, [savedDraft, templateManager]);

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      <View className="flex-1 justify-center px-5">
        {/* 확정 헤더 — 성공 아이콘 + 문구 */}
        <View className="items-center mb-8">
          <View className="w-16 h-16 rounded-full bg-success-100 items-center justify-center mb-4">
            <CheckIcon size={32} strokeWidth={2} color={STATUS_COLORS.success} />
          </View>
          <Text className="text-xl font-sans-bold text-content-primary">공고가 등록됐어요</Text>
          <Text className="text-sm text-content-secondary font-sans mt-1.5 text-center">
            지원자가 생기면 바로 알려드릴게요
          </Text>
        </View>

        {/* 등록 요약 카드 */}
        {title ? (
          <View className="rounded-2xl bg-surface-card border border-secondary-100 dark:border-surface-overlay px-4 py-3.5 mb-4">
            <Text className="text-sm font-sans-bold text-content-primary" numberOfLines={1}>
              {title}
            </Text>
            {summary ? (
              <Text className="text-xs text-content-muted font-sans mt-1" numberOfLines={1}>
                {summary}
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* 프리셋 저장 제안 — 저장된 템플릿이 없는 사용자에게만(suggestPreset). 골드는 아래 공유 CTA 전용. */}
        {canSavePreset ? (
          <View className="rounded-2xl bg-surface-card border border-secondary-100 dark:border-surface-overlay px-4 py-3.5 mb-4">
            <View className="flex-row items-start gap-2 mb-3">
              <BookmarkOutlineIcon size={18} />
              <Text className="flex-1 text-xs text-content-secondary font-sans leading-5">
                이 구성을 프리셋으로 저장하면 다음엔 몇 번의 탭으로 끝나요
              </Text>
            </View>
            <Button
              variant="outline"
              size="sm"
              onPress={templateManager.openTemplateModal}
              testID="create-success-save-preset"
            >
              프리셋으로 저장
            </Button>
          </View>
        ) : null}

        {/* 다음 행동 — 공유(지원자 유입, 유일한 골드 CTA) → 공고 보기 → 하나 더 등록 */}
        <View className="gap-2.5">
          <Button
            onPress={handleShare}
            disabled={!hasPostingId || isSharing}
            loading={isSharing}
            icon={<ShareIcon size={18} color={TEXT_COLORS.onGold} />}
            testID="create-success-share"
          >
            공고 공유하기
          </Button>
          <Button
            variant="secondary"
            onPress={handleViewPosting}
            disabled={!hasPostingId}
            testID="create-success-view"
          >
            공고 보기
          </Button>
          <Button
            variant="ghost"
            onPress={handleCreateAnother}
            icon={<PlusIcon size={18} />}
            testID="create-success-again"
          >
            하나 더 등록
          </Button>
        </View>
      </View>

      {/* 프리셋 저장 이름 입력 모달 — 이 화면에는 다른 Modal 이 없어 중첩(#244) 위험 없음. */}
      {templateManager.isTemplateModalOpen ? (
        <TemplateModal
          visible={templateManager.isTemplateModalOpen}
          onClose={templateManager.closeTemplateModal}
          templateName={templateManager.templateName}
          templateDescription={templateManager.templateDescription}
          onTemplateNameChange={templateManager.setTemplateName}
          onTemplateDescriptionChange={templateManager.setTemplateDescription}
          onSave={handleSavePreset}
          isSaving={templateManager.isSavingTemplate}
        />
      ) : null}
    </SafeAreaView>
  );
}

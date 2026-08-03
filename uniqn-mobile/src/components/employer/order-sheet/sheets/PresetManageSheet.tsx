/**
 * PresetManageSheet — 저장된 프리셋(공고 템플릿) 관리 시트.
 *
 * @description 캐러셀은 옛 '불러오기 모달'에서 **적용 기능만** 옮겨 왔고 관리 기능(행별 삭제)은
 * 모달과 함께 사라졌다 — 그 결과 앱 전체에 프리셋을 지우는 픽셀이 0개가 됐고, 프리셋은 쓸수록
 * 쌓이기만 했다. 이 시트가 그 회귀를 되돌린다(행별 이름변경 + 삭제).
 * 목록은 저장된 템플릿만 다룬다("마지막 공고"는 저장물이 아니라 파생 프리셋이라 관리 대상이 아니다).
 *
 * 🚨 삭제 확인에 confirmAction(네이티브 Alert)을 쓰는 이유 — 선택지 (a):
 *   SheetModal 은 RN `Modal` 기반이고 ToastManager 는 앱 루트에만 렌더된다. 즉 이 시트가 열려 있는
 *   동안 삭제 Undo 토스트는 Modal 뒤에 가려 **보이지도 눌리지도 않아 편도 삭제**가 된다.
 *   네이티브 Alert 은 Modal 위에 뜨므로 확인 다이얼로그가 시트 안에서 신뢰할 수 있는 유일한
 *   안전장치다. BlindPresetSheet 이 정확히 같은 이유로 같은 선택을 했다
 *   (`src/components/ops/BlindPresetSheet.tsx` — 시트 내부 삭제 = confirmAction).
 *   밑단의 Undo 타이머(5초)는 그대로 살아 있어 시트를 곧바로 닫으면 되돌리기 토스트를 잡을 수 있다.
 *   확인 다이얼로그를 고르고 시트를 닫지 않은 이유: 프리셋 정리는 연속 삭제 작업이라
 *   (c) 매번 시트를 닫는 방식은 사용자가 매 건마다 재진입해야 한다.
 *
 * 🚨 같은 이유로 **이름변경 에러는 토스트가 아니라 행 안 인라인 텍스트**로 말한다.
 *   (성공은 행 이름 자체가 바뀌어 보이므로 별도 표시가 필요 없다.)
 */
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { confirmAction } from '@/utils/confirmAction';
import { SECONDARY_PALETTE } from '@/constants/colors';
import {
  useDeleteTemplateWithUndo,
  useRenameTemplate,
  useTemplates,
} from '@/hooks/useTemplateManager';
import {
  TEMPLATE_NAME_MAX_LENGTH,
  isDuplicateTemplateName,
  templateNameSchema,
} from '@/schemas/jobTemplate.schema';
import type { JobPostingTemplate } from '@/types';

export interface PresetManageSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function PresetManageSheet({ visible, onClose }: PresetManageSheetProps) {
  const templatesQuery = useTemplates();
  // 매 렌더 새 배열이면 submitEdit(useCallback) 의 의존성이 계속 갈린다 — 린트 위생 수정.
  // (submitEdit 자체는 renameMutation 참조 때문에 여전히 매 렌더 재생성된다. 성능 개선 아님.)
  const templates = useMemo(() => templatesQuery.data ?? [], [templatesQuery.data]);
  const renameMutation = useRenameTemplate();
  const { handleDeleteTemplate } = useDeleteTemplateWithUndo();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  const startEdit = useCallback((template: JobPostingTemplate) => {
    setEditingId(template.id);
    setEditingName(template.name);
    setEditError(null);
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditingName('');
    setEditError(null);
  }, []);

  const submitEdit = useCallback(
    async (template: JobPostingTemplate) => {
      // ⚠️ 무변경 체크가 스키마 검증보다 **먼저**여야 한다.
      // templateNameSchema 의 2자 하한은 PR#406(2026-08-02)에서 처음 생겼는데, 템플릿 기능은
      // 2026-01 부터 있었고 그동안 생성 경로는 빈 문자열만 걸렀다(서버·DB 에도 길이 제약 없음).
      // 즉 1자 이름 프리셋이 실재할 수 있고, 그런 행은 이름변경에 들어가 **아무것도 안 바꾸고
      // 저장만 눌러도** parse 가 먼저 터져 "2자 이상" 에러에 갇힌다(취소로만 탈출).
      // 무변경은 쓰기가 없는 early-return 이므로 검증을 건너뛰어도 위험이 없다.
      // (레거시 데이터 자체는 그대로 남는다 — 훗날 DB CHECK 를 걸려면 백필이 선행돼야 한다.)
      if (editingName.trim() === template.name.trim()) {
        cancelEdit();
        return;
      }

      // 저장 경로와 같은 스키마(templateNameSchema) — 한쪽만 검증하면 축이 갈린다.
      const parsed = templateNameSchema.safeParse(editingName);
      if (!parsed.success) {
        setEditError(parsed.error.issues[0]?.message ?? '프리셋 이름을 확인해주세요.');
        return;
      }
      const nextName = parsed.data;

      // 자기 자신은 중복 판정에서 제외(excludeId) — 대소문자만 바꾸는 수정도 통과해야 한다.
      if (isDuplicateTemplateName(nextName, templates, template.id)) {
        setEditError('같은 이름의 프리셋이 이미 있습니다.');
        return;
      }

      try {
        await renameMutation.mutateAsync({ templateId: template.id, name: nextName });
        cancelEdit();
      } catch {
        // 토스트는 시트 뒤에 가려 보이지 않는다 — 실패 사유를 행 안에 남긴다.
        setEditError('이름 변경에 실패했어요. 잠시 후 다시 시도해주세요.');
      }
    },
    [cancelEdit, editingName, renameMutation, templates]
  );

  const requestDelete = useCallback(
    (template: JobPostingTemplate) => {
      confirmAction({
        title: '프리셋 삭제',
        message: `'${template.name}' 프리셋을 삭제할까요?`,
        confirmText: '삭제',
        destructive: true,
        onConfirm: () => {
          void handleDeleteTemplate(template.id, template.name);
          if (editingId === template.id) {
            cancelEdit();
          }
        },
      });
    },
    [cancelEdit, editingId, handleDeleteTemplate]
  );

  return (
    <SheetModal visible={visible} onClose={onClose} title="프리셋 관리">
      <View className="pb-6">
        {templatesQuery.isLoading && templates.length === 0 ? (
          <View className="items-center px-4 py-8">
            <ActivityIndicator accessibilityLabel="프리셋 불러오는 중" />
          </View>
        ) : null}

        {!templatesQuery.isLoading && templates.length === 0 ? (
          <View className="px-4 py-8">
            <Text className="text-center text-sm font-sans text-content-muted">
              저장된 프리셋이 없어요 — 주문서의 &quot;＋ 저장&quot;으로 만들 수 있어요
            </Text>
          </View>
        ) : null}

        {templates.map((template) =>
          editingId === template.id ? (
            /* 편집 모드 — 이름 입력 + 저장/취소 */
            <View
              key={template.id}
              className="border-b border-secondary-200 px-4 py-3 dark:border-surface-overlay"
              testID={`preset-manage-editing-${template.id}`}
            >
              <TextInput
                value={editingName}
                onChangeText={(next) => {
                  setEditingName(next);
                  setEditError(null);
                }}
                placeholder="프리셋 이름"
                placeholderTextColor={SECONDARY_PALETTE[400]}
                maxLength={TEMPLATE_NAME_MAX_LENGTH}
                autoFocus
                accessibilityLabel="프리셋 이름 입력"
                className="rounded-md border border-secondary-300 bg-surface-page px-3 py-2 font-sans text-content-primary dark:border-surface-overlay dark:bg-surface dark:text-off-white"
              />
              {editError ? (
                <Text className="mt-1 font-sans text-xs text-error-500 dark:text-error-400">
                  {editError}
                </Text>
              ) : null}
              <View className="mt-2 flex-row justify-end gap-2">
                <Pressable
                  onPress={cancelEdit}
                  disabled={renameMutation.isPending}
                  accessibilityRole="button"
                  accessibilityLabel="이름 변경 취소"
                  className="min-h-[44px] min-w-[44px] items-center justify-center rounded-md px-3 active:opacity-70"
                >
                  <Text className="font-sans text-sm text-content-secondary">취소</Text>
                </Pressable>
                <Pressable
                  onPress={() => void submitEdit(template)}
                  disabled={renameMutation.isPending}
                  accessibilityRole="button"
                  accessibilityLabel="이름 변경 저장"
                  className={`min-h-[44px] items-center justify-center rounded-md px-4 ${
                    renameMutation.isPending
                      ? 'bg-secondary-400'
                      : 'bg-primary-600 active:opacity-70'
                  }`}
                >
                  <Text className="font-sans-semibold text-sm text-content-onGold">
                    {renameMutation.isPending ? '저장 중…' : '저장'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            /* 조회 모드 — 이름 · [이름 변경] · [삭제]
               세 요소는 형제로 둔다: Pressable 을 중첩하면 웹에서 <button> in <button>
               하이드레이션 에러가 나고 스크린리더가 자식 텍스트를 삼킨다(BlindPresetSheet 선례). */
            <View
              key={template.id}
              className="flex-row items-center border-b border-secondary-200 px-4 py-3 dark:border-surface-overlay"
              testID={`preset-manage-row-${template.id}`}
            >
              <View className="flex-1 pr-2">
                <Text
                  className="font-sans-medium text-content-primary dark:text-off-white"
                  numberOfLines={1}
                >
                  {template.name}
                </Text>
                {template.templateData?.title ? (
                  <Text className="font-sans text-xs text-content-muted" numberOfLines={1}>
                    {template.templateData.title}
                  </Text>
                ) : null}
              </View>
              <Pressable
                onPress={() => startEdit(template)}
                accessibilityRole="button"
                accessibilityLabel={`${template.name} 이름 변경`}
                className="min-h-[44px] min-w-[44px] items-center justify-center px-2 active:opacity-70"
              >
                <Text className="font-sans text-xs text-content-secondary">이름 변경</Text>
              </Pressable>
              <Pressable
                onPress={() => requestDelete(template)}
                accessibilityRole="button"
                accessibilityLabel={`${template.name} 삭제`}
                className="min-h-[44px] min-w-[44px] items-center justify-center px-2 active:opacity-70"
              >
                <Text className="font-sans text-xs text-error-600 dark:text-error-400">삭제</Text>
              </Pressable>
            </View>
          )
        )}
      </View>
    </SheetModal>
  );
}

import { useEffect } from 'react';
import type { RefObject } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { ImageIcon, PaperPlaneOutlineIcon, XMarkIcon } from '@/components/icons';
import { Button, Card, Input } from '@/components/ui';
import { BoardDraftImageStrip } from './BoardDraftImageStrip';
import type { BoardImageAttachment, BoardMentionCandidate } from '@/types/board';

type BoardComposerMode = 'create' | 'reply' | 'edit';

interface BoardCommentComposerProps {
  mode: BoardComposerMode;
  value: string;
  images: BoardImageAttachment[];
  inputRef?: RefObject<TextInput | null>;
  autoFocus?: boolean;
  replyTargetName?: string;
  canInteract: boolean;
  canSelectMentions: boolean;
  mentionCandidates: BoardMentionCandidate[];
  selectedMentionIds: string[];
  isSubmitting: boolean;
  isUploadingImages: boolean;
  placeholder: string;
  onChangeText: (value: string) => void;
  onToggleMention: (userId: string) => void;
  onRemoveImage: (imageId: string) => void;
  onPickImages: () => void;
  onSubmit: () => void;
  onCancel?: () => void;
  onFocus?: () => void;
}

export function BoardCommentComposer({
  mode,
  value,
  images,
  inputRef,
  autoFocus = false,
  replyTargetName,
  canInteract,
  canSelectMentions,
  mentionCandidates,
  selectedMentionIds,
  isSubmitting,
  isUploadingImages,
  placeholder,
  onChangeText,
  onToggleMention,
  onRemoveImage,
  onPickImages,
  onSubmit,
  onCancel,
  onFocus,
}: BoardCommentComposerProps) {
  useEffect(() => {
    if (!autoFocus || !inputRef?.current) {
      return undefined;
    }

    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 120);

    return () => clearTimeout(timer);
  }, [autoFocus, inputRef]);

  const isSubmitDisabled = !canInteract || !value.trim() || isSubmitting;
  const showHeader = mode !== 'create';
  const headerLabel =
    mode === 'reply' && replyTargetName
      ? `↳ @${replyTargetName} 답글`
      : mode === 'edit'
        ? '댓글 수정 중'
        : '';
  const headerAccessibilityLabel = mode === 'reply' ? '답글 작성' : '댓글 수정';

  return (
    <Card>
      {showHeader ? (
        <View className="mb-3 flex-row items-center justify-between gap-2">
          <Text
            accessibilityLabel={headerAccessibilityLabel}
            className="flex-1 text-xs font-sans-medium text-primary-700 dark:text-primary-300"
          >
            {headerLabel}
          </Text>
          {onCancel ? (
            <Pressable
              onPress={onCancel}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="취소"
              className="rounded-sm p-1 active:opacity-70"
            >
              <XMarkIcon size={16} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <Input
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        multiline
        textAlignVertical="top"
        numberOfLines={2}
        editable={canInteract}
        accessibilityLabel="댓글 내용"
        onFocus={onFocus}
      />

      {canSelectMentions ? (
        <View className="mt-3 flex-row flex-wrap gap-2">
          {mentionCandidates.map((candidate) => {
            const isSelected = selectedMentionIds.includes(candidate.userId);

            return (
              <Pressable
                key={candidate.userId}
                onPress={() => onToggleMention(candidate.userId)}
                className={`rounded-sm px-2.5 py-1 ${
                  isSelected
                    ? 'bg-primary-100 dark:bg-primary-900/30'
                    : 'bg-secondary-100 dark:bg-surface-elevated'
                }`}
              >
                <Text className="text-xs text-content-secondary dark:text-secondary-200 font-sans">
                  @{candidate.displayName}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <BoardDraftImageStrip images={images} onRemoveImage={onRemoveImage} />

      <View className="mt-4 flex-row items-center gap-2">
        <Pressable
          onPress={onPickImages}
          disabled={!canInteract || isUploadingImages}
          accessibilityRole="button"
          accessibilityLabel="이미지 첨부"
          hitSlop={6}
          className={`rounded-sm border border-secondary-200 bg-surface-card p-2.5 dark:border-surface-overlay dark:bg-surface-elevated ${
            !canInteract || isUploadingImages ? 'opacity-50' : 'active:opacity-70'
          }`}
        >
          <ImageIcon size={20} />
        </Pressable>
        <Button
          className="flex-1"
          loading={isSubmitting}
          icon={<PaperPlaneOutlineIcon size={18} color="#09090B" />}
          onPress={onSubmit}
          disabled={isSubmitDisabled}
        >
          등록
        </Button>
      </View>
    </Card>
  );
}

export default BoardCommentComposer;

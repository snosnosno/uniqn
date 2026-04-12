import { useEffect } from 'react';
import type { RefObject } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { ImageIcon, PaperPlaneOutlineIcon } from '@/components/icons';
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

  const title = mode === 'edit' ? '댓글 수정' : mode === 'reply' ? '답글 작성' : '댓글 작성';
  const helperText =
    mode === 'reply' && replyTargetName
      ? `@${replyTargetName} 에게 답글을 남기는 중이에요.`
      : mode === 'edit'
        ? '댓글 내용을 수정 중이에요.'
        : null;
  const isSubmitDisabled = !canInteract || !value.trim() || isSubmitting;

  return (
    <Card>
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-base font-sans-semibold text-secondary-900 dark:text-secondary-100">
          {title}
        </Text>
        {onCancel ? (
          <Pressable onPress={onCancel} className="active:opacity-70">
            <Text className="text-sm text-secondary-500 dark:text-secondary-400 font-sans">
              취소
            </Text>
          </Pressable>
        ) : null}
      </View>

      {helperText ? (
        <Text className="mb-2 text-sm text-primary-600 dark:text-primary-400 font-sans">
          {helperText}
        </Text>
      ) : null}

      <Input
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        multiline
        textAlignVertical="top"
        numberOfLines={5}
        editable={canInteract}
        accessibilityLabel="댓글 내용"
        onFocus={onFocus}
      />

      {canSelectMentions ? (
        <View className="mt-3">
          <Text className="mb-2 text-xs font-sans-medium text-secondary-500 dark:text-secondary-400">
            멘션
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {mentionCandidates.map((candidate) => {
              const isSelected = selectedMentionIds.includes(candidate.userId);

              return (
                <Pressable
                  key={candidate.userId}
                  onPress={() => onToggleMention(candidate.userId)}
                  className={`rounded-sm px-3 py-1.5 ${
                    isSelected
                      ? 'bg-primary-100 dark:bg-primary-900/30'
                      : 'bg-secondary-100 dark:bg-surface-elevated'
                  }`}
                >
                  <Text className="text-xs text-secondary-700 dark:text-secondary-200 font-sans">
                    @{candidate.displayName}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <BoardDraftImageStrip images={images} onRemoveImage={onRemoveImage} />

      <View className="mt-4 flex-row gap-3">
        <Button
          variant="outline"
          className="flex-1"
          icon={<ImageIcon size={18} color="#9A9078" />}
          onPress={onPickImages}
          disabled={!canInteract || isUploadingImages}
        >
          이미지
        </Button>
        <Button
          className="flex-1"
          loading={isSubmitting}
          icon={<PaperPlaneOutlineIcon size={18} color="#FFFFFF" />}
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

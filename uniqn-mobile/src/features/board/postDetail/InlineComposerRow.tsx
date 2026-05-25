import { createContext, useContext, type RefObject } from 'react';
import { type TextInput, View } from 'react-native';
import { BoardCommentComposer } from '@/components/board/BoardCommentComposer';
import { type BoardDetailComposerItem } from '@/components/board/boardDetailListItems';
import { type BoardImageAttachment, type BoardMentionCandidate } from '@/types/board';

export interface BoardDetailComposerContextValue {
  draftBody: string;
  draftImages: BoardImageAttachment[];
  inputRef: RefObject<TextInput | null>;
  replyTargetName?: string;
  canInteract: boolean;
  mentionCandidates: BoardMentionCandidate[];
  selectedMentionIds: string[];
  isCommentSubmitting: boolean;
  isUploadingCommentImages: boolean;
  composerPlaceholder: string;
  onChangeText: (value: string) => void;
  onToggleMention: (userId: string) => void;
  onRemoveImage: (imageId: string) => void;
  onPickImages: () => void;
  onSubmit: () => void;
  onCancel: () => void;
  onFocusItem: (itemKey: string) => void;
}

export const BoardDetailComposerContext = createContext<BoardDetailComposerContextValue | null>(
  null
);

export function InlineComposerRow({ item }: { item: BoardDetailComposerItem }) {
  const composerContext = useContext(BoardDetailComposerContext);

  if (!composerContext) {
    return null;
  }

  const composerMentions =
    item.mode === 'edit' ? ([] as BoardMentionCandidate[]) : composerContext.mentionCandidates;

  return (
    <View className={`mb-3 ${item.mode === 'create' ? 'mt-4' : 'mt-2'}`}>
      <BoardCommentComposer
        mode={item.mode}
        value={composerContext.draftBody}
        images={composerContext.draftImages}
        inputRef={composerContext.inputRef}
        autoFocus={item.mode !== 'create'}
        replyTargetName={item.mode === 'reply' ? composerContext.replyTargetName : undefined}
        canInteract={composerContext.canInteract}
        canSelectMentions={
          composerContext.canInteract && item.mode !== 'edit' && composerMentions.length > 0
        }
        mentionCandidates={composerMentions}
        selectedMentionIds={composerContext.selectedMentionIds}
        isSubmitting={composerContext.isCommentSubmitting}
        isUploadingImages={composerContext.isUploadingCommentImages}
        placeholder={composerContext.composerPlaceholder}
        onChangeText={composerContext.onChangeText}
        onToggleMention={composerContext.onToggleMention}
        onRemoveImage={composerContext.onRemoveImage}
        onPickImages={composerContext.onPickImages}
        onSubmit={composerContext.onSubmit}
        onCancel={item.mode === 'create' ? undefined : composerContext.onCancel}
        onFocus={() => composerContext.onFocusItem(item.key)}
      />
    </View>
  );
}

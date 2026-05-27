import { useContext } from 'react';
import { View } from 'react-native';
import { BoardCommentComposer } from '@/components/board/BoardCommentComposer';
import { type BoardDetailComposerItem } from '@/components/board/boardDetailListItems';
import { type BoardMentionCandidate } from '@/types/board';
import {
  BoardDetailComposerContext,
  type BoardDetailComposerContextValue,
} from './boardPostDetailUtils';

// 레이어 정합을 위해 컨텍스트 정의는 boardPostDetailUtils 로 이전했고,
// 기존 import 경로(`./InlineComposerRow`) 호환을 위해 re-export 한다.
export { BoardDetailComposerContext };
export type { BoardDetailComposerContextValue };

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

/**
 * outbox — 아직 서버에 없는 내 메시지 상태 전이 (순수 리듀서)
 *
 * 방 화면 로컬 상태다. 쿼리 캐시에 넣지 않고(R1 — 캐시 쓰기는 무효화뿐), 저장하지도 않는다
 * (오프라인 큐 없음). 재전송은 **같은 clientMessageId** 로만 한다 — 서버가 멱등키로 중복을 막는다.
 */
import type { ChatOutboxItem, ChatOutboxStage } from '@/types/chat';

export type ChatOutboxAction =
  | { type: 'enqueue'; item: ChatOutboxItem }
  | { type: 'markFailed'; clientMessageId: string; errorMessage: string }
  | { type: 'markSent'; clientMessageId: string }
  | { type: 'retry'; clientMessageId: string }
  | { type: 'setStage'; clientMessageId: string; stage: ChatOutboxStage }
  | { type: 'remove'; clientMessageId: string };

function update(
  state: readonly ChatOutboxItem[],
  clientMessageId: string,
  patch: Partial<ChatOutboxItem>
): ChatOutboxItem[] {
  return state.map((item) =>
    item.clientMessageId === clientMessageId ? { ...item, ...patch } : item
  );
}

export function chatOutboxReducer(
  state: readonly ChatOutboxItem[],
  action: ChatOutboxAction
): ChatOutboxItem[] {
  switch (action.type) {
    case 'enqueue':
      if (state.some((i) => i.clientMessageId === action.item.clientMessageId)) return [...state];
      return [...state, action.item];
    case 'markFailed':
      return update(state, action.clientMessageId, {
        status: 'failed',
        errorMessage: action.errorMessage,
      });
    case 'markSent':
      return update(state, action.clientMessageId, { status: 'sent', errorMessage: undefined });
    case 'retry':
      return update(state, action.clientMessageId, { status: 'sending', errorMessage: undefined });
    case 'setStage':
      return update(state, action.clientMessageId, { stage: action.stage });
    case 'remove':
      return state.filter((i) => i.clientMessageId !== action.clientMessageId);
    default:
      return [...state];
  }
}

/**
 * UNIQN Mobile - 인앱 메시지 스토어
 *
 * @description Zustand 기반 인앱 메시지 상태 관리
 * @version 1.0.0
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from '@/lib/mmkvStorage';
import type {
  InAppMessage,
  InAppMessageState,
  InAppMessageActions,
  InAppMessageHistory,
} from '@/types/inAppMessage';

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = 'uniqn-in-app-messages';

// ============================================================================
// Store
// ============================================================================

export const useInAppMessageStore = create<InAppMessageState & InAppMessageActions>()(
  persist(
    (set, get) => ({
      // State
      messageQueue: [],
      currentMessage: null,
      history: {},
      allMessages: [],
      isLoading: false,
      sessionShownIds: new Set<string>(),

      // Actions
      setMessages: (messages: InAppMessage[]) => {
        set({ allMessages: messages });
      },

      enqueueMessage: (message: InAppMessage) => {
        const { messageQueue, currentMessage } = get();

        // 이미 큐에 있으면 추가하지 않음
        if (messageQueue.some((m) => m.id === message.id)) {
          return;
        }

        // 현재 표시 중인 메시지와 같으면 추가하지 않음
        if (currentMessage?.id === message.id) {
          return;
        }

        // 우선순위에 따라 정렬하여 추가
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const updatedQueue = [...messageQueue, message].sort(
          (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
        );

        set({ messageQueue: updatedQueue });
      },

      showNextMessage: () => {
        const { messageQueue, currentMessage } = get();

        // 이미 표시 중인 메시지가 있으면 무시
        if (currentMessage) {
          return;
        }

        // 큐에서 다음 메시지 가져오기
        if (messageQueue.length > 0) {
          const [nextMessage, ...remainingQueue] = messageQueue;
          set({
            currentMessage: nextMessage,
            messageQueue: remainingQueue,
          });
        }
      },

      dismissCurrentMessage: () => {
        const { currentMessage } = get();

        if (currentMessage) {
          // 이력 기록
          get().recordMessageShown(currentMessage.id);
        }

        set({ currentMessage: null });

        // 다음 메시지 표시
        setTimeout(() => {
          get().showNextMessage();
        }, 300); // 애니메이션 후 표시
      },

      recordMessageShown: (messageId: string) => {
        const { history } = get();
        const now = new Date().toISOString();

        const existing = history[messageId];
        const updated: InAppMessageHistory = {
          messageId,
          lastShownAt: now,
          shownCount: (existing?.shownCount ?? 0) + 1,
          dismissed: existing?.dismissed ?? false,
        };

        set({
          history: {
            ...history,
            [messageId]: updated,
          },
        });
      },

      dismissMessagePermanently: (messageId: string) => {
        const { history, currentMessage, messageQueue } = get();
        const now = new Date().toISOString();

        // 이력 업데이트
        const existing = history[messageId];
        const updated: InAppMessageHistory = {
          messageId,
          lastShownAt: existing?.lastShownAt ?? now,
          shownCount: existing?.shownCount ?? 1,
          dismissed: true,
        };

        // 현재 메시지면 닫기
        const newCurrentMessage = currentMessage?.id === messageId ? null : currentMessage;

        // 큐에서도 제거
        const newQueue = messageQueue.filter((m) => m.id !== messageId);

        set({
          history: {
            ...history,
            [messageId]: updated,
          },
          currentMessage: newCurrentMessage,
          messageQueue: newQueue,
        });

        // 다음 메시지 표시
        if (!newCurrentMessage) {
          setTimeout(() => {
            get().showNextMessage();
          }, 300);
        }
      },

      clearHistory: () => {
        set({ history: {} });
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      addSessionShownId: (messageId: string) => {
        const { sessionShownIds } = get();
        if (!sessionShownIds.has(messageId)) {
          set({ sessionShownIds: new Set(sessionShownIds).add(messageId) });
        }
      },

      hasSessionShownId: (messageId: string) => {
        return get().sessionShownIds.has(messageId);
      },

      resetSessionIds: () => {
        set({ sessionShownIds: new Set<string>() });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => mmkvStorage),
      // history만 영구 저장 (메시지 큐는 세션 데이터)
      partialize: (state) => ({
        history: state.history,
      }),
    }
  )
);

// ============================================================================
// Selectors
// ============================================================================

/**
 * 현재 표시할 메시지가 있는지 확인
 */
export const selectHasMessage = (state: InAppMessageState): boolean =>
  state.currentMessage !== null;

/**
 * 큐에 대기 중인 메시지 수
 */
export const selectQueueCount = (state: InAppMessageState): number => state.messageQueue.length;

/**
 * 특정 메시지가 이미 표시되었는지 확인
 */
export const selectIsMessageShown = (state: InAppMessageState, messageId: string): boolean => {
  const history = state.history[messageId];
  return history ? history.shownCount > 0 : false;
};

/**
 * 특정 메시지가 영구 닫힘 처리되었는지 확인
 */
export const selectIsMessageDismissed = (state: InAppMessageState, messageId: string): boolean => {
  const history = state.history[messageId];
  return history?.dismissed ?? false;
};

/**
 * 특정 메시지가 현재 세션에서 이미 표시되었는지 확인
 */
export const selectIsSessionShown = (state: InAppMessageState, messageId: string): boolean =>
  state.sessionShownIds.has(messageId);

// ============================================================================
// State Selectors (불필요한 리렌더링 방지)
// ============================================================================

/**
 * 현재 표시 중인 메시지
 */
export const selectCurrentMessage = (state: InAppMessageState) => state.currentMessage;

/**
 * 대기 중인 메시지 큐
 */
export const selectMessageQueue = (state: InAppMessageState) => state.messageQueue;

/**
 * 전체 메시지 목록
 */
export const selectAllMessages = (state: InAppMessageState) => state.allMessages;

/**
 * 로딩 상태
 */
export const selectIsLoading = (state: InAppMessageState) => state.isLoading;

// ============================================================================
// Action Selectors
// ============================================================================

export const selectDismissCurrentMessage = (state: InAppMessageState & InAppMessageActions) =>
  state.dismissCurrentMessage;

export const selectEnqueueMessage = (state: InAppMessageState & InAppMessageActions) =>
  state.enqueueMessage;

export const selectShowNextMessage = (state: InAppMessageState & InAppMessageActions) =>
  state.showNextMessage;

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * 현재 메시지 훅
 */
export const useCurrentMessage = () => useInAppMessageStore(selectCurrentMessage);

/**
 * 메시지 큐 훅
 */
export const useMessageQueue = () => useInAppMessageStore(selectMessageQueue);

/**
 * 인앱 메시지 액션 훅
 *
 * @description 전체 store 구독 대신 액션만 구독하여 리렌더링 최소화
 */
export const useInAppMessageActions = () => ({
  dismissCurrentMessage: useInAppMessageStore(selectDismissCurrentMessage),
  enqueueMessage: useInAppMessageStore(selectEnqueueMessage),
  showNextMessage: useInAppMessageStore(selectShowNextMessage),
});

export default useInAppMessageStore;

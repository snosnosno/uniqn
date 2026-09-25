/**
 * UNIQN Mobile - 채팅 화면 점유 상태 (Zustand, 비영속)
 *
 * @description 지금 화면에 떠 있는 채팅방 id. 포그라운드 푸시 핸들러가 읽어 그 방의 채팅 푸시
 *              배너를 억제한다(방 화면이 이미 실시간으로 보여 주므로 중복). 앱 재시작 후에는
 *              의미가 없어 persist 하지 않는다.
 */

import { create } from 'zustand';

interface ChatPresenceState {
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  /** 나가는 방이 아직 활성일 때만 비운다 — 방→방 전환에서 새 방 등록을 지우지 않게 */
  clearActiveConversationId: (id: string) => void;
}

export const useChatPresenceStore = create<ChatPresenceState>()((set, get) => ({
  activeConversationId: null,
  setActiveConversationId: (id) => set({ activeConversationId: id ? id.toLowerCase() : null }),
  clearActiveConversationId: (id) => {
    if (get().activeConversationId === id.toLowerCase()) {
      set({ activeConversationId: null });
    }
  },
}));

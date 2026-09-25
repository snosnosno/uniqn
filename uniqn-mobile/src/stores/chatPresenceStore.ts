/**
 * UNIQN Mobile - 채팅 화면 점유 상태 (Zustand, 비영속)
 *
 * @description 지금 포커스된 채팅방 id 들. 포그라운드 푸시 핸들러가 읽어 그 방의 채팅 푸시를
 *              통째로 삼킨다(OS 배너·인앱 토스트·로컬 배지 — 방 화면이 이미 실시간으로 보여 준다).
 *              앱 재시작 후에는 의미가 없어 persist 하지 않는다.
 *
 *              🔑 한 칸짜리 슬롯이 아니라 **방 id 별 참조 카운트**다. 같은 방이 스택에 두 번 쌓이면
 *              (알림센터 탭 등) 옛 인스턴스의 blur 정리와 새 인스턴스의 focus 등록 순서가 보장되지
 *              않아, 슬롯 방식은 보고 있는데도 비워질 수 있다(S3 리뷰 M).
 */

import { create } from 'zustand';

interface ChatPresenceState {
  /** 방 id(소문자) → 그 방을 포커스로 등록한 화면 수 */
  viewCounts: Readonly<Record<string, number>>;
  enterConversation: (id: string) => void;
  leaveConversation: (id: string) => void;
  isViewingConversation: (id: string) => boolean;
}

export const useChatPresenceStore = create<ChatPresenceState>()((set, get) => ({
  viewCounts: {},
  enterConversation: (id) => {
    const key = id.toLowerCase();
    set((state) => ({
      viewCounts: { ...state.viewCounts, [key]: (state.viewCounts[key] ?? 0) + 1 },
    }));
  },
  leaveConversation: (id) => {
    const key = id.toLowerCase();
    set((state) => {
      const next = (state.viewCounts[key] ?? 0) - 1;
      const { [key]: _removed, ...rest } = state.viewCounts;
      return { viewCounts: next > 0 ? { ...rest, [key]: next } : rest };
    });
  },
  isViewingConversation: (id) => (get().viewCounts[id.toLowerCase()] ?? 0) > 0,
}));

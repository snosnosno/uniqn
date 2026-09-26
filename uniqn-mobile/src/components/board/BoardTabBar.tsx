import { Pressable, ScrollView, Text, View } from 'react-native';
import { NotificationBadgeInline } from '@/components/notifications/NotificationBadge';
import type { CommunicationBoardType } from '@/types/board';

/** 게시판 두 칸 + 앱 내 채팅 칸(플래그 ON 일 때만) */
export type BoardTabKey = CommunicationBoardType | 'chat';

interface TabItem {
  key: BoardTabKey;
  label: string;
}

const BOARD_TABS: TabItem[] = [
  { key: 'schedule', label: '일정' },
  { key: 'notice', label: '공지' },
];

const CHAT_TAB: TabItem = { key: 'chat', label: '채팅' };

interface BoardTabBarProps {
  activeTab: BoardTabKey;
  onTabPress: (tab: BoardTabKey) => void;
  /** 채팅 칸 노출 — 칸이 flex-1 이라 3칸이 돼도 높이는 그대로다 */
  showChat?: boolean;
  /** 채팅 안 읽음 합계 — 0 보다 크면 채팅 칸 라벨 옆에 배지 */
  chatUnread?: number;
}

/** 소통 화면의 일정/공지(/채팅) 전환 탭 */
export function BoardTabBar({
  activeTab,
  onTabPress,
  showChat = false,
  chatUnread = 0,
}: BoardTabBarProps) {
  const tabs = showChat ? [...BOARD_TABS, CHAT_TAB] : BOARD_TABS;
  return (
    <ScrollView
      horizontal={false}
      contentContainerClassName="flex-row items-center px-4 py-2"
      className="border-b border-secondary-200 dark:border-surface-overlay"
      style={{ flexGrow: 0, flexShrink: 0 }}
    >
      {tabs.map(({ key, label }) => {
        const isActive = activeTab === key;
        const unread = key === 'chat' ? chatUnread : 0;
        return (
          <Pressable
            key={key}
            onPress={() => onTabPress(key)}
            accessibilityRole="tab"
            accessibilityLabel={
              unread > 0 ? `${label} 탭, 안 읽은 메시지 ${unread}개` : `${label} 탭`
            }
            accessibilityState={{ selected: isActive }}
            hitSlop={{ top: 8, bottom: 8 }}
            className={`flex-1 items-center rounded-xl px-3 py-2.5 ${
              isActive
                ? 'bg-primary-500 active:bg-primary-600 dark:bg-primary-400 dark:active:bg-primary-600'
                : 'bg-secondary-100 active:bg-secondary-200 dark:bg-surface-elevated dark:active:bg-surface-overlay'
            }`}
          >
            <View className="flex-row items-center">
              <Text
                className={`text-sm font-sans-semibold ${
                  isActive
                    ? 'text-content-onGold'
                    : 'text-content-secondary dark:text-secondary-300'
                }`}
              >
                {label}
              </Text>
              {unread > 0 ? (
                <NotificationBadgeInline count={unread} size="sm" className="ml-1" />
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

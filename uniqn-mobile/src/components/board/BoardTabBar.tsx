import { Pressable, ScrollView, Text } from 'react-native';
import type { CommunicationBoardType } from '@/types/board';

export type BoardTabKey = CommunicationBoardType;

interface TabItem {
  key: BoardTabKey;
  label: string;
}

const TABS: TabItem[] = [
  { key: 'schedule', label: '일정' },
  { key: 'notice', label: '공지' },
];

interface BoardTabBarProps {
  activeTab: BoardTabKey;
  onTabPress: (tab: BoardTabKey) => void;
}

/** 소통 화면의 일정/공지 전환 탭 */
export function BoardTabBar({ activeTab, onTabPress }: BoardTabBarProps) {
  return (
    <ScrollView
      horizontal={false}
      contentContainerClassName="flex-row items-center px-4 py-2"
      className="border-b border-secondary-200 dark:border-surface-overlay"
      style={{ flexGrow: 0, flexShrink: 0 }}
    >
      {TABS.map(({ key, label }) => {
        const isActive = activeTab === key;
        return (
          <Pressable
            key={key}
            onPress={() => onTabPress(key)}
            accessibilityRole="tab"
            accessibilityLabel={`${label} 탭`}
            accessibilityState={{ selected: isActive }}
            hitSlop={{ top: 8, bottom: 8 }}
            className={`flex-1 items-center rounded-xl px-3 py-2.5 ${
              isActive
                ? 'bg-primary-500 active:bg-primary-600 dark:bg-primary-400 dark:active:bg-primary-600'
                : 'bg-secondary-100 active:bg-secondary-200 dark:bg-surface-elevated dark:active:bg-surface-overlay'
            }`}
          >
            <Text
              className={`text-sm font-sans-semibold ${
                isActive ? 'text-content-onGold' : 'text-content-secondary dark:text-secondary-300'
              }`}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

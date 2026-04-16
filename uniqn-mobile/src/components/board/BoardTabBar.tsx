import { Pressable, ScrollView, Text } from 'react-native';
import type { BoardType } from '@/types/board';

export type BoardTabKey = 'home' | BoardType;

interface TabItem {
  key: BoardTabKey;
  label: string;
}

const TABS: TabItem[] = [
  { key: 'home', label: '홈' },
  { key: 'notice', label: '공지' },
  { key: 'schedule', label: '일정' },
  { key: 'free', label: '자유' },
  { key: 'tda', label: 'TDA' },
  { key: 'substitute', label: '대타' },
];

interface BoardTabBarProps {
  activeTab: BoardTabKey;
  onTabPress: (tab: BoardTabKey) => void;
}

/** 게시판 상단 탭 바 컴포넌트 */
export function BoardTabBar({ activeTab, onTabPress }: BoardTabBarProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="flex-row items-center gap-1.5 px-4 py-2"
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
            className={`self-center rounded-xl px-3 py-1.5 ${
              isActive
                ? 'bg-primary-500 dark:bg-primary-400'
                : 'bg-secondary-100 dark:bg-surface-elevated'
            }`}
          >
            <Text
              className={`text-sm font-sans-semibold ${
                isActive
                  ? 'text-white dark:text-black'
                  : 'text-content-muted dark:text-secondary-300'
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

export default BoardTabBar;

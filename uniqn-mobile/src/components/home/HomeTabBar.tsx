/**
 * HomeTabBar — 홈 화면 하단 표시 전용 탭바
 *
 * 홈은 (tabs)/ 밖의 스택 스크린이라 expo-router <Tabs>를 재사용 불가.
 * 시각은 기존 탭바와 동일, 상태는 모두 비활성(홈은 탭이 아님).
 * 탭 press 시 router.push로 해당 탭 화면으로 이동.
 */

import React from 'react';
import { View, Pressable, Text } from 'react-native';
import { router, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeIcon, CalendarIcon, MessageIcon, BriefcaseIcon, UserIcon } from '@/components/icons';
import { LAYOUT } from '@/constants';
import { getLayoutColor } from '@/constants/colors';
import { useThemeStore } from '@/stores/themeStore';

type TabItem = {
  label: string;
  route: Href;
  Icon: React.ComponentType<{ color: string; size: number }>;
};

const TABS: TabItem[] = [
  { label: '구인구직', route: '/(app)/(tabs)/home-jobs', Icon: HomeIcon },
  { label: '내 스케줄', route: '/(app)/(tabs)/schedule', Icon: CalendarIcon },
  { label: '게시판', route: '/(app)/(tabs)/board', Icon: MessageIcon },
  { label: '내 공고', route: '/(app)/(tabs)/employer', Icon: BriefcaseIcon },
  { label: '프로필', route: '/(app)/(tabs)/profile', Icon: UserIcon },
];

export function HomeTabBar() {
  const isDark = useThemeStore((s) => s.isDarkMode);
  const insets = useSafeAreaInsets();
  const bg = getLayoutColor(isDark, 'tabBarBg');
  const border = getLayoutColor(isDark, 'tabBarBorder');
  const inactive = getLayoutColor(isDark, 'tabBarInactive');

  return (
    <View
      style={{
        flexDirection: 'row',
        height: LAYOUT.TAB_BAR_HEIGHT + insets.bottom,
        paddingBottom: insets.bottom,
        backgroundColor: bg,
        borderTopWidth: 1,
        borderTopColor: border,
      }}
    >
      {TABS.map(({ label, route, Icon }) => (
        <Pressable
          key={label}
          onPress={() => router.push(route)}
          accessibilityRole="button"
          accessibilityLabel={`${label} 탭으로 이동`}
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
          }}
          hitSlop={4}
        >
          <Icon color={inactive} size={24} />
          <Text style={{ color: inactive, fontSize: 11, fontWeight: '600' }}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

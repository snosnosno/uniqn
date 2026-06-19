/**
 * UNIQN Mobile - Tabs Layout
 * 하단 탭 네비게이션 레이아웃
 */

import { useEffect, type ComponentType } from 'react';
import { Tabs, useNavigation } from 'expo-router';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeIcon, CalendarIcon, MessageIcon, BriefcaseIcon, UserIcon } from '@/components/icons';
import { LAYOUT } from '@/constants';
import { useThemeStore } from '@/stores/themeStore';
import { getLayoutColor, PRIMARY_COLORS, SURFACE_COLORS } from '@/constants/colors';

// `/(app)/(tabs)` 진입 시 기본 탭을 home-jobs로 해석.
// URL '/' (Splash) 및 공개 '/jobs' 와의 충돌 회피 — 구인구직 탭 URL = /home-jobs
export const unstable_settings = { initialRouteName: 'home-jobs' };

// 활성 탭 상단 2px 골드 underbar (디자인 현대화 Task 1.4)
const TAB_UNDERBAR_COLOR = PRIMARY_COLORS[500];
const TAB_BORDER_TOP_COLOR = SURFACE_COLORS.overlay;

type TabBarIconProps = { color: string; focused: boolean };

type IconComponent = ComponentType<{ color?: string; size?: number }>;

function renderTabBarIcon(Icon: IconComponent) {
  return function TabBarIcon({ color, focused }: TabBarIconProps) {
    return (
      <View style={{ alignItems: 'center', marginTop: focused ? 0 : 2 }}>
        {focused && (
          <View
            style={{
              width: 22,
              height: 2,
              backgroundColor: TAB_UNDERBAR_COLOR,
              borderRadius: 1,
              marginBottom: 2,
            }}
          />
        )}
        <Icon color={color} size={24} />
      </View>
    );
  };
}

export default function TabLayout() {
  const isDark = useThemeStore((s) => s.isDarkMode);
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  // 웹에서 탭 전환 시 aria-hidden 포커스 충돌 방지
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const unsubscribe = navigation.addListener('state', () => {
      const active = document.activeElement;
      if (
        active instanceof HTMLElement &&
        active.tagName !== 'INPUT' &&
        active.tagName !== 'TEXTAREA'
      ) {
        active.blur();
      }
    });

    return unsubscribe;
  }, [navigation]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: getLayoutColor(isDark, 'tabBarActive'),
        tabBarInactiveTintColor: getLayoutColor(isDark, 'tabBarInactive'),
        tabBarStyle: {
          backgroundColor: getLayoutColor(isDark, 'tabBarBg'),
          borderTopColor: TAB_BORDER_TOP_COLOR,
          height: LAYOUT.TAB_BAR_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="home-jobs"
        options={{
          title: '구인구직',
          tabBarIcon: renderTabBarIcon(HomeIcon),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: '내 스케줄',
          tabBarIcon: renderTabBarIcon(CalendarIcon),
        }}
      />
      <Tabs.Screen
        name="board"
        options={{
          title: '게시판',
          tabBarIcon: renderTabBarIcon(MessageIcon),
        }}
      />
      <Tabs.Screen
        name="qr"
        options={{
          href: null, // 탭바에서 숨김 (상단 버튼으로 접근)
        }}
      />
      <Tabs.Screen
        name="employer"
        options={{
          title: '내 공고',
          tabBarIcon: renderTabBarIcon(BriefcaseIcon),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '프로필',
          tabBarIcon: renderTabBarIcon(UserIcon),
        }}
      />
    </Tabs>
  );
}

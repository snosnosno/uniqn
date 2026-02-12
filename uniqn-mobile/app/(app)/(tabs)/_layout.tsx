/**
 * UNIQN Mobile - Tabs Layout
 * 하단 탭 네비게이션 레이아웃
 */

import { useEffect } from 'react';
import { Tabs, useNavigation } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeIcon, CalendarIcon, BriefcaseIcon, UserIcon } from '@/components/icons';
import { useThemeStore } from '@/stores/themeStore';
import { getLayoutColor } from '@/constants/colors';

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
          borderTopColor: getLayoutColor(isDark, 'tabBarBorder'),
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '구인구직',
          tabBarIcon: ({ color, size }) => <HomeIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: '내 스케줄',
          tabBarIcon: ({ color, size }) => <CalendarIcon color={color} size={size} />,
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
          tabBarIcon: ({ color, size }) => <BriefcaseIcon color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '프로필',
          tabBarIcon: ({ color, size }) => <UserIcon color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}

/**
 * UNIQN Mobile - [근무] 화면 탭 헤더
 * StaffSettlementsScreen에서 추출.
 *
 * 구인자 IA S2 — 탭 이름을 `스태프 관리 / 정산` 에서 `스태프 / 금액` 으로 바꾸고 정산 대기 배지를
 * 없앴다. 앱은 돈을 보내지 않으니 "대기" 건수가 없다. 내부 키(`'settlement'`)는 호출부 호환을 위해 둔다.
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useThemeStore } from '@/stores/themeStore';
import { UsersIcon, CurrencyWonIcon } from '@/components/icons';

export type TabType = 'staff' | 'settlement';

export interface TabHeaderProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  staffCount: number;
}

export function TabHeader({ activeTab, onTabChange, staffCount }: TabHeaderProps) {
  const { isDarkMode } = useThemeStore();
  const inactiveColor = isDarkMode ? SECONDARY_PALETTE[400] : SECONDARY_PALETTE[500];
  const primaryColor = isDarkMode ? '#D4AF37' : '#8A7228';
  const activeBadgeBg = isDarkMode ? '#2A2410' : '#F5EFDC';
  const inactiveBadgeBg = isDarkMode ? SECONDARY_PALETTE[800] : SECONDARY_PALETTE[100];

  const staffColor = activeTab === 'staff' ? primaryColor : inactiveColor;
  const amountColor = activeTab === 'settlement' ? primaryColor : inactiveColor;

  return (
    <View className="flex-row bg-surface-card border-b border-divider">
      <Pressable
        onPress={() => onTabChange('staff')}
        className="flex-1 flex-row items-center justify-center py-4"
        style={{
          borderBottomWidth: activeTab === 'staff' ? 2 : 0,
          borderBottomColor: primaryColor,
        }}
        accessibilityRole="tab"
        accessibilityLabel="스태프"
        accessibilityState={{ selected: activeTab === 'staff' }}
      >
        <UsersIcon size={20} color={staffColor} />
        <Text className="ml-2 text-base font-sans-medium" style={{ color: staffColor }}>
          스태프
        </Text>
        {staffCount > 0 && (
          <View
            className="ml-2 px-2 py-0.5 rounded-sm"
            style={{
              backgroundColor: activeTab === 'staff' ? activeBadgeBg : inactiveBadgeBg,
            }}
          >
            <Text className="text-xs font-sans-medium" style={{ color: staffColor }}>
              {staffCount}
            </Text>
          </View>
        )}
      </Pressable>

      <Pressable
        onPress={() => onTabChange('settlement')}
        className="flex-1 flex-row items-center justify-center py-4"
        style={{
          borderBottomWidth: activeTab === 'settlement' ? 2 : 0,
          borderBottomColor: primaryColor,
        }}
        accessibilityRole="tab"
        accessibilityLabel="금액"
        accessibilityState={{ selected: activeTab === 'settlement' }}
      >
        <CurrencyWonIcon size={20} color={amountColor} />
        <Text className="ml-2 text-base font-sans-medium" style={{ color: amountColor }}>
          금액
        </Text>
      </Pressable>
    </View>
  );
}

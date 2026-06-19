/**
 * UNIQN Mobile - 정산 화면 탭 헤더
 * StaffSettlementsScreen에서 추출. 렌더 결과·dark: 클래스 불변.
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
  settlementCount: number;
}

export function TabHeader({ activeTab, onTabChange, staffCount, settlementCount }: TabHeaderProps) {
  const { isDarkMode } = useThemeStore();
  const inactiveColor = isDarkMode ? SECONDARY_PALETTE[400] : SECONDARY_PALETTE[500];
  const primaryColor = isDarkMode ? '#D4AF37' : '#8A7228';
  const activeBadgeBg = isDarkMode ? '#2A2410' : '#F5EFDC';
  const inactiveBadgeBg = isDarkMode ? SECONDARY_PALETTE[800] : SECONDARY_PALETTE[100];

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
        accessibilityLabel="스태프 관리"
        accessibilityState={{ selected: activeTab === 'staff' }}
      >
        <UsersIcon size={20} color={activeTab === 'staff' ? primaryColor : inactiveColor} />
        <Text
          className="ml-2 text-base font-sans-medium"
          style={{
            color: activeTab === 'staff' ? primaryColor : inactiveColor,
          }}
        >
          스태프 관리
        </Text>
        {staffCount > 0 && (
          <View
            className="ml-2 px-2 py-0.5 rounded-sm"
            style={{
              backgroundColor: activeTab === 'staff' ? activeBadgeBg : inactiveBadgeBg,
            }}
          >
            <Text
              className="text-xs font-sans-medium"
              style={{
                color: activeTab === 'staff' ? primaryColor : inactiveColor,
              }}
            >
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
        accessibilityLabel="정산"
        accessibilityState={{ selected: activeTab === 'settlement' }}
      >
        <CurrencyWonIcon
          size={20}
          color={activeTab === 'settlement' ? primaryColor : inactiveColor}
        />
        <Text
          className="ml-2 text-base font-sans-medium"
          style={{
            color: activeTab === 'settlement' ? primaryColor : inactiveColor,
          }}
        >
          정산
        </Text>
        {settlementCount > 0 && (
          <View
            className="ml-2 px-2 py-0.5 rounded-sm"
            style={{
              backgroundColor: activeTab === 'settlement' ? activeBadgeBg : inactiveBadgeBg,
            }}
          >
            <Text
              className="text-xs font-sans-medium"
              style={{
                color: activeTab === 'settlement' ? primaryColor : inactiveColor,
              }}
            >
              {settlementCount}
            </Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

import React from 'react';
import { View, Text, Pressable } from 'react-native';

export interface DashboardViewToggleProps {
  value: 'staff' | 'employer';
  onChange: (value: 'staff' | 'employer') => void;
}

export function DashboardViewToggle({ value, onChange }: DashboardViewToggleProps) {
  return (
    <View className="flex-row bg-surface-elevated dark:bg-surface rounded-md mx-4 mb-3 p-1">
      <Pressable
        className={`flex-1 py-2 items-center rounded-sm ${
          value === 'employer' ? 'bg-[#D4AF37]' : 'bg-surface-elevated dark:bg-surface'
        }`}
        onPress={() => onChange('employer')}
        accessibilityRole="tab"
      >
        <Text
          className={`text-sm font-medium ${
            value === 'employer' ? 'text-black' : 'text-secondary-600 dark:text-secondary-300'
          }`}
        >
          내 업무
        </Text>
      </Pressable>

      <Pressable
        className={`flex-1 py-2 items-center rounded-sm ${
          value === 'staff' ? 'bg-[#D4AF37]' : 'bg-surface-elevated dark:bg-surface'
        }`}
        onPress={() => onChange('staff')}
        accessibilityRole="tab"
      >
        <Text
          className={`text-sm font-medium ${
            value === 'staff' ? 'text-black' : 'text-secondary-600 dark:text-secondary-300'
          }`}
        >
          스태프로
        </Text>
      </Pressable>
    </View>
  );
}

/**
 * UNIQN Mobile - 설정 리스트 아이템
 * 설정 계열 화면(설정 메인·알림 설정)에서 공용으로 쓰는 행 컴포넌트
 */

import { View, Text, Pressable } from 'react-native';
import { ChevronRightIcon } from '@/components/icons';
import { SECONDARY_PALETTE } from '@/constants/colors';

interface SettingItemProps {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
}

export function SettingItem({ icon, label, value, onPress, rightElement }: SettingItemProps) {
  const content = (
    <View className="flex-row items-center justify-between py-3">
      <View className="flex-row items-center">
        <View className="mr-3">{icon}</View>
        <Text className="text-base text-content-primary font-sans">{label}</Text>
      </View>
      {rightElement || (
        <View className="flex-row items-center">
          {value && <Text className="mr-2 text-content-muted font-sans">{value}</Text>}
          <ChevronRightIcon size={20} color={SECONDARY_PALETTE[400]} />
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        className="active:opacity-70"
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

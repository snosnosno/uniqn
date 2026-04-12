import React from 'react';
import { View, Text } from 'react-native';
import { HeaderBackButton } from '@/components/navigation';
import { getLayoutColor } from '@/constants';
import { useThemeStore } from '@/stores/themeStore';

interface StackHeaderProps {
  title: string;
  titleSuffix?: React.ReactNode;
  showBack?: boolean;
  fallbackHref?: string;
  rightAction?: React.ReactNode;
}

export function StackHeader({
  title,
  titleSuffix,
  showBack = true,
  fallbackHref = '/(app)/(tabs)',
  rightAction,
}: StackHeaderProps) {
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  const headerBackgroundColor = getLayoutColor(isDarkMode, 'header');
  const headerTintColor = getLayoutColor(isDarkMode, 'headerTint');

  return (
    <View
      className="flex-row items-center justify-between px-2 py-3"
      style={{ backgroundColor: headerBackgroundColor }}
    >
      <View className="flex-1 flex-row items-center">
        {showBack ? (
          <HeaderBackButton
            tintColor={headerTintColor}
            fallbackHref={fallbackHref}
            className="mr-1"
          />
        ) : null}
        <View className="flex-row items-center">
          <Text className="text-lg font-display-semibold" style={{ color: headerTintColor }}>
            {title}
          </Text>
          {titleSuffix ? <View className="ml-1">{titleSuffix}</View> : null}
        </View>
      </View>

      {rightAction ? <View className="mr-2">{rightAction}</View> : null}
    </View>
  );
}

export default StackHeader;

/**
 * UNIQN Mobile - 평가 유도 배너 컴포넌트
 *
 * @description 미작성 평가가 있을 때 표시되는 배너
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';

interface ReviewPromptBannerProps {
  pendingCount: number;
  onPress: () => void;
}

export default React.memo(function ReviewPromptBanner({
  pendingCount,
  onPress,
}: ReviewPromptBannerProps) {
  if (pendingCount <= 0) return null;

  return (
    <Pressable
      onPress={onPress}
      className="mx-4 flex-row items-center justify-between rounded-md bg-primary-50 px-4 py-3 active:opacity-80 dark:bg-primary-900/20"
      accessibilityLabel={`미작성 평가 ${pendingCount}건`}
      accessibilityRole="button"
      accessibilityHint="탭하면 평가 목록으로 이동합니다"
    >
      <View className="flex-1 flex-row items-center gap-2">
        <View>
          <Text className="text-sm font-sans-semibold text-primary-700 dark:text-primary-300">
            작성할 평가가 {pendingCount}건 있어요
          </Text>
          <Text className="text-xs text-primary-600 dark:text-primary-400 font-sans">
            퇴근 후 7일 이내에 평가해주세요
          </Text>
        </View>
      </View>
      <Text className="text-sm text-primary-500 dark:text-primary-400 font-sans">{'>'}</Text>
    </Pressable>
  );
});

/**
 * UNIQN Mobile - 블라인드 안내 컴포넌트
 *
 * @description 상대방 평가가 블라인드 상태이거나 아직 미작성일 때 안내 메시지
 */

import React from 'react';
import { View, Text } from 'react-native';

interface ReviewBlindMessageProps {
  hasMyReview: boolean;
}

export default React.memo(function ReviewBlindMessage({ hasMyReview }: ReviewBlindMessageProps) {
  if (hasMyReview) {
    // 내 리뷰는 작성했지만 상대방이 아직 미작성
    return (
      <View className="items-center rounded-md border border-secondary-200 bg-secondary-50 px-4 py-6 dark:border-secondary-700 dark:bg-secondary-800">
        <Text className="mb-2 text-2xl font-sans">{''}</Text>
        <Text className="text-center text-sm font-sans-medium text-secondary-700 dark:text-secondary-300">
          상대방이 아직 평가를 작성하지 않았습니다
        </Text>
        <Text className="mt-1 text-center text-xs text-secondary-500 dark:text-secondary-400 font-sans">
          상대방이 평가를 완료하면 확인할 수 있습니다
        </Text>
      </View>
    );
  }

  return (
    <View className="items-center rounded-md border border-secondary-200 bg-secondary-50 px-4 py-6 dark:border-secondary-700 dark:bg-secondary-800">
      <Text className="mb-2 text-2xl font-sans">{''}</Text>
      <Text className="text-center text-sm font-sans-medium text-secondary-700 dark:text-secondary-300">
        상대방의 평가는 블라인드 상태입니다
      </Text>
      <Text className="mt-1 text-center text-xs text-secondary-500 dark:text-secondary-400 font-sans">
        평가를 작성하면 상대방의 평가를 확인할 수 있습니다
      </Text>
    </View>
  );
});

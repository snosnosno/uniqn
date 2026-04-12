/**
 * UNIQN Mobile - 비구인자 안내 뷰
 *
 * @description 구인자 권한이 없는 사용자에게 표시되는 안내 화면
 * @version 1.0.0
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { TabHeader } from '@/components/headers';
import { BriefcaseIcon } from '@/components/icons';

export function NonEmployerView() {
  return (
    <SafeAreaView className="flex-1 bg-surface-page" edges={['top']}>
      <TabHeader title="내 공고" />
      <View className="flex-1 items-center justify-center px-6">
        <View className="mb-6 h-24 w-24 items-center justify-center rounded-sm bg-surface-card dark:bg-surface">
          <BriefcaseIcon size={48} color={SECONDARY_PALETTE[400]} />
        </View>
        <Text className="mb-2 text-center text-xl font-display text-content-primary dark:text-off-white">
          구인자 전용 기능입니다
        </Text>
        <Text className="mb-8 text-center text-base text-secondary-500 dark:text-secondary-400 font-sans">
          구인자로 등록하면 공고를 등록하고{'\n'}스태프를 모집할 수 있습니다.
        </Text>
        <Button
          variant="primary"
          onPress={() => router.push('/(app)/employer-register')}
          className="min-w-[200px]"
        >
          <Text className="font-sans-semibold text-surface-dark">구인자로 등록하기</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}

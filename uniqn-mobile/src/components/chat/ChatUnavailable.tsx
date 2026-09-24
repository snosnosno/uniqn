/**
 * 채팅 기능이 꺼져 있을 때(플래그 OFF) 채팅 라우트에 직접 들어오면 보이는 안내
 *
 * 서버가 다크라 방을 열 수 없다 — 딥링크·웹 URL 직접 입력도 여기서 멈춘다.
 */
import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { StackHeader } from '@/components/headers';
import { EmptyState } from '@/components/ui';

export function ChatUnavailable() {
  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top']}>
      <StackHeader title="채팅" />
      <View className="flex-1 items-center justify-center p-4">
        <EmptyState
          title="채팅은 준비 중이에요"
          description="곧 공고마다 사장님과 바로 대화할 수 있어요."
          actionLabel="홈으로"
          onAction={() => router.replace('/(app)/(tabs)/home-jobs')}
        />
      </View>
    </SafeAreaView>
  );
}

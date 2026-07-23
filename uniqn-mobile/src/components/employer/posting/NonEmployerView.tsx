/**
 * UNIQN Mobile - 비구인자 안내 뷰
 *
 * @description 구인자 권한이 없는 사용자에게 표시되는 안내 화면.
 * 구인자 신청 상태(pending/rejected)를 반영해 심사 현황·재신청 경로를 안내한다 (QW6).
 * @version 1.1.0
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React from 'react';
import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { TabHeader } from '@/components/headers';
import { BriefcaseIcon } from '@/components/icons';
import { useEmployerApplication } from '@/hooks/auth/useEmployerApplication';

interface ViewContent {
  title: string;
  message: string;
  ctaLabel: string;
  ctaRoute: '/(app)/employer-register' | '/(app)/employer-application-status';
}

const DEFAULT_CONTENT: ViewContent = {
  title: '구인자 전용 기능입니다',
  message: '구인자로 등록하면 공고를 등록하고\n스태프를 모집할 수 있습니다.',
  ctaLabel: '구인자로 등록하기',
  ctaRoute: '/(app)/employer-register',
};

const CONTENT_BY_STATUS: Partial<Record<'pending' | 'rejected', ViewContent>> = {
  pending: {
    title: '구인자 신청 심사 중입니다',
    message: '관리자 검토 후 알림으로 결과를 알려드려요.\n심사 현황을 확인할 수 있습니다.',
    ctaLabel: '신청 현황 보기',
    ctaRoute: '/(app)/employer-application-status',
  },
  rejected: {
    title: '구인자 신청이 거절되었습니다',
    message: '거절 사유를 확인한 뒤\n다시 신청할 수 있어요.',
    ctaLabel: '거절 사유 확인·재신청',
    ctaRoute: '/(app)/employer-application-status',
  },
};

export function NonEmployerView() {
  const { data: application } = useEmployerApplication();
  const content =
    (application &&
      (application.status === 'pending' || application.status === 'rejected'
        ? CONTENT_BY_STATUS[application.status]
        : undefined)) ||
    DEFAULT_CONTENT;

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top']}>
      <TabHeader title="내 공고" />
      <View className="flex-1 items-center justify-center px-6">
        <View className="mb-6 h-24 w-24 items-center justify-center rounded-sm bg-surface-card dark:bg-surface">
          <BriefcaseIcon size={48} color={SECONDARY_PALETTE[400]} />
        </View>
        <Text className="mb-2 text-center text-xl font-display text-content-primary dark:text-off-white">
          {content.title}
        </Text>
        <Text className="mb-8 text-center text-base text-secondary-500 dark:text-secondary-400 font-sans">
          {content.message}
        </Text>
        <Button
          variant="primary"
          onPress={() => router.push(content.ctaRoute)}
          className="min-w-[200px]"
        >
          <Text className="font-sans-semibold text-content-onGold">{content.ctaLabel}</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}

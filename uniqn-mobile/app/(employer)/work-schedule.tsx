/**
 * UNIQN Mobile — 근무표 화면 (딥링크·알림 도착지)
 *
 * 본문은 `WorkScheduleView` 가 소유한다 — 내 공고 탭 [근무표] 세그먼트와 같은 본문을 쓴다(구인자 IA S3).
 * 이 라우트는 플래그 게이트 + 헤더만 맡는다. 경로(`/(employer)/work-schedule`)는 배치확인 알림
 * 딥링크가 고정하고 있으므로 유지한다.
 */
import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect } from 'expo-router';
import { StackHeader } from '@/components/headers';
import { Loading } from '@/components/ui';
import { WorkScheduleView } from '@/features/employer/workSchedule/WorkScheduleView';
import { useWorkScheduleEnabled } from '@/hooks/useWorkScheduleEnabled';

export default function WorkScheduleScreen() {
  const { enabled, isLoading: flagLoading } = useWorkScheduleEnabled();

  // 플래그 로딩 중 — 전체 화면 로딩.
  if (flagLoading) {
    return <Loading variant="layout" />;
  }

  // 플래그 OFF — 진입 차단(불변식: OFF면 미노출). 본문 훅(그리드 RPC)도 마운트되지 않는다.
  if (!enabled) {
    return <Redirect href="/(employer)/workspace" />;
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top']}>
      <WorkScheduleView
        renderHeader={(amountAction) => (
          <StackHeader
            title="근무표"
            fallbackHref="/(employer)/workspace"
            rightAction={amountAction}
          />
        )}
      />
    </SafeAreaView>
  );
}

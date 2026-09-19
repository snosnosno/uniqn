/**
 * 버전 게이트 전용 화면 — 강제 업데이트 / 점검 모드 (감사 skew-F1).
 *
 * ## 왜 필요한가
 * `useAppInitialize` 는 이미 `requiresUpdate` / `isMaintenanceMode` 를 **계산해서 반환**하는데
 * `app/_layout.tsx` 가 `{isInitialized, isLoading, error, retry}` 만 구조분해해 버렸다.
 * 그래서 서버가 강제 업데이트를 발동해도 사용자에게는 **"앱을 불러올 수 없습니다 + 재시도"**
 * 로만 보였다 — 눌러도 같은 오류로 돌아오는 무한 루프다.
 *
 * 이 앱은 이번 달 #441(클라가 서버보다 먼저 배포돼 전면 파손)을 겪었고, 그 유형의 **유일한
 * 서버측 방어선**이 `force_update_version` 이다. 발동해도 표시할 화면이 없으면 방어선이 아니다.
 *
 * ## 설계 결정
 * - 강제 업데이트에는 **재시도 버튼을 두지 않는다.** 재시도해도 서버 판정은 그대로다 —
 *   버튼을 주면 "눌러도 안 된다"는 경험만 남는다. 나가는 문은 스토어 하나뿐이다.
 * - 점검 모드에는 **재시도를 준다.** 점검은 끝나면 통과되므로 사용자가 다시 눌러볼 이유가 있다.
 * - 🚫 스토어 이동에 `Linking.canOpenURL` 을 쓰지 않는다 — PR#422 가 그 경로를 없앴고
 *   되살리면 iOS `LSApplicationQueriesSchemes` 때문에 version bump 가 유발된다(감사 §6-8).
 *   `useInstallPrompt` 가 쓰는 `resolveInstallStoreUrl()` + `Linking.openURL` 을 그대로 따른다.
 */
import { useCallback } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { resolveInstallStoreUrl } from '@/constants';
import { logger } from '@/utils/logger';
import { useToast } from '@/stores/toastStore';

interface VersionGateScreenProps {
  /** 'update' = 강제 업데이트(재시도 없음) · 'maintenance' = 점검(재시도 있음) */
  kind: 'update' | 'maintenance';
  /** 점검 모드에서 서버가 내려준 안내 문구 */
  message?: string;
  /** 점검 모드에서만 전달한다 */
  onRetry?: () => void;
}

const COPY = {
  update: {
    title: '업데이트가 필요합니다',
    body: '이 버전은 더 이상 사용할 수 없습니다.\n스토어에서 최신 버전으로 업데이트해주세요.',
  },
  maintenance: {
    title: '서비스 점검 중입니다',
    body: '점검이 끝나면 자동으로 이용할 수 있습니다.\n잠시 후 다시 시도해주세요.',
  },
} as const;

export function VersionGateScreen({ kind, message, onRetry }: VersionGateScreenProps) {
  const toast = useToast();
  const copy = COPY[kind];

  const openStore = useCallback(async () => {
    const storeUrl = resolveInstallStoreUrl();
    try {
      await Linking.openURL(storeUrl);
      logger.info('버전 게이트에서 스토어 이동', {
        component: 'VersionGateScreen',
        data: { storeUrl },
      });
    } catch (error) {
      logger.error('버전 게이트 스토어 이동 실패', error as Error, {
        component: 'VersionGateScreen',
        data: { storeUrl },
      });
      toast.error('스토어를 열 수 없어요. 잠시 후 다시 시도해주세요.');
    }
  }, [toast]);

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-surface-dark">
      <ScrollView
        contentContainerClassName="grow items-center justify-center gap-6 px-8 py-10"
        keyboardShouldPersistTaps="handled"
      >
        <View className="items-center gap-3">
          <Text
            className="text-center text-2xl font-sans-bold text-content-primary dark:text-off-white"
            accessibilityRole="header"
          >
            {copy.title}
          </Text>
          <Text className="text-center text-base leading-6 text-secondary-600 dark:text-secondary-300">
            {/* 점검 문구는 서버가 내려준 것을 우선한다(운영이 상황을 직접 설명할 수 있어야 한다) */}
            {message && message.trim() !== '' ? message : copy.body}
          </Text>
        </View>

        {kind === 'update' ? (
          <Pressable
            onPress={openStore}
            accessibilityRole="button"
            accessibilityLabel="스토어에서 업데이트"
            className="w-full max-w-[320px] items-center rounded-xl bg-primary-500 px-6 py-4 active:opacity-80"
          >
            <Text className="text-base font-sans-bold text-white">스토어에서 업데이트</Text>
          </Pressable>
        ) : null}

        {kind === 'maintenance' && onRetry ? (
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel="다시 시도"
            className="w-full max-w-[320px] items-center rounded-xl border border-secondary-300 px-6 py-4 active:opacity-80 dark:border-secondary-600"
          >
            <Text className="text-base font-sans-semibold text-content-primary dark:text-off-white">
              다시 시도
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

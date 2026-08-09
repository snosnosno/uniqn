/**
 * 소프트 업데이트 안내 배너 (감사 skew-F1 세 번째 계층).
 *
 * 강제 업데이트가 "못 쓰게 막는 것"이라면 이건 "있으면 좋다고 알리는 것"이다.
 * `useAppInitialize` 가 성공 경로에서 `requiresUpdate = versionCheckResult.shouldUpdate` 를
 * 채워 반환하는데 아무도 읽지 않아 소프트 업데이트 안내가 한 번도 나간 적이 없었다.
 *
 * ## 설계 결정
 * - **차단하지 않는다.** OfflineStatusBar 와 같은 전역 상단 스트립으로 띄운다.
 * - 닫으면 **이 세션 동안만** 숨긴다. MMKV 로 며칠씩 억제하는 로직(useVersionCheck 의
 *   DISMISS_KEY)은 일부러 쓰지 않았다 — 그건 모달 전용 정책이고, 배너는 부담이 작아
 *   세션 단위 억제로 충분하다. 정책을 늘리려면 저장 키와 만료를 함께 설계해야 한다.
 */
import { useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { resolveInstallStoreUrl } from '@/constants';
import { logger } from '@/utils/logger';

interface UpdateBannerProps {
  visible: boolean;
  /** 서버가 알려준 최신 버전(있으면 문구에 싣는다) */
  latestVersion?: string;
}

export function UpdateBanner({ visible, latestVersion }: UpdateBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (!visible || dismissed) return null;

  const openStore = () => {
    const storeUrl = resolveInstallStoreUrl();
    Linking.openURL(storeUrl).catch((error) => {
      logger.error('업데이트 배너 스토어 이동 실패', error as Error, {
        component: 'UpdateBanner',
        data: { storeUrl },
      });
    });
  };

  return (
    <View className="flex-row items-center gap-3 bg-primary-500 px-4 py-2">
      <Text className="flex-1 text-sm font-sans-medium text-white" numberOfLines={2}>
        {latestVersion ? `새 버전 ${latestVersion} 이 있습니다.` : '새 버전이 나왔습니다.'}
      </Text>
      <Pressable
        onPress={openStore}
        accessibilityRole="button"
        accessibilityLabel="업데이트하러 가기"
        className="rounded-md bg-white/20 px-3 py-1 active:opacity-70"
      >
        <Text className="text-xs font-sans-bold text-white">업데이트</Text>
      </Pressable>
      <Pressable
        onPress={() => setDismissed(true)}
        accessibilityRole="button"
        accessibilityLabel="업데이트 안내 닫기"
        className="px-2 py-1 active:opacity-70"
      >
        <Text className="text-xs font-sans-bold text-white">✕</Text>
      </Pressable>
    </View>
  );
}

/**
 * UNIQN Mobile — ops 허브 1회성 신기능 안내 카드 (A1 진입 표면 ②)
 *
 * @description ops 라이브 대회 운영 허브가 열렸음을 알리는 dismiss 가능한 1회성 카드.
 * - 노출 조건: `useOpsHubEnabled().enabled === true` && 아직 dismiss 안 함.
 * - dismiss 상태는 MMKV(`@uniqn:ops_hub_intro_dismissed`)에 영속 → 앱 재시작에도 재노출 없음.
 * - CTA/닫기 어느 쪽이든 dismiss 를 영속(안내는 1회성이므로 행동 후 재노출 금지).
 * - 골드 톤 CTA 1곳(안내 카드 한정, 60-30-10) — Button variant="primary".
 */

import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { MegaphoneIcon, XMarkIcon } from '@/components/icons';
import { SECONDARY_PALETTE } from '@/constants/colors';
import { getMMKVInstance } from '@/lib/mmkvStorage';
import { useOpsHubEnabled } from '@/hooks/useOpsHubEnabled';
import { logger } from '@/utils/logger';

/** 1회성 안내 dismiss 영속 키(계획 확정값 — 변경 금지). */
const OPS_HUB_INTRO_DISMISSED_KEY = '@uniqn:ops_hub_intro_dismissed';

/** MMKV 에서 dismiss 여부 조회(동기, 실패 시 미dismiss 취급). */
function readIntroDismissed(): boolean {
  try {
    return Boolean(getMMKVInstance().getString(OPS_HUB_INTRO_DISMISSED_KEY));
  } catch {
    return false;
  }
}

/** dismiss 상태를 MMKV 에 영속(실패는 로깅만, 앱 동작 무영향). */
function persistIntroDismissed(): void {
  try {
    getMMKVInstance().set(OPS_HUB_INTRO_DISMISSED_KEY, Date.now().toString());
  } catch (err) {
    logger.error('ops 허브 안내 카드 dismiss 저장 실패', err as Error);
  }
}

/**
 * ops 허브 1회성 신기능 안내 카드.
 * 게이트 OFF/이미 dismiss 면 null 을 반환(공간 예약 없음 — pop-in 금지는 로딩 미노출로 충족).
 */
export function OpsHubIntroCard() {
  const { enabled } = useOpsHubEnabled();
  const [dismissed, setDismissed] = useState(readIntroDismissed);

  if (!enabled || dismissed) {
    return null;
  }

  const dismiss = () => {
    persistIntroDismissed();
    setDismissed(true);
  };

  const handleOpen = () => {
    dismiss();
    router.push('/(ops)/tournaments');
  };

  return (
    <Card className="mb-4">
      <View className="flex-row items-start justify-between">
        <View className="mr-3 flex-1 flex-row items-start">
          <View className="mr-3 mt-0.5">
            <MegaphoneIcon size={22} color={SECONDARY_PALETTE[500]} />
          </View>
          <View className="flex-1">
            <Text className="text-base font-display-semibold text-content-primary dark:text-secondary-100">
              라이브 대회 운영이 열렸어요
            </Text>
            <Text className="mt-1 text-sm text-content-secondary dark:text-secondary-400 font-sans">
              블라인드·좌석·정산을 한 화면에서 관리해요. 지금 바로 대회를 만들어 보세요.
            </Text>
          </View>
        </View>
        <Pressable
          onPress={dismiss}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="안내 닫기"
          className="p-1 active:opacity-70"
        >
          <XMarkIcon size={20} color={SECONDARY_PALETTE[400]} />
        </Pressable>
      </View>

      <View className="mt-3">
        <Button variant="primary" onPress={handleOpen}>
          라이브 운영 열기
        </Button>
      </View>
    </Card>
  );
}

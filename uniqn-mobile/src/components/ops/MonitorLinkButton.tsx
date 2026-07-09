/**
 * ops 1c-3 — 운영자용 모니터(전광판) 링크 발급/공유.
 * 멱등 발급(useRotateMonitorToken) → 배포 origin 동적(getOpsMonitorUrl) URL 생성 →
 * 웹=클립보드 복사 / 네이티브=Share. (QR 출력은 후속 — 링크/공유로 충분.)
 */
import { View, Text, Pressable, Platform, Share } from 'react-native';
import { useRotateMonitorToken } from '@/hooks/ops';
import { getOpsMonitorUrl } from '@/constants/ops';
import { useToastStore } from '@/stores/toastStore';

interface MonitorLinkButtonProps {
  tournamentId: string;
  /** 대회 캐시의 기존 토큰. 있으면 즉시 사용, 없으면 발급. */
  monitorToken?: string | null;
}

export function MonitorLinkButton({ tournamentId, monitorToken }: MonitorLinkButtonProps) {
  const rotateMut = useRotateMonitorToken(tournamentId);

  const deliver = async (token: string) => {
    const url = getOpsMonitorUrl(token);
    if (Platform.OS === 'web') {
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(url);
          useToastStore.getState().success('모니터 링크를 복사했습니다');
        } else {
          useToastStore.getState().success(url);
        }
      } catch {
        useToastStore.getState().error('링크 복사에 실패했습니다');
      }
    } else {
      try {
        await Share.share({ message: url });
      } catch {
        // 사용자 취소 등 — 무시
      }
    }
  };

  const onPress = () => {
    if (rotateMut.isPending) return;
    if (monitorToken) {
      void deliver(monitorToken);
      return;
    }
    rotateMut.mutate(false, {
      onSuccess: (token) => {
        if (token) void deliver(token);
      },
    });
  };

  return (
    <View className="mx-1 mt-2 flex-row items-center justify-between rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <View className="flex-1 pr-3">
        <Text className="text-content-primary dark:text-off-white">모니터(전광판)</Text>
        <Text className="text-xs text-secondary-500 dark:text-secondary-400">
          공개 링크로 큰 화면에 클럭·블라인드·통계를 띄웁니다.
        </Text>
      </View>
      <Pressable
        onPress={onPress}
        disabled={rotateMut.isPending}
        accessibilityRole="button"
        accessibilityLabel="모니터 링크"
        className={`min-h-[44px] items-center justify-center rounded-md px-3 ${
          rotateMut.isPending ? 'bg-primary-600 opacity-40' : 'bg-primary-600 active:opacity-70'
        }`}
      >
        <Text className="font-sans-semibold text-sm text-white">
          {Platform.OS === 'web' ? '링크 복사' : '링크 공유'}
        </Text>
      </Pressable>
    </View>
  );
}

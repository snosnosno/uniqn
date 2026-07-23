/** 상시 한 줄 요약(L1). ops_live_stats 구독. 탭 → 현황 탭 점프. */
import { Pressable, Text } from 'react-native';
import { useOpsLiveStats } from '@/hooks/ops';

interface OpsSummaryStripProps {
  tournamentId: string;
  onPress?: () => void;
}

export function OpsSummaryStrip({ tournamentId, onPress }: OpsSummaryStripProps) {
  const { stats } = useOpsLiveStats(tournamentId);
  const playing = stats?.playing ?? 0;
  const entries = stats?.entries ?? 0;
  const avgStackBb = stats?.avgStackBb ?? 0;
  // 숫자는 밝게 강조(내부 Text), 라벨·구분점은 dim(외곽 Text)으로 위계를 준다.
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`대회 현황 요약: ${playing}명 플레이 중, ${entries} 엔트리, 평균 ${avgStackBb}BB`}
      className="items-center justify-center border-b border-gray-200 px-3 py-2 active:bg-gray-50 dark:border-gray-700 dark:active:bg-gray-800"
    >
      <Text className="text-xs text-secondary-500 dark:text-secondary-400">
        <Text className="font-sans-semibold text-content-primary dark:text-off-white">
          {playing}
        </Text>
        {' PLAYING · '}
        <Text className="font-sans-semibold text-content-primary dark:text-off-white">
          {entries}
        </Text>
        {' ENTRY · AVG '}
        <Text className="font-sans-semibold text-content-primary dark:text-off-white">
          {avgStackBb}
        </Text>
        {' BB'}
      </Text>
    </Pressable>
  );
}

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
  // 단일 Text 노드로 렌더(중첩 Text 분리 시 "9"·"19" 가 getByText(/9/) 에 동시 매칭돼 계약 위반).
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="대회 현황 요약"
      className="flex-row items-center justify-center gap-2 border-b border-gray-200 px-3 py-2 active:bg-gray-50 dark:border-gray-700 dark:active:bg-gray-800"
    >
      <Text className="font-sans-semibold text-xs text-content-primary dark:text-off-white">
        {`${playing} PLAYING · ${entries} ENTRY · AVG ${avgStackBb} BB`}
      </Text>
    </Pressable>
  );
}

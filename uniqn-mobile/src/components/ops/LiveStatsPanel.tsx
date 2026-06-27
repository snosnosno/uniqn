/**
 * ops 1c — STATUS 하단 라이브 통계판.
 * useOpsLiveStats(서버 트리거 재계산 단일소스) 를 카드 그리드로 표시한다.
 * 클라 파생 계산 없음(§0.5 이중 진실원 제거) — liveStats null 이면 0 표시.
 */
import { View, Text } from 'react-native';
import { useOpsLiveStats } from '@/hooks/ops';

const fmt = (n: number) => n.toLocaleString('ko-KR');

/** avg_stack_bb 는 numeric → 10 이상은 정수, 미만은 소수 1자리. */
function formatBb(bb: number): string {
  return bb.toLocaleString('ko-KR', { maximumFractionDigits: 1 });
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View className="m-1 flex-1 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
      <Text className="text-xs text-secondary-500 dark:text-secondary-400">{label}</Text>
      <Text className="mt-1 font-sans-semibold text-lg text-content-primary dark:text-off-white">
        {value}
      </Text>
      {sub ? (
        <Text className="text-xs text-secondary-500 dark:text-secondary-400">{sub}</Text>
      ) : null}
    </View>
  );
}

interface LiveStatsPanelProps {
  tournamentId: string;
}

export function LiveStatsPanel({ tournamentId }: LiveStatsPanelProps) {
  const { stats } = useOpsLiveStats(tournamentId);

  // 9개 카드 = 3행 × 3열. 서버값 우선, 없으면 0.
  const rows: { label: string; value: string; sub?: string }[][] = [
    [
      { label: 'PLAYING', value: fmt(stats?.playing ?? 0) },
      { label: 'ENTRIES', value: fmt(stats?.entries ?? 0) },
      { label: 'RE-ENTRY', value: fmt(stats?.reentriesTotal ?? 0) },
    ],
    [
      { label: 'TABLES', value: fmt(stats?.tablesOpen ?? 0) },
      { label: 'SEATS', value: fmt(stats?.seatsTotal ?? 0) },
      { label: 'FREE', value: fmt(stats?.seatsFree ?? 0) },
    ],
    [
      {
        label: 'AVG',
        value: fmt(stats?.averageStack ?? 0),
        sub: `${formatBb(stats?.avgStackBb ?? 0)} BB`,
      },
      { label: 'CHIPS', value: fmt(stats?.totalChips ?? 0) },
      { label: 'POOL', value: fmt(stats?.prizePool ?? 0) },
    ],
  ];

  return (
    <View>
      {rows.map((row, i) => (
        <View key={i} className="flex-row">
          {row.map((card) => (
            <StatCard key={card.label} label={card.label} value={card.value} sub={card.sub} />
          ))}
        </View>
      ))}
    </View>
  );
}

export default LiveStatsPanel;

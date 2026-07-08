/**
 * ops 1f — 종료(completed) 결과 뷰 (스펙 §7.3, Alert 증발 해소).
 * useOpsParticipants + useOpsLiveStats 서버 단일소스 — 클라 파생 계산 없음.
 * 🔨H14: winner = fp===1 만. ranked[0] 은 수동 active→completed(딜/chop 종료, 합법 전이)에서
 * fp=1 이 없을 때 최저 fp "탈락자"를 우승자로 오표기하므로 금지.
 */
import { View, Text } from 'react-native';
import { useOpsParticipants, useOpsLiveStats } from '@/hooks/ops';
import type { OpsTournament } from '@/types/ops';

import { formatNumber as fmt } from '@/utils/formatters/currency';

/** 상금 표시: 값 있으면 "n원", 없으면 대체 문자열. */
function prizeText(amount: number | null | undefined, fallback: string): string {
  return amount !== null && amount !== undefined ? `${fmt(amount)}원` : fallback;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between py-1">
      <Text className="text-sm text-secondary-500 dark:text-secondary-400">{label}</Text>
      <Text className="font-sans-semibold text-sm text-content-primary dark:text-off-white">
        {value}
      </Text>
    </View>
  );
}

export function TournamentResultCard({ tournament }: { tournament: OpsTournament }) {
  const { participants } = useOpsParticipants(tournament.id);
  const { stats } = useOpsLiveStats(tournament.id);

  const ranked = [...participants]
    .filter((p) => p.finishPosition !== null && p.finishPosition !== undefined)
    .sort((a, b) => (a.finishPosition ?? 0) - (b.finishPosition ?? 0));
  // 🔨H14: 우승자는 fp===1 만 — 수동 종료(딜/chop)로 fp=1 부재 시 빈 상태로 처리.
  const winner = ranked.find((p) => p.finishPosition === 1) ?? null;
  const totalPaid = ranked.reduce((acc, p) => acc + (p.prizeAmount ?? 0), 0);

  return (
    <View className="mx-1 gap-3">
      {/* 우승 카드 */}
      <View className="items-center gap-1 rounded-xl border border-amber-500 bg-white p-4 dark:border-amber-400 dark:bg-gray-900">
        <Text className="text-xs font-sans-semibold text-amber-600 dark:text-amber-400">
          🏆 우승
        </Text>
        {winner ? (
          <>
            <Text className="text-xl font-sans-bold text-content-primary dark:text-off-white">
              {winner.name}
            </Text>
            <Text className="text-sm text-amber-600 dark:text-amber-400">
              {prizeText(winner.prizeAmount, '상금 미정')}
            </Text>
          </>
        ) : (
          <Text className="text-sm text-secondary-500 dark:text-secondary-400">
            우승자 미확정(수동 종료)
          </Text>
        )}
      </View>

      {/* 최종 순위표 (fp asc) */}
      <View className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <Text className="mb-2 font-sans-semibold text-sm text-content-primary dark:text-off-white">
          최종 순위
        </Text>
        {ranked.length === 0 ? (
          <Text className="text-sm text-secondary-500 dark:text-secondary-400">
            아직 확정된 순위가 없습니다.
          </Text>
        ) : (
          ranked.map((p) => (
            <View key={p.id} className="flex-row items-center justify-between py-1">
              <Text className="text-sm text-content-primary dark:text-off-white" numberOfLines={1}>
                {p.finishPosition}위 · {p.name}
              </Text>
              <Text className="text-sm text-secondary-500 dark:text-secondary-400">
                {prizeText(p.prizeAmount, '—')}
              </Text>
            </View>
          ))
        )}
      </View>

      {/* 정산 요약 */}
      <View className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <Text className="mb-1 font-sans-semibold text-sm text-content-primary dark:text-off-white">
          정산 요약
        </Text>
        <SummaryRow label="총 프라이즈 풀" value={`${fmt(stats?.prizePool ?? 0)}원`} />
        <SummaryRow label="지급 합계" value={`${fmt(totalPaid)}원`} />
        {stats && stats.knockoutPool !== null ? (
          <SummaryRow label="KO 풀" value={`${fmt(stats.knockoutPool)}원`} />
        ) : null}
        <SummaryRow label="엔트리" value={fmt(stats?.entries ?? 0)} />
        <SummaryRow label="재진입" value={fmt(stats?.reentriesTotal ?? 0)} />
      </View>
    </View>
  );
}

export default TournamentResultCard;

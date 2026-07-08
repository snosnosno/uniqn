/**
 * 공개 모니터(전광판) — ops 1c-3.
 * capability-URL: monitor_token 만으로 접근(anon). useMonitorSnapshot 이 4s 폴링 + 서버시각 offset 보정.
 * 비-PII 스냅샷만 표시(참가자 PII·토큰 미노출). 항상 다크 보드(TV/대형 디스플레이용).
 * 상태범위(§0.5 B9): 시작전/진행/일시정지/브레이크/레벨전환.
 * 1f: 바운티 대회면 KO POOL 스트립 카드 조건부 노출(우승자·상금 상세는 운영자 뷰 전용).
 */
import { View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { NumericText } from '@/components/ui';
import { useMonitorSnapshot } from '@/hooks/ops/useMonitorSnapshot';

import { formatNumber as fmt } from '@/utils/formatters/currency';

function formatMmSs(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View className="min-w-[88px] flex-1 items-center gap-1 rounded-lg bg-gray-800 px-3 py-3">
      <Text className="text-xs font-sans-medium text-secondary-400">{label}</Text>
      <NumericText className="text-xl font-sans-bold text-off-white">{value}</NumericText>
    </View>
  );
}

export default function MonitorScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { snapshot, remainingSec, levelMissing, isLoading, isError } = useMonitorSnapshot(token);

  // 무효 토큰 / 조회 실패
  if (isError || (!token && !isLoading)) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-gray-900 px-8">
        <Text className="text-center text-xl font-sans-bold text-off-white">
          유효하지 않은 모니터 링크입니다
        </Text>
        <Text className="text-center text-sm text-secondary-400">
          운영자에게 새 링크를 요청하거나 QR을 다시 스캔해주세요.
        </Text>
      </View>
    );
  }

  if (isLoading || !snapshot) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-900">
        <Text className="text-base text-secondary-400">불러오는 중…</Text>
      </View>
    );
  }

  const { tournament, clock, currentLevel, nextLevel, stats } = snapshot;
  const isRunning = clock.isRunning;
  const isPaused = !isRunning && clock.pausedRemainingSec !== null;
  const statusLabel = currentLevel?.isBreak
    ? '휴식'
    : isRunning
      ? '진행 중'
      : isPaused
        ? '일시정지'
        : levelMissing
          ? '레벨 정보 없음'
          : '시작 전';
  const timerTone = isPaused ? 'text-error-400' : 'text-off-white';

  return (
    <View className="flex-1 gap-6 bg-gray-900 px-8 py-6">
      {/* 헤더 — 대회명 / 장소 */}
      <View className="flex-row items-end justify-between">
        <View className="flex-1">
          <Text className="text-2xl font-sans-bold text-off-white" numberOfLines={1}>
            {tournament.name}
          </Text>
          {tournament.venue ? (
            <Text className="text-sm text-secondary-400" numberOfLines={1}>
              {tournament.venue}
            </Text>
          ) : null}
        </View>
        <Text className="text-sm font-sans-medium text-secondary-400">
          {tournament.registrationOpen ? '등록 진행 중' : '등록 마감'}
        </Text>
      </View>

      {/* 히어로 — 레벨 / 대형 타이머 / 블라인드 */}
      <View className="flex-1 items-center justify-center gap-3">
        <Text className="text-base font-sans-semibold text-secondary-400">
          {currentLevel?.isBreak ? '휴식' : `LEVEL ${currentLevel?.level ?? '-'}`} · {statusLabel}
        </Text>
        <NumericText
          className={`text-[120px] font-sans-bold leading-none ${timerTone}`}
          accessibilityLabel={`남은 시간 ${formatMmSs(remainingSec)}`}
        >
          {formatMmSs(remainingSec)}
        </NumericText>
        {currentLevel?.isBreak ? (
          <Text className="text-3xl font-sans-bold text-primary-400">휴식 시간</Text>
        ) : currentLevel ? (
          <Text className="text-3xl font-sans-bold text-primary-400">
            {fmt(currentLevel.smallBlind)} / {fmt(currentLevel.bigBlind)}
            {currentLevel.ante > 0 ? ` · 앤티 ${fmt(currentLevel.ante)}` : ''}
          </Text>
        ) : (
          <Text className="text-base text-secondary-400">블라인드 정보를 불러오는 중…</Text>
        )}
        <Text className="text-sm text-secondary-400">
          {nextLevel
            ? nextLevel.isBreak
              ? '다음 · 휴식'
              : `다음 · ${fmt(nextLevel.smallBlind)} / ${fmt(nextLevel.bigBlind)}`
            : '다음 레벨 없음 (마지막)'}
        </Text>
      </View>

      {/* 통계 스트립 (바운티 대회면 KO POOL 조건부 추가 — 1f) */}
      <View className="flex-row gap-2">
        <StatCard label="PLAYING" value={fmt(stats.playing)} />
        <StatCard label="ENTRIES" value={fmt(stats.entries)} />
        <StatCard label="AVG (BB)" value={stats.avgStackBb.toFixed(1)} />
        <StatCard label="AVG CHIPS" value={fmt(stats.averageStack)} />
        <StatCard label="PRIZE POOL" value={fmt(stats.prizePool)} />
        {stats.knockoutPool !== null && (
          <StatCard label="KO POOL" value={fmt(stats.knockoutPool)} />
        )}
      </View>
    </View>
  );
}

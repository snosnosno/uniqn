/**
 * 공개 모니터(전광판) — ops 1c-3 → S1 C6 프리셋 개편.
 * capability-URL: monitor_token 만으로 접근(anon). useMonitorSnapshot 이 4s 폴링 + 서버시각 offset 보정.
 * 비-PII 스냅샷만 표시(참가자 PII·토큰 미노출). 항상 다크 보드(TV/대형 디스플레이용).
 *
 * S1 C6(스펙 결정 T1~T6):
 * - 프리셋 3종: full(슬롯 좌·프라이즈 우, 기본) / mirror(좌우 반전) / classic(중앙+하단 스트립)
 * - 5슬롯 모듈: registry 순회 렌더 — 데이터 없으면 자동 숨김, 미지 id 무시, 중복 첫 항목만
 * - 프라이즈 패널: PRIZE POOL(골드) + payouts 상위 5 + KO 풀(조건부). 등록 배지는 regStatus 슬롯으로 일원화(T4)
 * - 반응형: 좁은 화면(폰 세로)은 프리셋 무관 세로 스택(타이머 → 슬롯 2열 → 프라이즈)
 * - 골드는 상금 금액·PRIZE POOL 만(60-30-10)
 * S1 C1: 다음 브레이크 카운트다운(nextBreak 슬롯) — 클럭과 동일 앵커(드리프트 0)
 * S1 B2: 최하단 캡션급 신고 링크(익명 폼)
 */
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { trackOpsFunnel } from '@/services/observability/analyticsService';
import { NumericText } from '@/components/ui';
import { useMonitorSnapshot } from '@/hooks/ops/useMonitorSnapshot';
import { parseMonitorConfig } from '@/domains/ops';
import {
  resolveMonitorSlots,
  type MonitorModuleContext,
  type ResolvedSlot,
} from '@/components/ops/monitor/registry';
import { PublicReportSheet, ReportFooterLink } from '@/components/ops/monitor/PublicReportSheet';
import type { OpsMonitorSnapshot, OpsPayoutEntry } from '@/types/ops';
import type { NextBreakDisplay } from '@/domains/ops';

import { formatNumber as fmt } from '@/utils/formatters/currency';

function formatMmSs(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** 슬롯 카드 — column(사이드 컬럼) / strip(classic 하단·세로 그리드) 두 밀도. */
function SlotCard({ slot, variant }: { slot: ResolvedSlot; variant: 'column' | 'strip' }) {
  const valueTone = slot.tone === 'gold' ? 'text-primary-400' : 'text-off-white';
  if (variant === 'column') {
    return (
      <View className="gap-1 rounded-lg bg-gray-800 px-4 py-3">
        <Text className="text-xs font-sans-medium text-secondary-400">{slot.label}</Text>
        <NumericText className={`text-2xl font-sans-bold ${valueTone}`}>{slot.value}</NumericText>
      </View>
    );
  }
  return (
    <View className="min-w-[88px] flex-1 items-center gap-1 rounded-lg bg-gray-800 px-3 py-3">
      <Text className="text-xs font-sans-medium text-secondary-400">{slot.label}</Text>
      <NumericText className={`text-xl font-sans-bold ${valueTone}`}>{slot.value}</NumericText>
    </View>
  );
}

/** 프라이즈 패널(T4) — PRIZE POOL(골드) + 상위 5 payout + KO 풀(조건부). 데이터 없으면 미렌더. */
function PrizePanel({ snapshot }: { snapshot: OpsMonitorSnapshot }) {
  const payouts: OpsPayoutEntry[] = snapshot.payouts ?? [];
  const { prizePool, knockoutPool } = snapshot.stats;
  return (
    <View className="gap-3 rounded-xl bg-gray-800 px-5 py-4">
      <View className="gap-1">
        <Text className="text-sm font-sans-semibold text-secondary-400">PRIZE POOL</Text>
        <NumericText className="text-4xl font-sans-bold text-primary-400">
          {fmt(prizePool)}
        </NumericText>
      </View>
      {payouts.length > 0 ? (
        <View className="gap-2">
          {payouts.map((p) => (
            <View key={p.position} className="flex-row items-center justify-between">
              <Text className="text-base font-sans-medium text-secondary-300">{p.position}위</Text>
              <NumericText className="text-lg font-sans-bold text-primary-400">
                {fmt(p.amount)}
              </NumericText>
            </View>
          ))}
        </View>
      ) : null}
      {knockoutPool !== null ? (
        <View className="flex-row items-center justify-between border-t border-gray-700 pt-2">
          <Text className="text-sm font-sans-medium text-secondary-400">KO POOL</Text>
          <NumericText className="text-lg font-sans-bold text-primary-400">
            {fmt(knockoutPool)}
          </NumericText>
        </View>
      ) : null}
    </View>
  );
}

/** 중앙 히어로 — 레벨/대형 타이머/블라인드/다음 레벨(상시). 타이머가 항상 최대 위계. */
function Hero({
  snapshot,
  remainingSec,
  levelMissing,
  compact,
}: {
  snapshot: OpsMonitorSnapshot;
  remainingSec: number;
  levelMissing: boolean;
  compact: boolean;
}) {
  const { clock, currentLevel, nextLevel } = snapshot;
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
  const timerSize = compact ? 'text-[72px]' : 'text-[120px]';

  return (
    <View className="items-center justify-center gap-3">
      <Text className="text-base font-sans-semibold text-secondary-400">
        {currentLevel?.isBreak ? '휴식' : `LEVEL ${currentLevel?.level ?? '-'}`} · {statusLabel}
      </Text>
      <NumericText
        className={`${timerSize} font-sans-bold leading-none ${timerTone}`}
        accessibilityLabel={`남은 시간 ${formatMmSs(remainingSec)}`}
      >
        {formatMmSs(remainingSec)}
      </NumericText>
      {currentLevel?.isBreak ? (
        <Text className="text-3xl font-sans-bold text-off-white">휴식 시간</Text>
      ) : currentLevel ? (
        <Text className="text-3xl font-sans-bold text-off-white">
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
  );
}

export default function MonitorScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { snapshot, remainingSec, levelMissing, nextBreak, isLoading, isError } =
    useMonitorSnapshot(token);
  const { width, height } = useWindowDimensions();
  const [reportOpen, setReportOpen] = useState(false);

  const config = useMemo(
    () => parseMonitorConfig(snapshot?.monitorConfig),
    [snapshot?.monitorConfig]
  );

  // D1 퍼널: 공개뷰 열람(토큰 8자 prefix 만 — capability 원문 전송 금지)
  useEffect(() => {
    if (token && token.length >= 32) {
      trackOpsFunnel('ops_public_view_opened', { tk: token.slice(0, 8), kind: 'monitor' });
    }
  }, [token]);

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

  const ctx: MonitorModuleContext = { snapshot, nextBreak: nextBreak as NextBreakDisplay };
  const slots = resolveMonitorSlots(config.slots, ctx);
  const payouts = snapshot.payouts ?? [];
  const showPrizePanel =
    payouts.length > 0 || snapshot.stats.prizePool > 0 || snapshot.stats.knockoutPool !== null;
  // 좁은 화면(폰 세로)은 프리셋 무관 자동 세로 스택 — 프리셋은 가로(TV) 배치만 결정
  const isVertical = width < height || width < 700;

  const header = (
    <View className="flex-row items-end justify-between">
      <View className="flex-1">
        <Text className="text-2xl font-sans-bold text-off-white" numberOfLines={1}>
          {snapshot.tournament.name}
        </Text>
        {snapshot.tournament.venue ? (
          <Text className="text-sm text-secondary-400" numberOfLines={1}>
            {snapshot.tournament.venue}
          </Text>
        ) : null}
      </View>
    </View>
  );

  const reportFooter = (
    <>
      <ReportFooterLink onPress={() => setReportOpen(true)} />
      <PublicReportSheet
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        tokenKind="monitor"
        token={token ?? ''}
      />
    </>
  );

  if (isVertical) {
    // 세로 스택: 타이머 → 슬롯 2열 그리드 → 프라이즈
    return (
      <ScrollView className="flex-1 bg-gray-900" contentContainerClassName="gap-6 px-5 py-6">
        {header}
        <Hero snapshot={snapshot} remainingSec={remainingSec} levelMissing={levelMissing} compact />
        {slots.length > 0 ? (
          <View className="flex-row flex-wrap gap-2">
            {slots.map((slot) => (
              <View key={slot.id} className="w-[48%] grow">
                <SlotCard slot={slot} variant="strip" />
              </View>
            ))}
          </View>
        ) : null}
        {showPrizePanel ? <PrizePanel snapshot={snapshot} /> : null}
        {reportFooter}
      </ScrollView>
    );
  }

  if (config.preset === 'classic') {
    // classic — 현행 유지 배치: 중앙 히어로 + 하단 슬롯 스트립
    return (
      <View className="flex-1 gap-6 bg-gray-900 px-8 py-6">
        {header}
        <View className="flex-1 justify-center">
          <Hero
            snapshot={snapshot}
            remainingSec={remainingSec}
            levelMissing={levelMissing}
            compact={false}
          />
        </View>
        {slots.length > 0 ? (
          <View className="flex-row gap-2">
            {slots.map((slot) => (
              <SlotCard key={slot.id} slot={slot} variant="strip" />
            ))}
          </View>
        ) : null}
        {reportFooter}
      </View>
    );
  }

  // full(기본) / mirror — 좌우 3컬럼: 슬롯 컬럼 · 중앙 히어로 · 프라이즈 패널
  const rowDirection = config.preset === 'mirror' ? 'flex-row-reverse' : 'flex-row';
  return (
    <View className="flex-1 gap-4 bg-gray-900 px-8 py-6">
      {header}
      <View className={`flex-1 ${rowDirection} items-stretch gap-6`}>
        {slots.length > 0 ? (
          <View className="w-[22%] max-w-[280px] justify-center gap-2">
            {slots.map((slot) => (
              <SlotCard key={slot.id} slot={slot} variant="column" />
            ))}
          </View>
        ) : null}
        <View className="flex-1 justify-center">
          <Hero
            snapshot={snapshot}
            remainingSec={remainingSec}
            levelMissing={levelMissing}
            compact={false}
          />
        </View>
        {showPrizePanel ? (
          <View className="w-[24%] max-w-[320px] justify-center">
            <PrizePanel snapshot={snapshot} />
          </View>
        ) : null}
      </View>
      {reportFooter}
    </View>
  );
}

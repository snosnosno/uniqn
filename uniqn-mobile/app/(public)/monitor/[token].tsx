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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { trackOpsFunnel } from '@/services/observability/analyticsService';
import { NumericText } from '@/components/ui';
import { useMonitorSnapshot } from '@/hooks/ops/useMonitorSnapshot';
import { useScreenAwake } from '@/hooks/useScreenAwake';
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

/** 전광판 공통 프레임 — 다크 보드 + 상단 인셋(ui-01). TV 는 인셋 0이라 무영향. */
function MonitorFrame({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView className="flex-1 bg-gray-900" edges={['top']}>
      {children}
    </SafeAreaView>
  );
}

/**
 * 연결 재시도 배너 — 마지막으로 받은 화면은 계속 띄운 채 상태만 알린다.
 * 전광판은 무인 운영이라 "지금 값이 최신인가"를 사람이 알 방법이 이것뿐이다.
 */
function ReconnectingBanner() {
  return (
    <View className="items-center rounded-md bg-amber-900/60 px-3 py-1">
      <Text className="text-xs text-amber-200">연결이 불안정합니다 · 자동으로 다시 시도 중</Text>
    </View>
  );
}

export default function MonitorScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const {
    snapshot,
    remainingSec,
    levelMissing,
    nextBreak,
    isLoading,
    isTokenInvalid,
    isDisconnected,
  } = useMonitorSnapshot(token);
  const { width, height } = useWindowDimensions();
  const [reportOpen, setReportOpen] = useState(false);

  // web-02: 전광판은 대회 내내 켜둔다. 스냅샷을 받은 뒤에만 잠금을 잡는다.
  // 웹(Wake Lock API)·네이티브(expo-keep-awake) 양쪽을 이 훅 하나가 덮는다 —
  // 네이티브 절반은 네이티브 모듈이라 1.0.7 빌드에서야 실렸다.
  useScreenAwake(!!snapshot);

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

  // 토큰 자체가 무효 — 재시도해도 살아나지 않는다. 사람이 새 링크를 받아야 한다.
  // 🔑 종전에는 isError(네트워크 오류 포함)를 여기로 보내 "무효 링크" 오탐을 냈다(감사 monitor-01).
  if (isTokenInvalid || (!token && !isLoading)) {
    return (
      <MonitorFrame>
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <Text className="text-center text-xl font-sans-bold text-off-white">
            유효하지 않은 모니터 링크입니다
          </Text>
          <Text className="text-center text-sm text-secondary-400">
            운영자에게 새 링크를 요청하거나 QR을 다시 스캔해주세요.
          </Text>
        </View>
      </MonitorFrame>
    );
  }

  // 아직 한 번도 못 받았는데 연결이 안 된다 — 폴링은 백오프하며 계속되므로 복귀할 수 있다.
  if (!snapshot && isDisconnected) {
    return (
      <MonitorFrame>
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <Text className="text-center text-xl font-sans-bold text-off-white">
            서버에 연결할 수 없습니다
          </Text>
          <Text className="text-center text-sm text-secondary-400">
            네트워크를 확인해주세요. 연결되면 자동으로 다시 표시됩니다.
          </Text>
        </View>
      </MonitorFrame>
    );
  }

  if (isLoading || !snapshot) {
    return (
      <MonitorFrame>
        <View className="flex-1 items-center justify-center">
          <Text className="text-base text-secondary-400">불러오는 중…</Text>
        </View>
      </MonitorFrame>
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
      {/* 스냅샷은 있는데 갱신이 막힌 상태 — 화면은 유지하고 신선도만 알린다 */}
      {isDisconnected ? <ReconnectingBanner /> : null}
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
      <MonitorFrame>
        <ScrollView className="flex-1" contentContainerClassName="gap-6 px-5 py-6">
          {header}
          <Hero
            snapshot={snapshot}
            remainingSec={remainingSec}
            levelMissing={levelMissing}
            compact
          />
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
      </MonitorFrame>
    );
  }

  if (config.preset === 'classic') {
    // classic — 현행 유지 배치: 중앙 히어로 + 하단 슬롯 스트립
    return (
      <MonitorFrame>
        <View className="flex-1 gap-6 px-8 py-6">
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
      </MonitorFrame>
    );
  }

  // full(기본) / mirror — 좌우 3컬럼: 슬롯 컬럼 · 중앙 히어로 · 프라이즈 패널
  const rowDirection = config.preset === 'mirror' ? 'flex-row-reverse' : 'flex-row';
  return (
    <MonitorFrame>
      <View className="flex-1 gap-4 px-8 py-6">
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
    </MonitorFrame>
  );
}

/**
 * ops 1c — STATUS 상단 클럭 제어.
 * 서버동기 클럭(useOpsClock) + 블라인드 구조(useOpsBlindLevels)를 읽어 대형 타이머·현재 블라인드·
 * 다음 레벨을 표시하고, 클럭 변이훅(start/pause/setLevel/adjust)으로 운영자가 제어한다.
 * 블라인드 미설정/레벨 누락 시 LEVELS 탭으로 안내(onNavigateToLevels).
 */
import { View, Text, Pressable } from 'react-native';
import { NumericText } from '@/components/ui';
import {
  useOpsClock,
  useOpsBlindLevels,
  useStartClock,
  usePauseClock,
  useSetLevel,
  useAdjustClock,
} from '@/hooks/ops';

import { formatNumber as fmt } from '@/utils/formatters/currency';

/** 남은 초 → mm:ss (음수는 00:00 으로 clamp). */
function formatMmSs(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

interface ClockControlProps {
  tournamentId: string;
  /** 블라인드 미설정 시 LEVELS 탭으로 이동. */
  onNavigateToLevels?: () => void;
}

export function ClockControl({ tournamentId, onNavigateToLevels }: ClockControlProps) {
  const { clock, currentLevel, remainingSec, levelMissing } = useOpsClock(tournamentId);
  const { blindLevels } = useOpsBlindLevels(tournamentId);

  const startMut = useStartClock(tournamentId);
  const pauseMut = usePauseClock(tournamentId);
  const setLevelMut = useSetLevel(tournamentId);
  const adjustMut = useAdjustClock(tournamentId);

  const isPending =
    startMut.isPending || pauseMut.isPending || setLevelMut.isPending || adjustMut.isPending;

  // ── 빈 상태: 블라인드 구조가 없으면 클럭 제어 불가 → LEVELS 안내 ───────────────
  if (blindLevels.length === 0) {
    return (
      <View className="mx-1 items-center gap-3 rounded-lg border border-gray-200 bg-white px-6 py-10 dark:border-gray-700 dark:bg-gray-900">
        <Text className="text-base font-sans-semibold text-content-primary dark:text-off-white">
          블라인드 구조가 아직 없어요
        </Text>
        <Text className="text-center text-sm text-secondary-500 dark:text-secondary-400">
          클럭을 시작하려면 LEVELS 탭에서 블라인드를 먼저 설정하세요.
        </Text>
        {onNavigateToLevels && (
          <Pressable
            onPress={onNavigateToLevels}
            accessibilityRole="button"
            className="min-h-[44px] items-center justify-center rounded-md bg-primary-600 px-6 active:opacity-70"
          >
            <Text className="font-sans-semibold text-white">블라인드 설정하러 가기</Text>
          </Pressable>
        )}
      </View>
    );
  }

  const isRunning = clock?.isRunning ?? false;
  const isPaused = !isRunning && (clock?.pausedRemainingSec ?? null) !== null;
  const currentSort = clock?.currentLevelSort ?? 1;
  const maxSort = blindLevels.length;
  const hasPrev = currentSort > 1;
  const hasNext = currentSort < maxSort;

  // 다음 레벨 미리보기 (sort asc 정렬은 useOpsBlindLevels 가 보장).
  const nextLevel = blindLevels.find((l) => l.sort === currentSort + 1) ?? null;

  const togglePlay = () => {
    if (isPending) return;
    if (isRunning) pauseMut.mutate();
    else startMut.mutate();
  };

  const playLabel = isRunning ? '일시정지' : isPaused ? '재개' : '시작';
  // 동적(삼항) className 은 CSS var 토큰만 — dark:text-off-white 는 정적추출 실패(eslint 가드).
  const timerTone = isPaused ? 'text-error-600 dark:text-error-400' : 'text-content-primary';
  const statusLabel = isRunning
    ? '진행 중'
    : isPaused
      ? '일시정지'
      : levelMissing
        ? '레벨 정보 없음'
        : '시작 전';

  return (
    <View className="mx-1 gap-3 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      {/* 레벨 제어: 이전 / 시작·일시정지 / 다음 */}
      <View className="flex-row gap-2">
        <Pressable
          onPress={() => hasPrev && !isPending && setLevelMut.mutate(currentSort - 1)}
          disabled={!hasPrev || isPending}
          accessibilityRole="button"
          accessibilityLabel="이전 레벨로 이동"
          className={`min-h-[44px] flex-1 items-center justify-center rounded-md ${
            hasPrev && !isPending
              ? 'bg-gray-100 active:opacity-70 dark:bg-gray-800'
              : 'bg-gray-100 opacity-40 dark:bg-gray-800'
          }`}
        >
          <Text className="font-sans-semibold text-content-primary dark:text-off-white">
            이전 레벨
          </Text>
        </Pressable>
        <Pressable
          onPress={togglePlay}
          disabled={isPending}
          accessibilityRole="button"
          accessibilityLabel={`클럭 ${playLabel}`}
          className={`min-h-[44px] flex-1 items-center justify-center rounded-md ${
            isPending ? 'bg-primary-600 opacity-40' : 'bg-primary-600 active:opacity-70'
          }`}
        >
          <Text className="font-sans-semibold text-white">{playLabel}</Text>
        </Pressable>
        <Pressable
          onPress={() => hasNext && !isPending && setLevelMut.mutate(currentSort + 1)}
          disabled={!hasNext || isPending}
          accessibilityRole="button"
          accessibilityLabel="다음 레벨로 이동"
          className={`min-h-[44px] flex-1 items-center justify-center rounded-md ${
            hasNext && !isPending
              ? 'bg-gray-100 active:opacity-70 dark:bg-gray-800'
              : 'bg-gray-100 opacity-40 dark:bg-gray-800'
          }`}
        >
          <Text className="font-sans-semibold text-content-primary dark:text-off-white">
            다음 레벨
          </Text>
        </Pressable>
      </View>

      {/* 레벨 번호 + 상태 */}
      <View className="flex-row items-center justify-center gap-2">
        <Text className="text-sm font-sans-semibold text-secondary-500 dark:text-secondary-400">
          {currentLevel?.isBreak ? '휴식' : `LEVEL ${currentLevel?.level ?? '-'}`}
        </Text>
        <Text className="text-xs text-secondary-500 dark:text-secondary-400">· {statusLabel}</Text>
      </View>

      {/* 대형 타이머 + ±1분 보정 */}
      <View className="flex-row items-center justify-center gap-3">
        <Pressable
          onPress={() => !isPending && adjustMut.mutate(-60)}
          disabled={isPending}
          accessibilityRole="button"
          accessibilityLabel="1분 단축"
          className={`min-h-[44px] items-center justify-center rounded-md px-4 ${
            isPending
              ? 'bg-gray-100 opacity-40 dark:bg-gray-800'
              : 'bg-gray-100 active:opacity-70 dark:bg-gray-800'
          }`}
        >
          <Text className="font-sans-semibold text-content-primary dark:text-off-white">-1분</Text>
        </Pressable>
        <NumericText
          className={`text-5xl font-sans-bold leading-tight ${timerTone}`}
          accessibilityLabel={`남은 시간 ${formatMmSs(remainingSec)}`}
        >
          {formatMmSs(remainingSec)}
        </NumericText>
        <Pressable
          onPress={() => !isPending && adjustMut.mutate(60)}
          disabled={isPending}
          accessibilityRole="button"
          accessibilityLabel="1분 추가"
          className={`min-h-[44px] items-center justify-center rounded-md px-4 ${
            isPending
              ? 'bg-gray-100 opacity-40 dark:bg-gray-800'
              : 'bg-gray-100 active:opacity-70 dark:bg-gray-800'
          }`}
        >
          <Text className="font-sans-semibold text-content-primary dark:text-off-white">+1분</Text>
        </Pressable>
      </View>

      {/* 현재 블라인드 + 다음 레벨 */}
      <View className="items-center gap-1">
        {currentLevel?.isBreak ? (
          <Text className="text-base font-sans-semibold text-content-primary dark:text-off-white">
            휴식 시간
          </Text>
        ) : currentLevel ? (
          <Text className="text-base font-sans-semibold text-content-primary dark:text-off-white">
            블라인드 {fmt(currentLevel.smallBlind)} / {fmt(currentLevel.bigBlind)}
            {currentLevel.ante > 0 ? ` · 앤티 ${fmt(currentLevel.ante)}` : ''}
          </Text>
        ) : (
          <Text className="text-sm text-secondary-500 dark:text-secondary-400">
            현재 레벨 정보를 찾을 수 없습니다.
          </Text>
        )}
        <Text className="text-xs text-secondary-500 dark:text-secondary-400">
          {nextLevel
            ? nextLevel.isBreak
              ? '다음 · 휴식'
              : `다음 · ${fmt(nextLevel.smallBlind)} / ${fmt(nextLevel.bigBlind)}`
            : '다음 레벨 없음 (마지막)'}
        </Text>
      </View>
    </View>
  );
}

export default ClockControl;

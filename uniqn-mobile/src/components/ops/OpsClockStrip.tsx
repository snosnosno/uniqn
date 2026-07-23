/** 상시 클럭 스트립(L1). 축약 표시 + 탭 시 제어 시트. 모든 탭 위에 고정. */
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useOpsClock } from '@/hooks/ops';
import { formatNumber as fmt } from '@/utils/formatters/currency';
import { OpsClockControlSheet } from './OpsClockControlSheet';

interface OpsClockStripProps {
  tournamentId: string;
  onNavigateToLevels: () => void;
}

function mmss(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

/** 스크린리더용 남은 시간(분·초 낱말) — MM:SS 콜론 표기는 낭독이 부자연스럽다. */
function remainingWords(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  return `${Math.floor(s / 60)}분 ${s % 60}초`;
}

export function OpsClockStrip({ tournamentId, onNavigateToLevels }: OpsClockStripProps) {
  const { currentLevel, remainingSec } = useOpsClock(tournamentId);
  const [sheetOpen, setSheetOpen] = useState(false);

  // 정적 라벨은 화면이 담은 정보(레벨·남은 시간)를 스크린리더에서 숨긴다 —
  // 현재 상태를 라벨에 실어 시각 정보와 동등하게 전달한다.
  const controlLabel = currentLevel
    ? `클럭 제어 열기, 레벨 ${currentLevel.level}, 남은 시간 ${remainingWords(remainingSec ?? 0)}`
    : '클럭 제어 열기, 블라인드 미설정';

  return (
    <>
      <Pressable
        onPress={() => setSheetOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={controlLabel}
        className="border-b border-gray-200 px-4 py-3 active:bg-gray-50 dark:border-gray-700 dark:active:bg-gray-800"
      >
        <View className="flex-row items-baseline justify-between">
          <Text className="font-sans-semibold text-xs text-gold">
            LEVEL {currentLevel?.level ?? '—'}
          </Text>
          <Text className="text-2xl font-sans-bold text-content-primary dark:text-off-white">
            {mmss(remainingSec ?? 0)}
          </Text>
        </View>
        <Text className="mt-1 text-xs text-secondary-500 dark:text-secondary-400">
          {currentLevel
            ? `${fmt(currentLevel.smallBlind)} / ${fmt(currentLevel.bigBlind)} · ante ${fmt(currentLevel.ante)}`
            : '블라인드 미설정'}
        </Text>
      </Pressable>
      <OpsClockControlSheet
        tournamentId={tournamentId}
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onNavigateToLevels={onNavigateToLevels}
      />
    </>
  );
}

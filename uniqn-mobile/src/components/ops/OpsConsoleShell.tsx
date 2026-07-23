/** ops 운영 콘솔 반응형 셸(L1·L3·L4). 폰=상단 스트립+5탭+⋯, 태블릿=좌측 사이드바+7탭. */
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SelectBottomSheet } from '@/components/ui';
import { useOpsConsoleLayout } from '@/hooks/ops';
import { OpsClockStrip } from './OpsClockStrip';
import { OpsSummaryStrip } from './OpsSummaryStrip';

export type OpsTabKey =
  | 'status'
  | 'tables'
  | 'players'
  | 'levels'
  | 'staff'
  | 'payouts'
  | 'history';

interface OpsConsoleShellProps {
  tournamentId: string;
  isCompleted: boolean;
  playersCount: number;
  staffCount: number;
  activeTab: OpsTabKey;
  onTabChange: (t: OpsTabKey) => void;
  renderTab: (t: OpsTabKey) => React.ReactNode;
  fab?: React.ReactNode;
}

const PHONE_TABS: OpsTabKey[] = ['status', 'tables', 'players', 'levels', 'staff'];
const OVERFLOW_TABS: OpsTabKey[] = ['payouts', 'history'];
const ALL_TABS: OpsTabKey[] = [...PHONE_TABS, ...OVERFLOW_TABS];

function labelOf(t: OpsTabKey, players: number, staff: number): string {
  switch (t) {
    case 'status':
      return '현황';
    case 'tables':
      return '테이블';
    case 'players':
      return `참가 ${players}`;
    case 'levels':
      return '블라인드';
    case 'staff':
      return `스태프 ${staff}`;
    case 'payouts':
      return '상금';
    case 'history':
      return '이력';
  }
}

export function OpsConsoleShell({
  tournamentId,
  isCompleted,
  playersCount,
  staffCount,
  activeTab,
  onTabChange,
  renderTab,
  fab,
}: OpsConsoleShellProps) {
  const { isWide } = useOpsConsoleLayout();
  const [overflowOpen, setOverflowOpen] = useState(false); // ⋯ 시트(제어형 — trigger prop 없음)

  const overflowOptions = useMemo(
    () => OVERFLOW_TABS.map((t) => ({ label: labelOf(t, playersCount, staffCount), value: t })),
    [playersCount, staffCount]
  );

  const Tab = ({ t, dim }: { t: OpsTabKey; dim?: boolean }) => (
    <Pressable
      onPress={() => onTabChange(t)}
      accessibilityRole="button"
      className={`flex-1 items-center rounded-md py-2 ${activeTab === t ? 'bg-white dark:bg-gray-700' : ''}`}
    >
      <Text
        numberOfLines={1}
        className={`text-xs ${activeTab === t ? 'font-sans-semibold text-content-primary' : dim ? 'text-secondary-400 dark:text-secondary-600' : 'text-secondary-500 dark:text-secondary-400'}`}
      >
        {labelOf(t, playersCount, staffCount)}
      </Text>
    </Pressable>
  );

  // 태블릿: 좌측 사이드바(클럭/요약) + 우측 7탭
  if (isWide) {
    return (
      <View className="flex-1 flex-row">
        <View className="w-60 border-r border-gray-200 dark:border-gray-700">
          {!isCompleted && (
            <OpsClockStrip
              tournamentId={tournamentId}
              onNavigateToLevels={() => onTabChange('levels')}
            />
          )}
          <OpsSummaryStrip tournamentId={tournamentId} onPress={() => onTabChange('status')} />
        </View>
        <View className="flex-1">
          <View className="mx-3 mb-2 mt-2 flex-row rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
            {ALL_TABS.map((t) => (
              <Tab key={t} t={t} dim={OVERFLOW_TABS.includes(t)} />
            ))}
          </View>
          <View className="flex-1">{renderTab(activeTab)}</View>
          {fab}
        </View>
      </View>
    );
  }

  // 폰: 상단 스트립 + 5탭 + ⋯
  const isOverflowActive = OVERFLOW_TABS.includes(activeTab);
  return (
    <View className="flex-1">
      {!isCompleted && (
        <OpsClockStrip
          tournamentId={tournamentId}
          onNavigateToLevels={() => onTabChange('levels')}
        />
      )}
      <OpsSummaryStrip tournamentId={tournamentId} onPress={() => onTabChange('status')} />
      <View className="mx-4 mb-2 mt-1 flex-row items-center rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
        {PHONE_TABS.map((t) => (
          <Tab key={t} t={t} />
        ))}
        <Pressable
          onPress={() => setOverflowOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="더 보기"
          className={`items-center rounded-md px-2 py-2 ${isOverflowActive ? 'bg-white dark:bg-gray-700' : ''}`}
        >
          <Text
            className={`text-base ${isOverflowActive ? 'text-gold' : 'text-secondary-500 dark:text-secondary-400'}`}
          >
            ⋯
          </Text>
        </Pressable>
      </View>
      <View className="flex-1">{renderTab(activeTab)}</View>
      {fab}
      <SelectBottomSheet
        visible={overflowOpen}
        onClose={() => setOverflowOpen(false)}
        title="더 보기"
        options={overflowOptions}
        onSelect={(v) => onTabChange(v as OpsTabKey)} // onSelect 가 내부에서 onClose 까지 호출(BottomSheet.tsx:367-373)
      />
    </View>
  );
}

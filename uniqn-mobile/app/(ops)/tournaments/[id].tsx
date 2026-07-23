/** ops 대회 상세 — OpsConsoleShell 반응형 셸. 기본 진입 = 현황(L2). RLS 단일 진실. */
import { useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { StackHeader } from '@/components/headers';
import {
  OpsConsoleShell,
  type OpsTabKey,
  OpsStatusTab,
  PlayersTab,
  TablesTab,
  BlindLevelsTab,
  StaffTab,
  HistoryTab,
  PayoutsTab,
} from '@/components/ops';
import { useOpsTournament, useOpsParticipants, useOpsStaff } from '@/hooks/ops';

export default function OpsTournamentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tournamentId = id ?? '';
  const { tournament, isLoading } = useOpsTournament(tournamentId);
  const { participants, isLoading: participantsLoading } = useOpsParticipants(tournamentId);
  const { data: staffRoster } = useOpsStaff(tournamentId);
  const [tab, setTab] = useState<OpsTabKey>('status');

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-surface-page dark:bg-surface">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (!tournament) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top']}>
        <StackHeader title="대회" fallbackHref="/(ops)/tournaments" />
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-secondary-500 dark:text-secondary-400">
            대회를 찾을 수 없거나 접근 권한이 없습니다.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderTab = (t: OpsTabKey) => {
    switch (t) {
      case 'status':
        return <OpsStatusTab tournament={tournament} />;
      case 'players':
        return (
          <PlayersTab
            tournament={tournament}
            participants={participants}
            isLoading={participantsLoading}
            onOpenPayouts={() => setTab('payouts')}
          />
        );
      case 'tables':
        return <TablesTab tournamentId={tournamentId} />;
      case 'levels':
        return <BlindLevelsTab tournamentId={tournamentId} />;
      case 'staff':
        return <StaffTab tournamentId={tournamentId} tournament={tournament} />;
      case 'history':
        return <HistoryTab tournamentId={tournamentId} />;
      case 'payouts':
        return <PayoutsTab tournament={tournament} />;
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top']}>
      <StackHeader title={tournament.name} fallbackHref="/(ops)/tournaments" />
      <OpsConsoleShell
        tournamentId={tournamentId}
        isCompleted={tournament.status === 'completed'}
        playersCount={participants.length}
        staffCount={staffRoster?.length ?? 0}
        activeTab={tab}
        onTabChange={setTab}
        renderTab={renderTab}
      />
    </SafeAreaView>
  );
}

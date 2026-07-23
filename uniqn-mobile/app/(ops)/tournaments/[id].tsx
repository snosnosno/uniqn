/** ops 대회 상세 — OpsConsoleShell 반응형 셸. 기본 진입 = 현황(L2). RLS 단일 진실. */
import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { StackHeader } from '@/components/headers';
import { UserPlusIcon } from '@/components/icons';
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
  OpsRegisterParticipantSheet,
} from '@/components/ops';
import { useOpsTournament, useOpsParticipants, useOpsStaff } from '@/hooks/ops';

/**
 * 참가 등록 확장 FAB(L7) — 참가 탭에서만 셸 fab 슬롯에 주입.
 * 포지셔닝은 셸이 아닌 FAB 자체(absolute) — BoardWriteFab 선례. 56px(≥44px 터치 타깃).
 */
function OpsRegisterFab({ onPress }: { onPress: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', right: 16, bottom: 16 + insets.bottom }}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="참가 등록"
        className="h-14 flex-row items-center gap-1.5 rounded-2xl bg-primary-600 px-5 shadow-lg active:opacity-70"
      >
        <UserPlusIcon size={20} color="#FFFFFF" />
        <Text className="font-sans-semibold text-white">등록</Text>
      </Pressable>
    </View>
  );
}

export default function OpsTournamentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tournamentId = id ?? '';
  const { tournament, isLoading } = useOpsTournament(tournamentId);
  const { participants, isLoading: participantsLoading } = useOpsParticipants(tournamentId);
  const { data: staffRoster } = useOpsStaff(tournamentId);
  const [tab, setTab] = useState<OpsTabKey>('status');
  // 등록 시트 오픈 상태 — FAB(참가 탭) 소유. PlayersTab 인라인 폼 대체(L7).
  const [registerOpen, setRegisterOpen] = useState(false);

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
        return <TablesTab tournamentId={tournamentId} onOpenPayouts={() => setTab('payouts')} />;
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
        fab={
          tab === 'players' ? <OpsRegisterFab onPress={() => setRegisterOpen(true)} /> : undefined
        }
      />
      <OpsRegisterParticipantSheet
        tournamentId={tournamentId}
        visible={registerOpen}
        onClose={() => setRegisterOpen(false)}
      />
    </SafeAreaView>
  );
}

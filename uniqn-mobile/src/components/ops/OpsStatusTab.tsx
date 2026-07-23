/** 현황 탭(L2). 기존 [id].tsx status 탭에서 클럭을 뺀 나머지: 통계·등록토글·상태·모니터. */
import { ScrollView, Text, View, Pressable } from 'react-native';
import { useToggleRegistration, useSetTournamentStatus } from '@/hooks/ops';
import { LiveStatsPanel } from './LiveStatsPanel';
import { MonitorLinkButton } from './MonitorLinkButton';
import { MonitorConfigCard } from './MonitorConfigCard';
import { TournamentResultCard } from './TournamentResultCard';
import type { OpsTournament, OpsTournamentStatus } from '@/types/ops';

interface OpsStatusTabProps {
  tournament: OpsTournament;
}

export function OpsStatusTab({ tournament }: OpsStatusTabProps) {
  const tournamentId = tournament.id;
  const toggleMut = useToggleRegistration(tournamentId);
  const statusMut = useSetTournamentStatus(tournamentId);
  const isCompleted = tournament.status === 'completed';

  const nextStatusActions: { label: string; to: OpsTournamentStatus }[] =
    tournament.status === 'upcoming'
      ? [{ label: '대회 시작', to: 'active' }]
      : tournament.status === 'active'
        ? [{ label: '대회 종료', to: 'completed' }]
        : [];

  return (
    <ScrollView
      className="flex-1 px-3"
      contentContainerStyle={{ paddingBottom: 24 }}
      keyboardShouldPersistTaps="handled"
    >
      {isCompleted && (
        <View className="mb-2">
          <TournamentResultCard tournament={tournament} />
        </View>
      )}

      <LiveStatsPanel tournamentId={tournamentId} />
      <MonitorLinkButton tournamentId={tournamentId} monitorToken={tournament.monitorToken} />
      <MonitorConfigCard tournamentId={tournamentId} monitorConfig={tournament.monitorConfig} />

      {!isCompleted && (
        <View className="mx-1 mt-3 flex-row items-center justify-between rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <Text className="text-content-primary dark:text-off-white">등록(SUBSCRIPTIONS)</Text>
          <Pressable
            onPress={() => toggleMut.mutate(!tournament.registrationOpen)}
            accessibilityRole="button"
            className={`rounded-md px-3 py-1.5 active:opacity-70 ${tournament.registrationOpen ? 'bg-green-600' : 'bg-gray-400 dark:bg-gray-600'}`}
          >
            <Text className="font-sans-semibold text-sm text-white">
              {tournament.registrationOpen ? '열림 (마감하기)' : '마감 (열기)'}
            </Text>
          </Pressable>
        </View>
      )}

      <View className="mx-1 mt-2 flex-row items-center justify-between rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <Text className="text-content-primary dark:text-off-white">상태: {tournament.status}</Text>
        <View className="flex-row gap-2">
          {nextStatusActions.map((a) => (
            <Pressable
              key={a.to}
              onPress={() => statusMut.mutate(a.to)}
              accessibilityRole="button"
              className="rounded-md bg-primary-600 px-3 py-1.5 active:opacity-70"
            >
              <Text className="font-sans-semibold text-sm text-white">{a.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

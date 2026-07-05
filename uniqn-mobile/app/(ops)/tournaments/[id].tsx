/** ops 대회 상세 (1a) — PLAYERS / STATUS 세그먼트. RLS 단일 진실(없으면 빈 화면). */
import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { StackHeader } from '@/components/headers';
import {
  PlayersTab,
  TablesTab,
  ClockControl,
  LiveStatsPanel,
  BlindLevelsTab,
  HistoryTab,
  MonitorLinkButton,
  PayoutsTab,
  TournamentResultCard,
} from '@/components/ops';
import {
  useOpsTournament,
  useOpsParticipants,
  useToggleRegistration,
  useSetTournamentStatus,
} from '@/hooks/ops';
import type { OpsTournamentStatus } from '@/types/ops';

export default function OpsTournamentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tournamentId = id ?? '';
  const { tournament, isLoading } = useOpsTournament(tournamentId);
  const { participants, isLoading: participantsLoading } = useOpsParticipants(tournamentId);

  const toggleMut = useToggleRegistration(tournamentId);
  const statusMut = useSetTournamentStatus(tournamentId);

  const [tab, setTab] = useState<
    'players' | 'status' | 'tables' | 'levels' | 'history' | 'payouts'
  >('players');

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

  const nextStatusActions: { label: string; to: OpsTournamentStatus }[] =
    tournament.status === 'upcoming'
      ? [{ label: '대회 시작', to: 'active' }]
      : tournament.status === 'active'
        ? [{ label: '대회 종료', to: 'completed' }]
        : [];

  // 🔨H7: completed = 클럭 대신 결과 뷰, 등록 토글 숨김. LiveStats·Monitor·상태 카드는 유지.
  const isCompleted = tournament.status === 'completed';

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top']}>
      <StackHeader title={tournament.name} fallbackHref="/(ops)/tournaments" />

      {/* 세그먼트 (6탭 — 한글 축약 라벨로 가로 폭 절약) */}
      <View className="mx-4 mb-2 mt-1 flex-row rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
        {(['players', 'status', 'tables', 'levels', 'history', 'payouts'] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            accessibilityRole="button"
            className={`flex-1 items-center rounded-md py-2 ${tab === t ? 'bg-white dark:bg-gray-700' : ''}`}
          >
            <Text
              numberOfLines={1}
              className={`text-xs ${tab === t ? 'font-sans-semibold text-content-primary' : 'text-secondary-500 dark:text-secondary-400'}`}
            >
              {t === 'players'
                ? `참가 ${participants.length}`
                : t === 'status'
                  ? '현황'
                  : t === 'tables'
                    ? '테이블'
                    : t === 'levels'
                      ? '블라인드'
                      : t === 'history'
                        ? '이력'
                        : '상금'}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'players' ? (
        <PlayersTab
          tournament={tournament}
          participants={participants}
          isLoading={participantsLoading}
        />
      ) : tab === 'status' ? (
        <ScrollView
          className="flex-1 px-3"
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* 진행 중: 서버동기 클럭 제어 / 종료: 결과 뷰(🔨H7 ①) */}
          <View className="mb-2">
            {isCompleted ? (
              <TournamentResultCard tournament={tournament} />
            ) : (
              <ClockControl
                tournamentId={tournamentId}
                onNavigateToLevels={() => setTab('levels')}
              />
            )}
          </View>

          {/* 라이브 통계판(서버 단일소스) — 🔨H7 ② 유지 */}
          <LiveStatsPanel tournamentId={tournamentId} />

          {/* 공개 모니터(전광판) 링크 — 🔨H7 ② 유지 */}
          <MonitorLinkButton tournamentId={tournamentId} monitorToken={tournament.monitorToken} />

          {/* 등록 토글 — 🔨H7 ③ completed 에서는 숨김(재개방 조작은 무의미·혼란 표면) */}
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

          {/* 상태 카드 — 🔨H7 ④ 유지(completed 에서 nextStatusActions 빈 배열 → 표시 전용) */}
          <View className="mx-1 mt-2 flex-row items-center justify-between rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
            <Text className="text-content-primary dark:text-off-white">
              상태: {tournament.status}
            </Text>
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
      ) : tab === 'tables' ? (
        <TablesTab tournamentId={tournamentId} />
      ) : tab === 'levels' ? (
        <BlindLevelsTab tournamentId={tournamentId} />
      ) : tab === 'history' ? (
        <HistoryTab tournamentId={tournamentId} />
      ) : tab === 'payouts' ? (
        <PayoutsTab tournament={tournament} />
      ) : null}
    </SafeAreaView>
  );
}

/** ops 대회 상세 (1a) — PLAYERS / STATUS 세그먼트. RLS 단일 진실(없으면 빈 화면). */
import { useState } from 'react';
import {
  Alert,
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { AppFlashList } from '@/components/ui/AppFlashList';
import { StackHeader } from '@/components/headers';
import {
  TablesTab,
  ClockControl,
  LiveStatsPanel,
  BlindLevelsTab,
  HistoryTab,
  MonitorLinkButton,
  PlayerClaimButton,
  PayoutsTab,
} from '@/components/ops';
import {
  useOpsTournament,
  useOpsParticipants,
  useRegisterParticipant,
  useAddRebuy,
  useAddAddon,
  useToggleRegistration,
  useSetTournamentStatus,
  useBustParticipant,
  useReenterParticipant,
} from '@/hooks/ops';
import type { OpsParticipant, OpsTournamentStatus } from '@/types/ops';

const fmt = (n: number) => n.toLocaleString('ko-KR');

export default function OpsTournamentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tournamentId = id ?? '';
  const { tournament, isLoading } = useOpsTournament(tournamentId);
  const { participants } = useOpsParticipants(tournamentId);

  const registerMut = useRegisterParticipant(tournamentId);
  const rebuyMut = useAddRebuy(tournamentId);
  const addonMut = useAddAddon(tournamentId);
  const toggleMut = useToggleRegistration(tournamentId);
  const statusMut = useSetTournamentStatus(tournamentId);
  const bustMut = useBustParticipant(tournamentId);
  const reenterMut = useReenterParticipant(tournamentId);

  const [tab, setTab] = useState<
    'players' | 'status' | 'tables' | 'levels' | 'history' | 'payouts'
  >('players');
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [nationality, setNationality] = useState('');
  const [phone, setPhone] = useState('');
  const [buyIn, setBuyIn] = useState('');

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

  const submitRegister = () => {
    if (!name.trim()) return;
    registerMut.mutate(
      {
        name: name.trim(),
        nationality: nationality.trim() || undefined,
        phone: phone.trim() || undefined,
        buyInAmount: buyIn.trim() ? parseInt(buyIn.replace(/[^0-9]/g, ''), 10) : undefined,
      },
      {
        onSuccess: () => {
          setName('');
          setNationality('');
          setPhone('');
          setBuyIn('');
          setShowForm(false);
        },
      }
    );
  };

  const nextStatusActions: { label: string; to: OpsTournamentStatus }[] =
    tournament.status === 'upcoming'
      ? [{ label: '대회 시작', to: 'active' }]
      : tournament.status === 'active'
        ? [{ label: '대회 종료', to: 'completed' }]
        : [];

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
        <View className="flex-1">
          <View className="flex-row items-center justify-between px-4 py-2">
            <Text className="text-sm text-secondary-500 dark:text-secondary-400">
              {tournament.registrationOpen ? '등록 열림' : '등록 마감'}
            </Text>
            <Pressable
              onPress={() => setShowForm((s) => !s)}
              accessibilityRole="button"
              className="rounded-md bg-primary-600 px-3 py-1.5 active:opacity-70"
            >
              <Text className="font-sans-semibold text-sm text-white">
                {showForm ? '닫기' : '+ 워크인 등록'}
              </Text>
            </Pressable>
          </View>

          {showForm && (
            <View className="mx-4 mb-2 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="참가자 이름 *"
                placeholderTextColor="#9CA3AF"
                maxLength={50}
                className="mb-2 rounded-md border border-gray-300 px-3 py-2 text-content-primary dark:border-gray-700 dark:text-off-white"
              />
              <View className="flex-row gap-2">
                <TextInput
                  value={nationality}
                  onChangeText={setNationality}
                  placeholder="국적 (예: KR)"
                  placeholderTextColor="#9CA3AF"
                  className="mb-2 flex-1 rounded-md border border-gray-300 px-3 py-2 text-content-primary dark:border-gray-700 dark:text-off-white"
                />
                <TextInput
                  value={buyIn}
                  onChangeText={setBuyIn}
                  placeholder="바이인 금액"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="number-pad"
                  className="mb-2 flex-1 rounded-md border border-gray-300 px-3 py-2 text-content-primary dark:border-gray-700 dark:text-off-white"
                />
              </View>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="전화번호 (선택)"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
                className="mb-2 rounded-md border border-gray-300 px-3 py-2 text-content-primary dark:border-gray-700 dark:text-off-white"
              />
              <Pressable
                onPress={submitRegister}
                disabled={!name.trim() || registerMut.isPending}
                accessibilityRole="button"
                className={`items-center rounded-md py-2.5 ${name.trim() && !registerMut.isPending ? 'bg-primary-600 active:opacity-70' : 'bg-gray-300 dark:bg-gray-700'}`}
              >
                <Text className="font-sans-semibold text-white">
                  {registerMut.isPending ? '등록 중…' : '등록'}
                </Text>
              </Pressable>
            </View>
          )}

          <AppFlashList
            data={participants}
            keyExtractor={(p: OpsParticipant) => p.id}
            estimatedItemSize={64}
            contentContainerStyle={{ padding: 16, paddingTop: 4 }}
            renderItem={({ item }: { item: OpsParticipant }) => (
              <View className="mb-2 flex-row items-center rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
                <Text className="w-10 font-sans-semibold text-sm text-secondary-500 dark:text-secondary-400">
                  #{item.entryNumber}
                </Text>
                <View className="flex-1">
                  <Text
                    className="font-sans-semibold text-content-primary dark:text-off-white"
                    numberOfLines={1}
                  >
                    {item.name}
                    {item.nationality ? ` · ${item.nationality}` : ''}
                  </Text>
                  <Text className="text-xs text-secondary-500 dark:text-secondary-400">
                    {fmt(item.chips)} chips
                    {item.rebuys > 0 ? ` · R${item.rebuys}` : ''}
                    {item.addOns > 0 ? ` · A${item.addOns}` : ''}
                  </Text>
                  {/* 탈락 배지 — busted 시 순위+상금 표시 */}
                  {item.status === 'busted' && (
                    <Text className="text-xs text-secondary-500 dark:text-secondary-400">
                      탈락 · {item.finishPosition ?? '-'}위
                      {item.prizeAmount !== null && item.prizeAmount !== undefined
                        ? ` · 상금 ${fmt(item.prizeAmount)}`
                        : ''}
                    </Text>
                  )}
                </View>
                <View className="flex-row gap-1">
                  {item.status === 'active' && (
                    <>
                      <Pressable
                        onPress={() => rebuyMut.mutate(item.id)}
                        accessibilityRole="button"
                        className="rounded-md bg-gray-100 px-2 py-1.5 active:opacity-70 dark:bg-gray-800"
                      >
                        <Text className="text-xs text-content-primary dark:text-off-white">
                          리바이
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => addonMut.mutate(item.id)}
                        accessibilityRole="button"
                        className="rounded-md bg-gray-100 px-2 py-1.5 active:opacity-70 dark:bg-gray-800"
                      >
                        <Text className="text-xs text-content-primary dark:text-off-white">
                          애드온
                        </Text>
                      </Pressable>
                      {/* 탈락 처리 — 확인 Alert 후 bust RPC 호출 */}
                      <Pressable
                        onPress={() =>
                          Alert.alert('탈락 처리', `${item.name} 님을 탈락 처리할까요?`, [
                            { text: '취소', style: 'cancel' },
                            {
                              text: '탈락 처리',
                              style: 'destructive',
                              onPress: () =>
                                bustMut.mutate(item.id, {
                                  onSuccess: (r) => {
                                    if (r.winnerFinalized && r.winner) {
                                      Alert.alert(
                                        '우승 확정',
                                        `1위 · 상금 ${
                                          r.winner.prizeAmount !== null
                                            ? fmt(r.winner.prizeAmount)
                                            : '미설정'
                                        }`
                                      );
                                    } else {
                                      Alert.alert(
                                        r.prizeAmount !== null ? 'ITM 종료' : '탈락 처리 완료',
                                        `${r.finishPosition}위${
                                          r.prizeAmount !== null
                                            ? ` · 상금 ${fmt(r.prizeAmount)}`
                                            : ''
                                        }`
                                      );
                                    }
                                  },
                                }),
                            },
                          ])
                        }
                        accessibilityRole="button"
                        className="min-h-[44px] items-center justify-center rounded-md border border-error-500 px-2 active:opacity-70 dark:border-error-400"
                      >
                        <Text className="text-xs text-error-600 dark:text-error-400">탈락</Text>
                      </Pressable>
                    </>
                  )}
                  {/* 재진입 — busted 참가자에게만 노출 */}
                  {item.status === 'busted' && (
                    <Pressable
                      onPress={() => reenterMut.mutate(item.id)}
                      accessibilityRole="button"
                      className="min-h-[44px] items-center justify-center rounded-md bg-primary-600 px-2 active:opacity-70"
                    >
                      <Text className="text-xs text-white">재진입</Text>
                    </Pressable>
                  )}
                  {/* 플레이어 링크(QR) — 전 상태 발급 가능 */}
                  <PlayerClaimButton
                    tournamentId={tournamentId}
                    participantId={item.id}
                    viewToken={item.viewToken}
                  />
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View className="items-center py-10">
                <Text className="text-secondary-500 dark:text-secondary-400">
                  아직 참가자가 없습니다.
                </Text>
              </View>
            }
          />
        </View>
      ) : tab === 'status' ? (
        <ScrollView
          className="flex-1 px-3"
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* 서버동기 클럭 제어 */}
          <View className="mb-2">
            <ClockControl tournamentId={tournamentId} onNavigateToLevels={() => setTab('levels')} />
          </View>

          {/* 라이브 통계판(서버 단일소스) */}
          <LiveStatsPanel tournamentId={tournamentId} />

          {/* 공개 모니터(전광판) 링크 */}
          <MonitorLinkButton tournamentId={tournamentId} monitorToken={tournament.monitorToken} />

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
        <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
          <PayoutsTab tournamentId={tournamentId} />
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

/** ops PLAYERS 탭 — 등록 폼·참가자 리스트·리바이/애드온/탈락/재진입·플레이어 링크. [id].tsx 에서 추출(T10). */
import { useState } from 'react';
import { Alert, View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { AppFlashList } from '@/components/ui/AppFlashList';
import { SelectBottomSheet } from '@/components/ui';
import { PlayerClaimButton } from './PlayerClaimButton';
import {
  useRegisterParticipant,
  useAddRebuy,
  useAddAddon,
  useBustParticipant,
  useUndoBust,
  useReenterParticipant,
} from '@/hooks/ops';
import type { OpsBustResult, OpsParticipant, OpsTournament } from '@/types/ops';

const fmt = (n: number) => n.toLocaleString('ko-KR');

interface PlayersTabProps {
  tournament: OpsTournament;
  participants: OpsParticipant[];
  isLoading: boolean;
}

export function PlayersTab({ tournament, participants, isLoading }: PlayersTabProps) {
  const tournamentId = tournament.id;

  // 바운티 대회 여부 — bountyCost 설정 시 KO 배지·탈락자 지정 피커 노출.
  const isBountyTournament = tournament.bountyCost !== null && tournament.bountyCost !== undefined;

  const registerMut = useRegisterParticipant(tournamentId);
  const rebuyMut = useAddRebuy(tournamentId);
  const addonMut = useAddAddon(tournamentId);
  const bustMut = useBustParticipant(tournamentId);
  const undoMut = useUndoBust(tournamentId);
  const reenterMut = useReenterParticipant(tournamentId);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [nationality, setNationality] = useState('');
  const [phone, setPhone] = useState('');
  const [buyIn, setBuyIn] = useState('');
  // 바운티 대회에서 "누가 눌렀나요?" 피커 대상(=탈락 처리할 참가자). null 이면 미표시.
  const [eliminatorPickerFor, setEliminatorPickerFor] = useState<OpsParticipant | null>(null);

  // bust 성공 후 우승/ITM/일반 종료 분기 안내(비-바운티·바운티 공통).
  const handleBustSuccess = (r: OpsBustResult) => {
    // RPC 계약: winnerFinalized=true면 v_active2=1 조건 동일로 winner 항상 non-null.
    if (r.winnerFinalized && r.winner) {
      Alert.alert(
        '우승 확정',
        `1위 · 상금 ${r.winner.prizeAmount !== null ? fmt(r.winner.prizeAmount) : '미설정'}`
      );
    } else {
      Alert.alert(
        r.prizeAmount !== null ? 'ITM 종료' : '탈락 처리 완료',
        `${r.finishPosition}위${r.prizeAmount !== null ? ` · 상금 ${fmt(r.prizeAmount)}` : ''}`
      );
    }
  };

  // 탈락 버튼 — 비-바운티는 기존 확인 Alert, 바운티는 탈락자 지정 피커 진입.
  const handleBustPress = (target: OpsParticipant) => {
    if (!isBountyTournament) {
      Alert.alert('탈락 처리', `${target.name} 님을 탈락 처리할까요?`, [
        { text: '취소', style: 'cancel' },
        {
          text: '탈락 처리',
          style: 'destructive',
          onPress: () =>
            bustMut.mutate({ participantId: target.id }, { onSuccess: handleBustSuccess }),
        },
      ]);
      return;
    }
    setEliminatorPickerFor(target);
  };

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

  return (
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
              <View className="flex-row items-center gap-1.5">
                <Text
                  className="flex-shrink font-sans-semibold text-content-primary dark:text-off-white"
                  numberOfLines={1}
                >
                  {item.name}
                  {item.nationality ? ` · ${item.nationality}` : ''}
                </Text>
                {/* KO 배지 — 바운티 대회 & 처치 수 > 0 인 참가자만 */}
                {isBountyTournament && item.knockouts > 0 && (
                  <View className="rounded-full bg-red-100 px-2 py-0.5 dark:bg-red-900/40">
                    <Text className="text-[10px] font-bold text-red-600 dark:text-red-300">
                      KO {item.knockouts}
                    </Text>
                  </View>
                )}
              </View>
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
                    <Text className="text-xs text-content-primary dark:text-off-white">리바이</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => addonMut.mutate(item.id)}
                    accessibilityRole="button"
                    className="rounded-md bg-gray-100 px-2 py-1.5 active:opacity-70 dark:bg-gray-800"
                  >
                    <Text className="text-xs text-content-primary dark:text-off-white">애드온</Text>
                  </Pressable>
                  {/* 탈락 처리 — 비-바운티는 확인 Alert, 바운티는 탈락자 지정 피커 */}
                  <Pressable
                    onPress={() => handleBustPress(item)}
                    accessibilityRole="button"
                    className="min-h-[44px] items-center justify-center rounded-md border border-error-500 px-2 active:opacity-70 dark:border-error-400"
                  >
                    <Text className="text-xs text-error-600 dark:text-error-400">탈락</Text>
                  </Pressable>
                </>
              )}
              {/* 탈락 취소 — 대회 active & busted 참가자만(칩·좌석 복원) */}
              {tournament.status === 'active' && item.status === 'busted' && (
                <Pressable
                  onPress={() =>
                    Alert.alert(
                      '탈락 취소',
                      `${item.name} 님의 탈락을 취소할까요?\n칩과 좌석이 복원됩니다.`,
                      [
                        { text: '취소', style: 'cancel' },
                        {
                          text: '탈락 취소',
                          style: 'destructive',
                          onPress: () => undoMut.mutate(item.id),
                        },
                      ]
                    )
                  }
                  accessibilityRole="button"
                  className="min-h-[44px] justify-center rounded-md border border-amber-500 px-3 active:opacity-70 dark:border-amber-400"
                >
                  <Text className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                    탈락 취소
                  </Text>
                </Pressable>
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
            {isLoading ? (
              <ActivityIndicator />
            ) : (
              <Text className="text-secondary-500 dark:text-secondary-400">
                아직 참가자가 없습니다.
              </Text>
            )}
          </View>
        }
      />

      {/* 바운티 탈락자 지정 피커(🔨H3 스크롤·60/90% 스냅). 선택 → 확인 → bust(🔨H4). */}
      <SelectBottomSheet
        visible={eliminatorPickerFor !== null}
        onClose={() => setEliminatorPickerFor(null)}
        title={`${eliminatorPickerFor?.name ?? ''} 님을 누가 눌렀나요?`}
        snapPoints={['60%', '90%']}
        scrollable
        options={[
          // 🔨H3: 기본 이탈 경로를 최상단(항상 가시)
          { label: '지정 안 함', value: '' },
          ...participants
            .filter((p) => p.status === 'active' && p.id !== eliminatorPickerFor?.id)
            .map((p) => ({ label: `#${p.entryNumber} ${p.name}`, value: p.id })),
        ]}
        onSelect={(value) => {
          const target = eliminatorPickerFor;
          if (!target) return;
          setEliminatorPickerFor(null);
          const eliminatorId = value === '' ? null : value;
          const eliminatorName =
            eliminatorId === null
              ? '지정 안 함'
              : (participants.find((p) => p.id === eliminatorId)?.name ?? '');
          // 🔨H4: 스펙 §7.2 "선택 → 확인 → bust" 확인 단계 — 즉시 mutate 금지(비가역 우승확정 대비).
          Alert.alert('탈락 처리', `${target.name} 님 탈락 · KO: ${eliminatorName}`, [
            { text: '취소', style: 'cancel' },
            {
              text: '탈락 처리',
              style: 'destructive',
              onPress: () =>
                bustMut.mutate(
                  { participantId: target.id, eliminatorId },
                  { onSuccess: handleBustSuccess }
                ),
            },
          ]);
        }}
      />
    </View>
  );
}

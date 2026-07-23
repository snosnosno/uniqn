/** ops PLAYERS 탭 — 등록 폼·참가자 리스트. 행 탭 → 공용 액션시트(리바이/애드온/탈락/재진입/탈락취소). [id].tsx 에서 추출(T10). */
import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { AppFlashList } from '@/components/ui/AppFlashList';
import { PlayerClaimButton } from './PlayerClaimButton';
import { OpsParticipantActionSheet } from './OpsParticipantActionSheet';
import { useRegisterParticipant } from '@/hooks/ops';
import type { OpsParticipant, OpsTournament } from '@/types/ops';

import { formatNumber as fmt } from '@/utils/formatters/currency';

interface PlayersTabProps {
  tournament: OpsTournament;
  participants: OpsParticipant[];
  isLoading: boolean;
  /** ITM 탈락 후 상금 화면 링크(H7 — [id].tsx 에서 () => setTab('payouts') 주입, Task 7 예외). */
  onOpenPayouts?: () => void;
}

export function PlayersTab({
  tournament,
  participants,
  isLoading,
  onOpenPayouts,
}: PlayersTabProps) {
  const tournamentId = tournament.id;

  // 바운티 대회 여부 — bountyCost 설정 시 KO 배지 노출. 탈락자 지정 피커는 액션시트로 이관(T7).
  const isBountyTournament = tournament.bountyCost !== null && tournament.bountyCost !== undefined;

  const registerMut = useRegisterParticipant(tournamentId);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [nationality, setNationality] = useState('');
  const [phone, setPhone] = useState('');
  const [buyIn, setBuyIn] = useState('');
  // 행 탭 → 액션시트 대상 참가자. null 이면 닫힘.
  const [sheetParticipant, setSheetParticipant] = useState<OpsParticipant | null>(null);

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
          // 행 전체 탭 → 액션시트. QR(PlayerClaimButton)만 행에 잔류(M6 — 전 상태 1탭 노출).
          <Pressable
            onPress={() => setSheetParticipant(item)}
            accessibilityRole="button"
            accessibilityLabel={`#${item.entryNumber} ${item.name} 액션`}
            className="mb-2 flex-row items-center rounded-lg border border-gray-200 bg-white p-3 active:opacity-70 dark:border-gray-700 dark:bg-gray-900"
          >
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
            <View className="flex-row items-center gap-1">
              {/* 플레이어 링크(QR) — 전 상태 발급 가능. 행에 잔류(시트로 옮기지 않음). */}
              <PlayerClaimButton
                tournamentId={tournamentId}
                participantId={item.id}
                viewToken={item.viewToken}
              />
              <Text className="text-lg text-secondary-400 dark:text-secondary-500">›</Text>
            </View>
          </Pressable>
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

      {/* 공용 액션시트 — 참가 행 진입(seat 미전달 → 좌석 액션 자동 숨김). 바운티 피커·탈락 안내 이관(T7). */}
      <OpsParticipantActionSheet
        tournament={tournament}
        participant={sheetParticipant}
        participants={participants}
        onClose={() => setSheetParticipant(null)}
        onOpenPayouts={onOpenPayouts}
      />
    </View>
  );
}

/** ops 대회 생성 폼 (1a). 1e — "공고 연결(선택)" 필드 + `?postingId=` 프리셋. */
import { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { StackHeader } from '@/components/headers';
import { useCreateOpsTournament } from '@/hooks/ops';
import { PostingPickerSheet } from '@/components/ops';
import { useMyJobPostings } from '@/hooks/useJobManagement';
import { opsBlindLevelService } from '@/services/ops';
import { DEFAULT_BLIND_LEVELS } from '@/domains/ops/defaultBlindStructure';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { logger } from '@/utils/logger';

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View className="mb-3 flex-1">
      <Text className="mb-1 text-xs text-secondary-500 dark:text-secondary-400">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor="#9CA3AF"
        className="rounded-md border border-gray-300 px-3 py-2 text-content-primary dark:border-gray-700 dark:text-off-white"
      />
    </View>
  );
}

const toInt = (v: string) => {
  const n = parseInt(v.replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
};

// 바운티 전용: 빈칸 = null(비-바운티). toInt 는 빈칸→0 이라 바운티에 부적합.
const toIntOrNull = (v: string): number | null => {
  const digits = v.replace(/[^0-9]/g, '');
  return digits === '' ? null : parseInt(digits, 10);
};

export default function OpsTournamentCreateScreen() {
  const createMut = useCreateOpsTournament();
  const { postingId: postingIdParam } = useLocalSearchParams<{ postingId?: string }>();
  const presetPostingId = Array.isArray(postingIdParam) ? postingIdParam[0] : postingIdParam;
  const { data: myPostings } = useMyJobPostings();
  const actorId = useAuthStore((s) => s.user?.uid);

  const [name, setName] = useState('');
  const [venue, setVenue] = useState('');
  const [gameType, setGameType] = useState('NLH');
  const [eventDate, setEventDate] = useState('');
  const [startingChips, setStartingChips] = useState('30000');
  const [seatsPerTable, setSeatsPerTable] = useState('9');
  const [buyInChips, setBuyInChips] = useState('30000');
  const [buyInCost, setBuyInCost] = useState('50000');
  const [feeCost, setFeeCost] = useState('5000');
  const [rebuyChips, setRebuyChips] = useState('30000');
  const [rebuyCost, setRebuyCost] = useState('50000');
  const [addonChips, setAddonChips] = useState('20000');
  const [addonCost, setAddonCost] = useState('30000');
  const [bountyCost, setBountyCost] = useState(''); // 빈칸 = 비-바운티(null)
  const [jobPostingId, setJobPostingId] = useState<string | undefined>(presetPostingId);
  const [showPostingPicker, setShowPostingPicker] = useState(false);

  const selectedPosting = useMemo(
    () => (myPostings ?? []).find((p) => p.id === jobPostingId) ?? null,
    [myPostings, jobPostingId]
  );

  const canSubmit = name.trim().length > 0 && !createMut.isPending;

  const onSubmit = () => {
    createMut.mutate(
      {
        name: name.trim(),
        venue: venue.trim() || undefined,
        eventDate: eventDate.trim() || undefined,
        gameType: gameType.trim() || 'NLH',
        jobPostingId,
        startingChips: toInt(startingChips),
        seatsPerTable: toInt(seatsPerTable) || 9,
        config: {
          buyInChips: toInt(buyInChips),
          rebuyChips: toInt(rebuyChips),
          addonChips: toInt(addonChips),
          buyInCost: toInt(buyInCost),
          feeCost: toInt(feeCost),
          rebuyCost: toInt(rebuyCost),
          addonCost: toInt(addonCost),
          bountyCost: toIntOrNull(bountyCost),
        },
      },
      {
        onSuccess: (r) => {
          // 기본 블라인드 30레벨 시드(B2). fire-and-forget — 시드가 내비게이션을 지연시키지 않는다.
          // 대회는 이미 생성됐으므로 시드 실패는 롤백하지 않고 경고만(블라인드 탭에서 수동 재설정 가능).
          if (actorId) {
            opsBlindLevelService
              .setLevels(r.tournamentId, actorId, DEFAULT_BLIND_LEVELS)
              .catch((e) => {
                logger.error('기본 블라인드 시드 실패(수동 설정 가능)', { error: e });
                useToastStore
                  .getState()
                  .error('기본 블라인드 설정에 실패했어요. 블라인드 탭에서 직접 설정할 수 있어요.');
              });
          }
          router.replace(`/(ops)/tournaments/${r.tournamentId}`);
        },
      }
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top']}>
      <StackHeader title="대회 만들기" fallbackHref="/(ops)/tournaments" />
      <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingVertical: 16 }}>
        <Text className="mb-1 text-xs text-secondary-500 dark:text-secondary-400">대회 이름 *</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="예: 수요 딥스택"
          placeholderTextColor="#9CA3AF"
          maxLength={100}
          className="mb-3 rounded-md border border-gray-300 px-3 py-2 text-content-primary dark:border-gray-700 dark:text-off-white"
        />

        <Text className="mb-1 text-xs text-secondary-500 dark:text-secondary-400">장소</Text>
        <TextInput
          value={venue}
          onChangeText={setVenue}
          placeholder="예: 강남 홀덤펍"
          placeholderTextColor="#9CA3AF"
          className="mb-3 rounded-md border border-gray-300 px-3 py-2 text-content-primary dark:border-gray-700 dark:text-off-white"
        />

        <Text className="mb-1 text-xs text-secondary-500 dark:text-secondary-400">
          공고 연결(선택)
        </Text>
        {jobPostingId ? (
          <View className="mb-3 flex-row items-center justify-between rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700">
            <Text
              numberOfLines={1}
              className="mr-2 flex-1 text-content-primary dark:text-off-white"
            >
              {selectedPosting?.title ?? '연결됨(목록에서 찾을 수 없음)'}
            </Text>
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setShowPostingPicker(true)}
                accessibilityRole="button"
                testID="ops-create-posting-change"
              >
                <Text className="text-sm text-primary-600 dark:text-primary-400">변경</Text>
              </Pressable>
              <Pressable
                onPress={() => setJobPostingId(undefined)}
                accessibilityRole="button"
                testID="ops-create-posting-clear"
              >
                <Text className="text-sm text-error-600 dark:text-error-400">해제</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            onPress={() => setShowPostingPicker(true)}
            accessibilityRole="button"
            testID="ops-create-posting-select"
            className="mb-3 rounded-md border border-gray-300 px-3 py-2 dark:border-gray-700"
          >
            <Text className="text-secondary-500 dark:text-secondary-400">공고를 선택하세요</Text>
          </Pressable>
        )}

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Text className="mb-1 text-xs text-secondary-500 dark:text-secondary-400">게임</Text>
            <TextInput
              value={gameType}
              onChangeText={setGameType}
              placeholder="NLH"
              placeholderTextColor="#9CA3AF"
              className="mb-3 rounded-md border border-gray-300 px-3 py-2 text-content-primary dark:border-gray-700 dark:text-off-white"
            />
          </View>
          <View className="flex-1">
            <Text className="mb-1 text-xs text-secondary-500 dark:text-secondary-400">날짜</Text>
            <TextInput
              value={eventDate}
              onChangeText={setEventDate}
              placeholder="2026-07-01"
              placeholderTextColor="#9CA3AF"
              className="mb-3 rounded-md border border-gray-300 px-3 py-2 text-content-primary dark:border-gray-700 dark:text-off-white"
            />
          </View>
        </View>

        <View className="flex-row gap-3">
          <NumField label="시작 스택" value={startingChips} onChange={setStartingChips} />
          <NumField label="테이블 좌석수" value={seatsPerTable} onChange={setSeatsPerTable} />
        </View>

        <Text className="mb-2 mt-2 font-sans-semibold text-sm text-content-primary dark:text-off-white">
          칩 / 정산
        </Text>
        <View className="flex-row gap-3">
          <NumField label="바이인 칩" value={buyInChips} onChange={setBuyInChips} />
          <NumField label="바이인 비용" value={buyInCost} onChange={setBuyInCost} />
        </View>
        <View className="flex-row gap-3">
          <NumField label="리바이 칩" value={rebuyChips} onChange={setRebuyChips} />
          <NumField label="리바이 비용" value={rebuyCost} onChange={setRebuyCost} />
        </View>
        <View className="flex-row gap-3">
          <NumField label="애드온 칩" value={addonChips} onChange={setAddonChips} />
          <NumField label="애드온 비용" value={addonCost} onChange={setAddonCost} />
        </View>
        <View className="flex-row gap-3">
          <NumField label="수수료(fee)" value={feeCost} onChange={setFeeCost} />
          <NumField label="바운티 (선택)" value={bountyCost} onChange={setBountyCost} />
        </View>

        <Pressable
          onPress={onSubmit}
          disabled={!canSubmit}
          accessibilityRole="button"
          className={`mt-4 items-center rounded-md py-3 ${canSubmit ? 'bg-primary-600 active:opacity-70' : 'bg-gray-300 dark:bg-gray-700'}`}
        >
          <Text className="font-sans-semibold text-base text-white">
            {createMut.isPending ? '만드는 중…' : '대회 만들기'}
          </Text>
        </Pressable>
      </ScrollView>

      <PostingPickerSheet
        visible={showPostingPicker}
        onClose={() => setShowPostingPicker(false)}
        onSelect={(id) => setJobPostingId(id)}
      />
    </SafeAreaView>
  );
}

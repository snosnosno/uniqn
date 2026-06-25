/** ops 대회 생성 폼 (1a). */
import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { StackHeader } from '@/components/headers';
import { useCreateOpsTournament } from '@/hooks/ops';

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

export default function OpsTournamentCreateScreen() {
  const createMut = useCreateOpsTournament();

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

  const canSubmit = name.trim().length > 0 && !createMut.isPending;

  const onSubmit = () => {
    createMut.mutate(
      {
        name: name.trim(),
        venue: venue.trim() || undefined,
        eventDate: eventDate.trim() || undefined,
        gameType: gameType.trim() || 'NLH',
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
        },
      },
      {
        onSuccess: (r) => {
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
          <View className="flex-1" />
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
    </SafeAreaView>
  );
}

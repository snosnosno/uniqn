/**
 * ops 1d — PAYOUTS 탭: 순위별 상금 구조 편집.
 * 빈상태(온보딩) → 편집(rank+amount 행) → 합계+저장 흐름.
 * useOpsPrizes / useSetPrizeStructure 훅 소비. 클라이언트 파생 없음.
 */
import { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, useColorScheme } from 'react-native';
import { useOpsPrizes, useSetPrizeStructure } from '@/hooks/ops';

const fmt = (n: number) => n.toLocaleString('ko-KR');

interface PrizeRow {
  rank: number;
  amount: string; // 입력 raw 문자열 — 저장 시 파싱
}

function parseAmount(raw: string): number {
  return parseInt(raw.replace(/[^0-9]/g, ''), 10) || 0;
}

export function PayoutsTab({ tournamentId }: { tournamentId: string }) {
  const { prizes, isLoading } = useOpsPrizes(tournamentId);
  const setMut = useSetPrizeStructure(tournamentId);
  const colorScheme = useColorScheme();
  const [rows, setRows] = useState<PrizeRow[]>([]);
  const [dirty, setDirty] = useState(false);

  // 서버 데이터 도착/갱신 시 미편집 상태면 draft 동기화(편집 중이면 보존).
  useEffect(() => {
    if (!dirty && prizes.length > 0) {
      setRows(prizes.map((p) => ({ rank: p.rank, amount: String(p.amount) })));
    }
  }, [prizes, dirty]);

  const total = rows.reduce((s, r) => s + parseAmount(r.amount), 0);

  const addRow = () => {
    setRows((rs) => [...rs, { rank: rs.length + 1, amount: '' }]);
    setDirty(true);
  };

  const updateAmount = (idx: number, v: string) => {
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, amount: v } : r)));
    setDirty(true);
  };

  const save = () => {
    const payload = rows
      .map((r) => ({ rank: r.rank, amount: parseAmount(r.amount) }))
      .filter((r) => r.amount > 0);
    // 저장 성공 후 dirty 리셋 → 이후 서버 동기화 허용
    setMut.mutate(payload, { onSuccess: () => setDirty(false) });
  };

  // 로딩 상태
  if (isLoading) {
    return (
      <View className="items-center py-10">
        <ActivityIndicator accessibilityRole="progressbar" accessibilityLabel="로딩 중" />
      </View>
    );
  }

  // 빈상태 온보딩: (1) 인지 (2) 가치 (3) 행동
  if (rows.length === 0) {
    return (
      <View className="items-center gap-3 py-12">
        <Text className="font-sans-semibold text-base text-content-primary dark:text-off-white">
          아직 상금 구조가 없어요
        </Text>
        <Text className="px-8 text-center text-sm text-secondary-500 dark:text-secondary-400">
          순위별 수령액을 설정하면 탈락 시 자동으로 배정돼요.{'\n'}
          대회 시작 전에 설정하는 걸 권장해요.
        </Text>
        <Pressable
          onPress={() => {
            setRows([{ rank: 1, amount: '' }]);
            setDirty(true);
          }}
          accessibilityRole="button"
          className="mt-2 min-h-[44px] items-center justify-center rounded-md bg-primary-600 px-6 active:opacity-70"
        >
          <Text className="font-sans-semibold text-white">상금 구조 만들기</Text>
        </Pressable>
      </View>
    );
  }

  // 편집 뷰
  return (
    <View className="gap-3 px-4 py-4">
      {rows.map((r, idx) => (
        <View key={r.rank} className="flex-row items-center gap-3">
          <Text className="w-12 text-sm text-content-primary dark:text-off-white">{r.rank}위</Text>
          <TextInput
            value={r.amount}
            onChangeText={(v) => updateAmount(idx, v)}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor="#9CA3AF"
            className="min-h-[44px] flex-1 rounded-md border border-gray-200 px-3 text-right text-primary-400 dark:border-gray-700 dark:text-primary-300"
          />
        </View>
      ))}

      {/* 순위 추가 */}
      <Pressable
        onPress={addRow}
        accessibilityRole="button"
        className="min-h-[44px] justify-center"
      >
        <Text className="text-sm text-secondary-500 dark:text-secondary-400">+ 순위 추가</Text>
      </Pressable>

      {/* 구분선 */}
      <View className="h-px bg-gray-200 dark:bg-gray-700" />

      {/* 합계 */}
      <Text className="text-sm text-secondary-500 dark:text-secondary-400">
        합계 <Text className="text-primary-400 dark:text-primary-300">{fmt(total)}</Text>
      </Text>

      {/* 저장 버튼 */}
      <Pressable
        onPress={save}
        disabled={setMut.isPending}
        accessibilityRole="button"
        className={`mt-1 min-h-[44px] items-center justify-center rounded-md ${
          setMut.isPending ? 'bg-gray-300 dark:bg-gray-700' : 'bg-primary-600 active:opacity-70'
        }`}
      >
        {setMut.isPending ? (
          <ActivityIndicator color={colorScheme === 'dark' ? '#FFFFFF' : '#374151'} />
        ) : (
          <Text className="font-sans-semibold text-white">상금 구조 저장</Text>
        )}
      </Pressable>
    </View>
  );
}

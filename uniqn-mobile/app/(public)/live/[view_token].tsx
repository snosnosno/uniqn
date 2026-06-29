/**
 * 공개 플레이어뷰 — ops 1c-4.
 * capability-URL: view_token 만으로 접근(anon). usePlayerView 가 4s 폴링 + 서버시각 offset 보정.
 * 본인 안전필드만 표시(타 참가자·phone·view_token 미노출). 로그인 시 본인 계정 연결(claim).
 * 상태범위(§0.5 B9): 내 자리·내 스택·라이브 클럭·블라인드. 탈락 ITM 배너·재진입 제외(1d/1f).
 */
import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { NumericText } from '@/components/ui';
import { usePlayerView } from '@/hooks/ops/usePlayerView';
import { useClaimParticipant } from '@/hooks/ops/useOpsClaimToken';
import { useAuthStore } from '@/stores/authStore';

const fmt = (n: number) => n.toLocaleString('ko-KR');

function formatMmSs(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

const STATUS_LABEL: Record<string, string> = {
  registered: '등록',
  checked_in: '체크인',
  active: '진행 중',
  busted: '탈락',
  no_show: '불참',
};

export default function PlayerLiveScreen() {
  const scheme = useColorScheme();
  const params = useLocalSearchParams<{ view_token: string }>();
  const token = params.view_token;
  const { view, remainingSec, isLoading, isError } = usePlayerView(token);
  const isAuthed = useAuthStore((s) => !!s.user);
  const claimMut = useClaimParticipant(token ?? '');
  const [claimOpen, setClaimOpen] = useState(false);
  const [pin, setPin] = useState('');

  if (isError || (!token && !isLoading)) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-3 bg-surface-page px-8 dark:bg-surface">
        <Text className="text-center text-xl font-sans-bold text-content-primary dark:text-off-white">
          유효하지 않은 플레이어 링크입니다
        </Text>
        <Text className="text-center text-sm text-secondary-500 dark:text-secondary-400">
          운영자에게 새 QR 또는 링크를 요청해주세요.
        </Text>
      </SafeAreaView>
    );
  }

  if (isLoading || !view) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-surface-page dark:bg-surface">
        <Text className="text-base text-secondary-500 dark:text-secondary-400">불러오는 중…</Text>
      </SafeAreaView>
    );
  }

  const { me, tournament, currentLevel } = view;
  const seated = me.tableNo !== null && me.seatNo !== null;

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}>
        {/* 대회 헤더 */}
        <View>
          <Text className="text-xl font-sans-bold text-content-primary dark:text-off-white">
            {tournament.name}
          </Text>
          {tournament.venue ? (
            <Text className="text-sm text-secondary-500 dark:text-secondary-400">
              {tournament.venue}
            </Text>
          ) : null}
        </View>

        {/* 내 자리 / 내 스택 */}
        <View className="gap-2 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-secondary-500 dark:text-secondary-400">
              #{me.entryNumber} · {me.name}
            </Text>
            <Text className="text-xs font-sans-semibold text-primary-600 dark:text-primary-400">
              {STATUS_LABEL[me.status] ?? me.status}
            </Text>
          </View>
          <View className="items-center py-2">
            <Text className="text-xs text-secondary-500 dark:text-secondary-400">내 스택</Text>
            <NumericText className="text-4xl font-sans-bold text-content-primary dark:text-off-white">
              {fmt(me.chips)}
            </NumericText>
          </View>
          <View className="flex-row items-center justify-center gap-3">
            <Text className="text-base font-sans-semibold text-content-primary dark:text-off-white">
              {seated ? `테이블 ${me.tableNo} · ${me.seatNo}번 좌석` : '아직 좌석 배정 전'}
            </Text>
          </View>
          {(me.rebuys > 0 || me.addOns > 0 || me.reentries > 0) && (
            <Text className="text-center text-xs text-secondary-500 dark:text-secondary-400">
              {me.rebuys > 0 ? `리바이 ${me.rebuys} ` : ''}
              {me.addOns > 0 ? `애드온 ${me.addOns} ` : ''}
              {me.reentries > 0 ? `재입장 ${me.reentries}` : ''}
            </Text>
          )}
          {me.prizeAmount !== null && (
            <Text className="text-center text-sm font-sans-semibold text-primary-600 dark:text-primary-400">
              {me.finishPosition !== null ? `${me.finishPosition}위 · ` : ''}상금{' '}
              {fmt(me.prizeAmount)}
            </Text>
          )}
        </View>

        {/* 라이브 클럭 */}
        <View className="items-center gap-1 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <Text className="text-xs text-secondary-500 dark:text-secondary-400">
            {currentLevel?.isBreak ? '휴식' : `LEVEL ${currentLevel?.level ?? '-'}`}
          </Text>
          <NumericText className="text-5xl font-sans-bold text-content-primary dark:text-off-white">
            {formatMmSs(remainingSec)}
          </NumericText>
          {currentLevel && !currentLevel.isBreak ? (
            <Text className="text-base font-sans-semibold text-content-primary dark:text-off-white">
              블라인드 {fmt(currentLevel.smallBlind)} / {fmt(currentLevel.bigBlind)}
              {currentLevel.ante > 0 ? ` · 앤티 ${fmt(currentLevel.ante)}` : ''}
            </Text>
          ) : currentLevel?.isBreak ? (
            <Text className="text-base font-sans-semibold text-content-primary dark:text-off-white">
              휴식 시간
            </Text>
          ) : null}
          <Text className="text-xs text-secondary-500 dark:text-secondary-400">
            PLAYING {fmt(view.stats.playing)} · ENTRIES {fmt(view.stats.entries)} · AVG{' '}
            {fmt(view.stats.averageStack)}
          </Text>
        </View>

        {/* 계정 연결(claim) */}
        {isAuthed ? (
          <Pressable
            onPress={() => !claimMut.isPending && setClaimOpen(true)}
            disabled={claimMut.isPending}
            accessibilityRole="button"
            className={`min-h-[44px] items-center justify-center rounded-lg ${
              claimMut.isPending ? 'bg-primary-600 opacity-40' : 'bg-primary-600 active:opacity-70'
            }`}
          >
            <Text className="font-sans-semibold text-white">
              {claimMut.isPending ? '연결 중…' : '내 계정에 연결하기'}
            </Text>
          </Pressable>
        ) : (
          <View className="items-center rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
            <Text className="text-center text-sm text-secondary-500 dark:text-secondary-400">
              로그인하면 내 기록을 계정에 저장할 수 있어요.
            </Text>
          </View>
        )}
      </ScrollView>
      {/* PIN 게이트 — 슬립의 8자 연결 PIN 입력(비가역 바인딩). */}
      {claimOpen && (
        <View className="absolute inset-0 items-center justify-center bg-black/50 px-8">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="w-full"
          >
            <View className="w-full gap-3 rounded-xl bg-white p-5 dark:bg-gray-900">
              <Text className="text-lg font-sans-bold text-content-primary dark:text-off-white">
                내 계정에 연결
              </Text>
              <Text className="text-sm text-secondary-500 dark:text-secondary-400">
                슬립에 적힌 8자리 연결 PIN을 입력해주세요. 연결 후에는 직접 해제할 수 없어요(잘못
                연결 시 운영자에게 문의).
              </Text>
              <TextInput
                value={pin}
                onChangeText={(t) =>
                  setPin(
                    t
                      .toUpperCase()
                      .replace(/[^0-9A-Z]/g, '')
                      .slice(0, 8)
                  )
                }
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder="예: 7F3K9A2C"
                placeholderTextColor={scheme === 'dark' ? '#6b7280' : '#9ca3af'}
                maxLength={8}
                className="min-h-[44px] rounded-lg border border-gray-300 px-3 text-center text-lg tracking-widest text-content-primary dark:border-gray-600 dark:text-off-white"
              />
              <View className="flex-row justify-end gap-2 pt-1">
                <Pressable
                  onPress={() => {
                    setClaimOpen(false);
                    setPin('');
                  }}
                  accessibilityRole="button"
                  className="min-h-[44px] items-center justify-center rounded-lg px-4"
                >
                  <Text className="text-secondary-500 dark:text-secondary-400">취소</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (pin.length !== 8 || claimMut.isPending) return;
                    setClaimOpen(false);
                    claimMut.mutate(pin, { onSettled: () => setPin('') });
                  }}
                  disabled={pin.length !== 8 || claimMut.isPending}
                  accessibilityRole="button"
                  className={`min-h-[44px] items-center justify-center rounded-lg px-4 ${
                    pin.length === 8 && !claimMut.isPending
                      ? 'bg-primary-600 active:opacity-70'
                      : 'bg-primary-600 opacity-40'
                  }`}
                >
                  <Text className="font-sans-semibold text-white">연결하기</Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}
    </SafeAreaView>
  );
}

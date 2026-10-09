/**
 * 레이트 등록 자동 마감 설정(모바일) — "레벨·브레이크 N 종료 시 마감".
 *
 * 마감은 서버가 한다(자동 전환이든 운영자가 "다음 레벨"을 누르든 기준을 넘는 순간). 수동 토글은 그대로 쓸 수 있고,
 * 수동으로 다시 열면 서버가 이 설정을 지운다. 선택지·상태 문구는 웹 콘솔과 같은 순수 판정
 * (`domains/ops/registrationCutoff`)을 쓴다 — 두 화면이 같은 말을 해야 한다.
 *
 * 고르는 것과 적용을 나눈다(시트 안에서 고르고 "적용") — 목록을 훑다가 의도치 않은 설정이 들어가지 않게.
 */
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SheetModal } from '@/components/ui';
import { cutoffLevelName, cutoffOptions, cutoffState, type CutoffState } from '@/domains/ops';
import { useOpsBlindLevels, useOpsClock, useSetRegistrationCutoff } from '@/hooks/ops';
import type { OpsTournament } from '@/types/ops';

interface OpsRegistrationCutoffCardProps {
  tournament: OpsTournament;
}

/** 카드 아래 한 줄 안내 — 웹 콘솔(RegistrationCutoffSetting)과 같은 문구. */
export function cutoffStatusText(state: CutoffState, registrationOpen: boolean): string {
  if (state.kind === 'scheduled') {
    return registrationOpen
      ? `${state.label} 종료 후 다음으로 넘어가면 등록을 자동으로 닫아요.`
      : `${state.label} 종료 시 마감으로 설정돼 있어요. 등록을 다시 열면 이 설정은 해제돼요.`;
  }
  if (state.kind === 'closed') {
    return `${state.label} 종료로 등록이 자동 마감됐어요. 다시 열면 자동 마감 설정은 해제돼요.`;
  }
  if (state.kind === 'orphan') {
    return '기준으로 잡은 레벨이 블라인드 구조에서 없어졌어요. 다시 골라 주세요.';
  }
  return '레벨이나 휴식이 끝날 때 등록을 자동으로 닫을 수 있어요.';
}

export function OpsRegistrationCutoffCard({ tournament }: OpsRegistrationCutoffCardProps) {
  const tournamentId = tournament.id;
  const { blindLevels } = useOpsBlindLevels(tournamentId);
  const { clock } = useOpsClock(tournamentId);
  const setCutoff = useSetRegistrationCutoff(tournamentId);

  const saved = tournament.registrationCloseAfterSort ?? null;
  const currentSort = clock?.currentLevelSort ?? 1;
  const options = cutoffOptions(blindLevels, currentSort);
  const state = cutoffState({
    levels: blindLevels,
    cutoffSort: saved,
    currentSort,
    registrationOpen: tournament.registrationOpen,
  });

  const [sheetOpen, setSheetOpen] = useState(false);
  // 시트에서 고르는 중인 값. null = 사용 안 함.
  const [draft, setDraft] = useState<number | null>(saved);

  // 블라인드 구조가 없거나, 고를 레벨도 저장된 설정도 없으면(마지막 레벨) 자리를 차지하지 않는다.
  if (options.length === 0 && saved === null) return null;

  // 저장된 기준이 이미 지나 목록에서 빠졌어도 고른 값으로 보이도록 선택지에 남긴다.
  const savedMissing = saved !== null && !options.some((o) => o.sort === saved);
  const savedName = saved === null ? null : cutoffLevelName(blindLevels, saved);
  const savedLabel =
    saved === null ? '사용 안 함' : savedName ? `${savedName} 종료 시` : '없어진 레벨';

  const choices: { sort: number | null; label: string }[] = [
    { sort: null, label: '사용 안 함' },
    ...(savedMissing && saved !== null ? [{ sort: saved, label: savedLabel }] : []),
    ...options,
  ];

  const dirty = draft !== saved;
  // 닫힌 동안 새 기준을 넣어도 등록을 여는 순간 서버가 지운다 — 해제("사용 안 함")만 받는다.
  const closedBlocksApply = !tournament.registrationOpen && draft !== null;
  const canApply = dirty && !closedBlocksApply && !setCutoff.isPending;

  const openSheet = () => {
    // 열 때마다 저장값에서 다시 시작한다(다른 기기의 변경·수동 개방으로 해제된 값을 반영).
    setDraft(saved);
    setSheetOpen(true);
  };

  const apply = () => {
    if (!canApply) return;
    setCutoff.mutate(draft, { onSuccess: () => setSheetOpen(false) });
  };

  return (
    <View className="mx-1 mt-2 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <View className="flex-row items-center justify-between gap-3">
        <Text className="text-content-primary dark:text-off-white">자동 마감</Text>
        <Pressable
          onPress={openSheet}
          accessibilityRole="button"
          accessibilityLabel={`등록 자동 마감 설정, 현재 ${savedLabel}`}
          className="min-h-[44px] flex-shrink items-center justify-center rounded-md bg-gray-100 px-3 active:opacity-70 dark:bg-gray-800"
        >
          <Text
            className="font-sans-semibold text-sm text-content-primary dark:text-off-white"
            numberOfLines={1}
          >
            {savedLabel} ▾
          </Text>
        </Pressable>
      </View>
      <Text className="mt-2 text-xs text-secondary-500 dark:text-secondary-400">
        {cutoffStatusText(state, tournament.registrationOpen)}
      </Text>

      <SheetModal
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="등록 자동 마감"
        isLoading={setCutoff.isPending}
        footer={
          <Pressable
            onPress={apply}
            disabled={!canApply}
            accessibilityRole="button"
            accessibilityLabel="자동 마감 적용"
            accessibilityState={{ disabled: !canApply }}
            className={`min-h-[48px] items-center justify-center rounded-md ${canApply ? 'bg-primary-600 active:opacity-70' : 'bg-gray-300 dark:bg-gray-700'}`}
          >
            <Text className="font-sans-semibold text-white">
              {setCutoff.isPending ? '적용 중…' : '적용'}
            </Text>
          </Pressable>
        }
      >
        <View className="gap-2 px-4 py-2">
          <Text className="text-sm text-secondary-500 dark:text-secondary-400">
            고른 레벨·휴식이 끝나 다음으로 넘어가는 순간 등록을 닫아요.
          </Text>
          {choices.map((c) => {
            const selected = draft === c.sort;
            return (
              <Pressable
                key={c.sort ?? 'none'}
                onPress={() => setDraft(c.sort)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={c.label}
                className={`min-h-[48px] flex-row items-center justify-between rounded-md border px-3 active:opacity-70 ${
                  selected
                    ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                <Text className="text-content-primary dark:text-off-white">{c.label}</Text>
                {selected ? (
                  <Text className="font-sans-semibold text-primary-600 dark:text-primary-300">
                    ✓
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
          {dirty && closedBlocksApply ? (
            <Text className="text-xs text-error-600 dark:text-error-400">
              등록이 닫혀 있어요. 먼저 등록을 연 뒤 자동 마감을 설정해 주세요.
            </Text>
          ) : null}
        </View>
      </SheetModal>
    </View>
  );
}

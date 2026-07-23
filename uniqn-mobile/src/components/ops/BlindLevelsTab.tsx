/**
 * ops 1c — LEVELS 탭(블라인드 구조).
 * 서버 블라인드(useOpsBlindLevels)를 로컬 draft 배열로 불러와 추가/편집/삭제 후
 * useSetBlindLevels(전체 교체 RPC)로 한 번에 저장한다.
 * 클럭 진행 중 저장 시 타이머 재계산 확인 다이얼로그(impeccable §12).
 */
import { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { AppFlashList } from '@/components/ui/AppFlashList';
import { ConfirmModal } from '@/components/ui/Modal';
import { useOpsBlindLevels, useOpsClock, useSetBlindLevels } from '@/hooks/ops';
import { useToastStore } from '@/stores/toastStore';
import type { OpsBlindLevel } from '@/types/ops';
import { OPS_BLIND_LEVELS_MAX, type OpsBlindLevelInput } from '@/schemas/opsBlindLevel.schema';
import { BlindLevelForm } from './BlindLevelForm';
import { BlindPresetSheet } from './BlindPresetSheet';

import { formatNumber as fmt } from '@/utils/formatters/currency';

const toInput = (l: OpsBlindLevel): OpsBlindLevelInput => ({
  level: l.level,
  smallBlind: l.smallBlind,
  bigBlind: l.bigBlind,
  ante: l.ante,
  durationSec: l.durationSec,
  isBreak: l.isBreak,
});

type FormState = { mode: 'add' } | { mode: 'edit'; index: number } | null;

interface BlindLevelsTabProps {
  tournamentId: string;
}

export function BlindLevelsTab({ tournamentId }: BlindLevelsTabProps) {
  const { blindLevels, isLoading } = useOpsBlindLevels(tournamentId);
  const { clock } = useOpsClock(tournamentId);
  const setLevelsMut = useSetBlindLevels(tournamentId);

  const serverDraft = useMemo(() => blindLevels.map(toInput), [blindLevels]);
  const [draft, setDraft] = useState<OpsBlindLevelInput[]>(serverDraft);
  const [dirty, setDirty] = useState(false);
  const [form, setForm] = useState<FormState>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [presetSheetOpen, setPresetSheetOpen] = useState(false);
  // 마지막 적용 프리셋명. 수동 편집(추가/편집/삭제) 발생 시 null → 미적용 중립 라벨 표시.
  const [appliedPresetName, setAppliedPresetName] = useState<string | null>(null);

  // 레벨 추가 시도 — 상한(100) 초과면 토스트 안내 후 폼 미개방(무한 추가 방지).
  const openAddForm = () => {
    if (form?.mode === 'add') {
      setForm(null);
      return;
    }
    if (draft.length >= OPS_BLIND_LEVELS_MAX) {
      useToastStore
        .getState()
        .warning(`블라인드 레벨은 최대 ${OPS_BLIND_LEVELS_MAX}개까지 추가할 수 있습니다`);
      return;
    }
    setForm({ mode: 'add' });
  };

  // 서버 데이터 도착/갱신 시 미편집 상태면 draft 동기화(편집 중이면 보존).
  useEffect(() => {
    if (!dirty) setDraft(serverDraft);
  }, [serverDraft, dirty]);

  const onFormSubmit = (input: OpsBlindLevelInput) => {
    if (form?.mode === 'edit') {
      const idx = form.index;
      setDraft((prev) => prev.map((d, i) => (i === idx ? input : d)));
    } else {
      setDraft((prev) => [...prev, input]);
    }
    setDirty(true);
    setAppliedPresetName(null);
    setForm(null);
  };

  const removeLevel = (index: number) => {
    setDraft((prev) => prev.filter((_, i) => i !== index));
    setDirty(true);
    setAppliedPresetName(null);
  };

  // 프리셋 적용 = 전체 교체. draft 교체 + dirty(true) 필수(저장 버튼 활성 조건이 dirty).
  const applyPreset = (levels: OpsBlindLevelInput[], presetName: string) => {
    setDraft(levels);
    setDirty(true);
    setAppliedPresetName(presetName);
  };

  const doSave = () => {
    setLevelsMut.mutate(draft, { onSuccess: () => setDirty(false) });
  };

  const onSavePress = () => {
    if (draft.length === 0 || setLevelsMut.isPending) return;
    if (clock?.isRunning) setConfirmOpen(true);
    else doSave();
  };

  const canSave = dirty && draft.length > 0 && !setLevelsMut.isPending;

  return (
    <View className="flex-1">
      {/* 프리셋 바 — 앱 기본/내 프리셋 시트 열기. 이름은 마지막 적용 프리셋(수동 편집 시 "사용자 정의"). */}
      <Pressable
        onPress={() => setPresetSheetOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="블라인드 프리셋 열기"
        className="min-h-[44px] flex-row items-center justify-between border-b border-gray-200 px-4 py-2 active:opacity-70 dark:border-gray-700"
      >
        <Text className="text-sm text-content-primary dark:text-off-white">
          {appliedPresetName ? `프리셋 · ${appliedPresetName}` : '프리셋 선택'}
        </Text>
        <Text className="text-sm text-secondary-500 dark:text-secondary-400">▾</Text>
      </Pressable>

      <View className="flex-row items-center justify-between px-4 py-2">
        <Pressable
          onPress={onSavePress}
          disabled={!canSave}
          accessibilityRole="button"
          className={`min-h-[44px] items-center justify-center rounded-md px-4 ${
            canSave ? 'bg-primary-600 active:opacity-70' : 'bg-gray-300 dark:bg-gray-700'
          }`}
        >
          <Text className="font-sans-semibold text-sm text-white">
            {setLevelsMut.isPending ? '저장 중…' : '구조 저장'}
          </Text>
        </Pressable>
        <Pressable
          onPress={openAddForm}
          accessibilityRole="button"
          className="min-h-[44px] items-center justify-center rounded-md bg-gray-100 px-4 active:opacity-70 dark:bg-gray-800"
        >
          <Text className="font-sans-semibold text-sm text-content-primary dark:text-off-white">
            {form?.mode === 'add' ? '닫기' : '+ 레벨 추가'}
          </Text>
        </Pressable>
      </View>

      {dirty && (
        <Text className="px-4 pb-1 text-xs text-secondary-500 dark:text-secondary-400">
          저장되지 않은 변경이 있습니다.
        </Text>
      )}

      {form && (
        <View className="mx-4 mb-2">
          {/* key 로 add/edit·편집대상 변경 시 강제 리마운트 — 폼 내부 useState 가 새 initial 로 재초기화
              (key 없으면 행 A 편집폼 연 채 행 B 탭 시 A 값이 B 인덱스로 저장되는 stale state 버그) */}
          <BlindLevelForm
            key={form.mode === 'edit' ? `edit-${form.index}` : 'add'}
            initial={form.mode === 'edit' ? draft[form.index] : undefined}
            onSubmit={onFormSubmit}
            onCancel={() => setForm(null)}
          />
        </View>
      )}

      <AppFlashList
        data={draft}
        keyExtractor={(_: OpsBlindLevelInput, index: number) => String(index)}
        estimatedItemSize={64}
        contentContainerStyle={{ padding: 16, paddingTop: 4 }}
        renderItem={({ item, index }: { item: OpsBlindLevelInput; index: number }) => (
          <Pressable
            onPress={() => setForm({ mode: 'edit', index })}
            accessibilityLabel={`${index + 1}번 레벨 편집`}
            className="mb-2 flex-row items-center rounded-lg border border-gray-200 bg-white p-3 active:opacity-70 dark:border-gray-700 dark:bg-gray-900"
          >
            <Text className="w-8 font-sans-semibold text-sm text-secondary-500 dark:text-secondary-400">
              {index + 1}
            </Text>
            <View className="flex-1">
              {item.isBreak ? (
                <Text className="font-sans-semibold text-content-primary dark:text-off-white">
                  휴식
                </Text>
              ) : (
                <Text className="font-sans-semibold text-content-primary dark:text-off-white">
                  LV {item.level} · {fmt(item.smallBlind)} / {fmt(item.bigBlind)}
                  {item.ante > 0 ? ` · 앤티 ${fmt(item.ante)}` : ''}
                </Text>
              )}
              <Text className="text-xs text-secondary-500 dark:text-secondary-400">
                {Math.round(item.durationSec / 60)}분
              </Text>
            </View>
            <Pressable
              onPress={() => removeLevel(index)}
              accessibilityRole="button"
              accessibilityLabel={`${index + 1}번 레벨 삭제`}
              hitSlop={8}
              className="min-h-[44px] items-center justify-center rounded-md bg-gray-100 px-3 active:opacity-70 dark:bg-gray-800"
            >
              <Text className="text-xs text-error-600 dark:text-error-400">삭제</Text>
            </Pressable>
          </Pressable>
        )}
        ListEmptyComponent={
          <View className="items-center gap-2 px-6 py-12">
            <Text className="text-base font-sans-semibold text-content-primary dark:text-off-white">
              블라인드 구조를 추가하세요
            </Text>
            <Text className="text-center text-sm text-secondary-500 dark:text-secondary-400">
              {isLoading
                ? '불러오는 중…'
                : '레벨별 SB/BB·시간(분)·휴식을 추가하면 STATUS 탭에서 클럭을 시작할 수 있습니다.'}
            </Text>
          </View>
        }
      />

      <ConfirmModal
        visible={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={doSave}
        title="블라인드 구조 저장"
        message="진행 중인 타이머가 재계산됩니다. 계속할까요?"
        confirmText="저장하고 재계산"
        cancelText="계속 편집"
      />

      <BlindPresetSheet
        visible={presetSheetOpen}
        onClose={() => setPresetSheetOpen(false)}
        currentLevels={draft}
        onApply={applyPreset}
      />
    </View>
  );
}

/**
 * 블라인드 프리셋 시트(계획 B, B4·B5).
 * 앱 기본(기본 30레벨) + 내 저장 프리셋 목록을 보여주고,
 * 항목 탭 = 전체교체 확인 후 onApply(levels)(B5). 하단에서 현재 구조를 이름 붙여 저장.
 *
 * 입력 다이얼로그 유틸이 없어(confirmAction/showAlert 뿐) 이름 입력은 시트 내
 * TextInput 으로 직접 받고 useSaveBlindPreset(서비스 경유 zod+xss 검증)으로 저장한다.
 */
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SheetModal } from '@/components/ui';
import { confirmAction } from '@/utils/confirmAction';
import { useOpsBlindPresets, useSaveBlindPreset, useDeleteBlindPreset } from '@/hooks/ops';
import { DEFAULT_BLIND_LEVELS } from '@/domains/ops/defaultBlindStructure';
import type { OpsBlindLevelInput } from '@/schemas/opsBlindLevel.schema';

interface BlindPresetSheetProps {
  visible: boolean;
  onClose: () => void;
  currentLevels: OpsBlindLevelInput[];
  /** 적용 콜백. presetName 은 프리셋 바 이름 표시용(마지막 적용 프리셋명). */
  onApply: (levels: OpsBlindLevelInput[], presetName: string) => void;
}

const APP_PRESETS: { name: string; levels: OpsBlindLevelInput[] }[] = [
  { name: '기본 30레벨', levels: DEFAULT_BLIND_LEVELS },
];

export function BlindPresetSheet({
  visible,
  onClose,
  currentLevels,
  onApply,
}: BlindPresetSheetProps) {
  const { presets } = useOpsBlindPresets();
  const saveMut = useSaveBlindPreset();
  const deleteMut = useDeleteBlindPreset();
  const [name, setName] = useState('');

  const apply = (presetName: string, levels: OpsBlindLevelInput[]) => {
    confirmAction({
      title: '프리셋 적용',
      message: `현재 블라인드 구조를 "${presetName}"(으)로 교체할까요?\n기존 편집 내용은 사라집니다.`,
      confirmText: '교체',
      destructive: true,
      onConfirm: () => {
        onApply(levels, presetName);
        onClose();
      },
    });
  };

  const trimmedName = name.trim();
  const canSave = trimmedName.length > 0 && currentLevels.length > 0 && !saveMut.isPending;

  const onSavePress = () => {
    if (!canSave) return;
    saveMut.mutate({ name: trimmedName, levels: currentLevels }, { onSuccess: () => setName('') });
  };

  // 적용 Pressable 안에 삭제 Pressable 을 중첩하면 웹에서 <button> in <button>
  // 하이드레이션 에러가 난다 — 행을 View 로 두고 [적용] · [삭제] 를 형제로 배치한다.
  const Row = ({
    name: rowName,
    levels,
    onDelete,
  }: {
    name: string;
    levels: OpsBlindLevelInput[];
    onDelete?: () => void;
  }) => (
    <View className="flex-row items-center border-b border-gray-200 dark:border-gray-700">
      <Pressable
        onPress={() => apply(rowName, levels)}
        accessibilityRole="button"
        className="min-h-[44px] flex-1 flex-row items-center justify-between px-4 py-3 active:bg-gray-50 dark:active:bg-gray-800"
      >
        <Text className="text-content-primary dark:text-off-white">{rowName}</Text>
        <Text className="text-xs text-secondary-500 dark:text-secondary-400">
          {levels.length}레벨
        </Text>
      </Pressable>
      {onDelete && (
        <Pressable
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel="프리셋 삭제"
          className="min-h-[44px] min-w-[44px] items-center justify-center pr-2 active:bg-gray-50 dark:active:bg-gray-800"
        >
          <Text className="text-xs text-error-600 dark:text-error-400">삭제</Text>
        </Pressable>
      )}
    </View>
  );

  return (
    <SheetModal visible={visible} onClose={onClose} title="블라인드 프리셋">
      <View>
        {APP_PRESETS.map((p) => (
          <Row key={p.name} name={p.name} levels={p.levels} />
        ))}
        {presets.map((p) => (
          <Row
            key={p.id}
            name={p.name}
            levels={p.levels}
            onDelete={() =>
              confirmAction({
                title: '프리셋 삭제',
                message: `"${p.name}" 프리셋을 삭제할까요?`,
                confirmText: '삭제',
                destructive: true,
                onConfirm: () => deleteMut.mutate(p.id),
              })
            }
          />
        ))}

        {/* 현재 구조 저장 — 이름 입력 후 저장(useSaveBlindPreset: 서비스 경유 zod+xss 검증) */}
        <View className="gap-2 px-4 pb-6 pt-4">
          <Text className="text-xs text-secondary-500 dark:text-secondary-400">
            현재 편집 중인 구조를 프리셋으로 저장
          </Text>
          <View className="flex-row items-center gap-2">
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="프리셋 이름"
              maxLength={40}
              accessibilityLabel="프리셋 이름"
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-content-primary dark:border-gray-700 dark:text-off-white"
            />
            <Pressable
              onPress={onSavePress}
              disabled={!canSave}
              accessibilityRole="button"
              className={`min-h-[44px] items-center justify-center rounded-md px-4 ${
                canSave ? 'bg-primary-600 active:opacity-70' : 'bg-gray-300 dark:bg-gray-700'
              }`}
            >
              <Text className="font-sans-semibold text-sm text-white">
                {saveMut.isPending ? '저장 중…' : '저장'}
              </Text>
            </Pressable>
          </View>
          {currentLevels.length === 0 && (
            <Text className="text-xs text-secondary-500 dark:text-secondary-400">
              저장할 레벨이 없습니다.
            </Text>
          )}
        </View>
      </View>
    </SheetModal>
  );
}

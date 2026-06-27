/**
 * ops 1c — 단일 블라인드 레벨 입력 폼(추가/편집). AddTableForm 패턴.
 * 분 단위 입력 → 초 변환(durationSec). is_break 토글 시 sb/bb/ante 비활성(0 고정).
 */
import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import type { OpsBlindLevelInput } from '@/schemas/opsBlindLevel.schema';

interface BlindLevelFormProps {
  /** 편집 대상(없으면 추가 모드). */
  initial?: OpsBlindLevelInput;
  isPending?: boolean;
  onSubmit: (input: OpsBlindLevelInput) => void;
  onCancel: () => void;
}

const toIntOrZero = (v: string): number => {
  const n = parseInt(v.replace(/[^0-9]/g, ''), 10);
  return Number.isInteger(n) ? n : 0;
};

export function BlindLevelForm({
  initial,
  isPending = false,
  onSubmit,
  onCancel,
}: BlindLevelFormProps) {
  const [level, setLevel] = useState(initial ? String(initial.level) : '');
  const [smallBlind, setSmallBlind] = useState(initial ? String(initial.smallBlind) : '');
  const [bigBlind, setBigBlind] = useState(initial ? String(initial.bigBlind) : '');
  const [ante, setAnte] = useState(initial ? String(initial.ante) : '0');
  const [durationMin, setDurationMin] = useState(
    initial ? String(Math.round(initial.durationSec / 60)) : '20'
  );
  const [isBreak, setIsBreak] = useState(initial?.isBreak ?? false);

  const minNum = parseInt(durationMin.replace(/[^0-9]/g, ''), 10);
  const durationValid = Number.isInteger(minNum) && minNum >= 1;

  const submit = () => {
    if (!durationValid || isPending) return;
    onSubmit({
      level: toIntOrZero(level),
      smallBlind: isBreak ? 0 : toIntOrZero(smallBlind),
      bigBlind: isBreak ? 0 : toIntOrZero(bigBlind),
      ante: isBreak ? 0 : toIntOrZero(ante),
      durationSec: minNum * 60,
      isBreak,
    });
  };

  const numericFieldClass =
    'mb-2 flex-1 rounded-md border border-gray-300 px-3 py-2 text-content-primary dark:border-gray-700 dark:text-off-white';
  const disabledFieldClass = `${numericFieldClass} opacity-40`;

  return (
    <View className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900">
      {/* 브레이크 토글 */}
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-content-primary dark:text-off-white">휴식(브레이크) 레벨</Text>
        <Pressable
          onPress={() => setIsBreak((b) => !b)}
          accessibilityRole="switch"
          accessibilityState={{ checked: isBreak }}
          className={`min-h-[44px] items-center justify-center rounded-md px-4 active:opacity-70 ${
            isBreak ? 'bg-primary-600' : 'bg-gray-100 dark:bg-gray-800'
          }`}
        >
          <Text
            className={`text-sm font-sans-semibold ${
              isBreak ? 'text-white' : 'text-content-primary'
            }`}
          >
            {isBreak ? '휴식' : '일반'}
          </Text>
        </Pressable>
      </View>

      <View className="flex-row gap-2">
        <TextInput
          value={level}
          onChangeText={setLevel}
          placeholder="레벨 번호"
          placeholderTextColor="#9CA3AF"
          keyboardType="number-pad"
          maxLength={3}
          className={numericFieldClass}
        />
        <TextInput
          value={durationMin}
          onChangeText={setDurationMin}
          placeholder="시간(분)"
          placeholderTextColor="#9CA3AF"
          keyboardType="number-pad"
          maxLength={3}
          className={numericFieldClass}
        />
      </View>

      <View className="flex-row gap-2">
        <TextInput
          value={isBreak ? '' : smallBlind}
          onChangeText={setSmallBlind}
          editable={!isBreak}
          placeholder="SB"
          placeholderTextColor="#9CA3AF"
          keyboardType="number-pad"
          maxLength={9}
          className={isBreak ? disabledFieldClass : numericFieldClass}
        />
        <TextInput
          value={isBreak ? '' : bigBlind}
          onChangeText={setBigBlind}
          editable={!isBreak}
          placeholder="BB"
          placeholderTextColor="#9CA3AF"
          keyboardType="number-pad"
          maxLength={9}
          className={isBreak ? disabledFieldClass : numericFieldClass}
        />
        <TextInput
          value={isBreak ? '' : ante}
          onChangeText={setAnte}
          editable={!isBreak}
          placeholder="앤티"
          placeholderTextColor="#9CA3AF"
          keyboardType="number-pad"
          maxLength={9}
          className={isBreak ? disabledFieldClass : numericFieldClass}
        />
      </View>

      {!durationValid && durationMin.trim().length > 0 && (
        <Text className="mb-2 text-xs text-error-600 dark:text-error-400">
          시간(분)은 1 이상이어야 합니다.
        </Text>
      )}

      <View className="mt-1 flex-row gap-2">
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          className="min-h-[44px] flex-1 items-center justify-center rounded-md bg-gray-100 active:opacity-70 dark:bg-gray-800"
        >
          <Text className="font-sans-semibold text-content-primary dark:text-off-white">취소</Text>
        </Pressable>
        <Pressable
          onPress={submit}
          disabled={!durationValid || isPending}
          accessibilityRole="button"
          className={`min-h-[44px] flex-1 items-center justify-center rounded-md ${
            durationValid && !isPending
              ? 'bg-primary-600 active:opacity-70'
              : 'bg-gray-300 dark:bg-gray-700'
          }`}
        >
          <Text className="font-sans-semibold text-white">
            {initial ? '레벨 수정' : '레벨 추가'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default BlindLevelForm;

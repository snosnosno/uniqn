/**
 * ConditionsSheet — 조건 시트 (주문서 조건·선택)
 *
 * @description 복장·경력을 프리셋 칩(다중 선택, checkbox 시맨틱) + 항상 노출되는 직접 입력으로
 * 구성한다(2026-07-22 — 구 라디오 단일 선택 + 직접입력 배타 모드 폐기). 확정 값은 선택 프리셋과
 * 커스텀 입력을 ', ' 조인한 **단일 문자열**로 기존 필드(dressCode·experience)에 그대로 실어
 * DB/문서 스키마 변경이 없다. 복원은 ', ' 분해 후 프리셋 매칭, 나머지는 커스텀으로 되돌린다.
 * 프리셋 상수(DRESS_CODE_PRESETS·EXPERIENCE_PRESETS)는 e2e가 문구를 참조할 수 있게 export한다.
 * 확정 값은 부모(OrderSheetScreen)로 흘려보내고 부모가 form.setValue(shouldValidate)로
 * zod safeText(XSS·max50) 경계를 태운다. 단일 SheetModal.
 */
import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { Button } from '@/components/ui/Button';
import { useThemeStore } from '@/stores/themeStore';
import { SECONDARY_PALETTE } from '@/constants/colors';
import type { OrderSheetValues } from '@/schemas/orderSheet.schema';

type Conditions = OrderSheetValues['conditions'];

export const DRESS_CODE_PRESETS = ['검정셔츠/슬랙스', '흰셔츠/슬랙스'] as const;
export const EXPERIENCE_PRESETS = ['TDA 숙지자', '6개월 이상'] as const;

/** zod safeText(50) 상한 — 조인 결과가 넘지 않게 커스텀 입력 길이를 동적으로 죈다 */
const MAX_JOINED_LENGTH = 50;
const SEPARATOR = ', ';

/** 저장된 단일 문자열 → 프리셋 선택 + 커스텀 복원. 프리셋 미매칭 조각은 커스텀으로 재조인. */
function splitStored(value: string | undefined, presets: readonly string[]) {
  const parts = value ? value.split(SEPARATOR) : [];
  return {
    selected: presets.filter((p) => parts.includes(p)),
    custom: parts.filter((p) => !presets.includes(p)).join(SEPARATOR),
  };
}

/** 선택 프리셋(프리셋 순서) + trim 커스텀 → 단일 문자열. 전부 비면 undefined(미설정). */
function joinStored(selected: string[], custom: string): string | undefined {
  const trimmed = custom.trim();
  const all = [...selected, ...(trimmed.length > 0 ? [trimmed] : [])];
  return all.length > 0 ? all.join(SEPARATOR) : undefined;
}

/**
 * 현재 선택 프리셋을 뺀 커스텀 입력 허용 길이.
 *
 * TextInput maxLength 는 **신규 타이핑만** 막고 기존 값은 소급 절단하지 않는다 —
 * 커스텀을 상한까지 채운 뒤 프리셋을 켜면 조인 결과가 safeText(50)을 넘어 제출이
 * 거부됐다(리뷰 MEDIUM, 2026-07-22). 그래서 프리셋 토글 시점에도 같은 상한으로 클램프한다.
 */
function customLimit(selected: string[]): number {
  const selectedLength =
    selected.length > 0 ? selected.join(SEPARATOR).length + SEPARATOR.length : 0;
  return Math.max(0, MAX_JOINED_LENGTH - selectedLength);
}

interface PresetPickerProps {
  label: string;
  presets: readonly string[];
  selected: string[];
  custom: string;
  onToggle: (preset: string) => void;
  onChangeCustom: (text: string) => void;
}

function PresetPicker({
  label,
  presets,
  selected,
  custom,
  onToggle,
  onChangeCustom,
}: PresetPickerProps) {
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const placeholderColor = isDarkMode ? SECONDARY_PALETTE[500] : SECONDARY_PALETTE[400];
  // 조인 상한 방어 — 이미 선택된 프리셋 길이만큼 커스텀 허용 길이를 줄인다(구분자 포함)
  const customMaxLength = customLimit(selected);

  return (
    <View className="mb-4">
      <Text className="text-xs font-sans-bold text-content-secondary mb-2">{label}</Text>
      <View className="flex-row flex-wrap gap-2">
        {presets.map((p) => {
          const checked = selected.includes(p);
          return (
            <Pressable
              key={p}
              onPress={() => onToggle(p)}
              testID={`order-sheet-condition-${label}-${p}`}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              accessibilityLabel={p}
              className={`px-3.5 py-2 min-h-[44px] justify-center rounded-full border ${
                checked
                  ? 'border-primary-500 bg-primary-100 dark:bg-primary-900/30'
                  : 'border-secondary-200 dark:border-surface-overlay'
              } active:opacity-80`}
            >
              <Text
                className={`text-sm font-sans-medium ${
                  checked ? 'text-primary-600 dark:text-primary-400' : 'text-content-secondary'
                }`}
              >
                {p}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <TextInput
        value={custom}
        onChangeText={onChangeCustom}
        maxLength={customMaxLength}
        placeholder="직접 입력 (선택한 항목과 함께 저장)"
        placeholderTextColor={placeholderColor}
        accessibilityLabel={`${label} 직접 입력`}
        testID={`order-sheet-condition-${label}-custom`}
        className="mt-2 rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3 text-content-primary font-sans"
      />
    </View>
  );
}

export interface ConditionsSheetProps {
  visible: boolean;
  value: Conditions;
  onConfirm: (next: Conditions) => void;
  onClose: () => void;
}

export function ConditionsSheet({ visible, value, onConfirm, onClose }: ConditionsSheetProps) {
  const [dress, setDress] = useState(() => splitStored(value.dressCode, DRESS_CODE_PRESETS));
  const [exp, setExp] = useState(() => splitStored(value.experience, EXPERIENCE_PRESETS));

  /**
   * 프리셋 순서를 보존하며 토글 — 표시·저장 순서가 칩 순서와 일치한다.
   * 켤 때 줄어든 상한으로 커스텀을 즉시 클램프해 조인 결과가 safeText(50)을 넘지 않게 한다
   * (해제해도 절단분은 복구하지 않는다 — 사용자가 지운 것과 구분 불가하므로).
   */
  const toggleIn = (
    presets: readonly string[],
    prev: { selected: string[]; custom: string },
    preset: string
  ) => {
    const selected = prev.selected.includes(preset)
      ? prev.selected.filter((p) => p !== preset)
      : presets.filter((p) => prev.selected.includes(p) || p === preset);
    return { selected, custom: prev.custom.slice(0, customLimit(selected)) };
  };

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      title="조건 (선택)"
      footer={
        <Button
          onPress={() => {
            onConfirm({
              dressCode: joinStored(dress.selected, dress.custom),
              experience: joinStored(exp.selected, exp.custom),
            });
            onClose();
          }}
        >
          확인
        </Button>
      }
    >
      <View className="px-4 pt-3 pb-2">
        <PresetPicker
          label="복장"
          presets={DRESS_CODE_PRESETS}
          selected={dress.selected}
          custom={dress.custom}
          onToggle={(p) => setDress((prev) => toggleIn(DRESS_CODE_PRESETS, prev, p))}
          onChangeCustom={(custom) => setDress((prev) => ({ ...prev, custom }))}
        />
        <PresetPicker
          label="경력"
          presets={EXPERIENCE_PRESETS}
          selected={exp.selected}
          custom={exp.custom}
          onToggle={(p) => setExp((prev) => toggleIn(EXPERIENCE_PRESETS, prev, p))}
          onChangeCustom={(custom) => setExp((prev) => ({ ...prev, custom }))}
        />
      </View>
    </SheetModal>
  );
}

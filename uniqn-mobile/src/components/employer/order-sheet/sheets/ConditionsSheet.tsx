/**
 * ConditionsSheet — 조건 시트 (주문서 조건·선택)
 *
 * @description 복장·경력을 프리셋 칩 + 직접 입력으로 선택한다. 프리셋 상수(DRESS_CODE_PRESETS·
 * EXPERIENCE_PRESETS)는 e2e가 문구를 참조할 수 있게 export한다. 확정 값은 부모(OrderSheetScreen)로
 * 흘려보내고 부모가 form.setValue(shouldValidate)로 zod safeText(XSS·max50) 경계를 태운다. 단일 SheetModal.
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

interface PresetPickerProps {
  label: string;
  presets: readonly string[];
  value: string | undefined;
  onChange: (v: string | undefined) => void;
}

function PresetPicker({ label, presets, value, onChange }: PresetPickerProps) {
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const placeholderColor = isDarkMode ? SECONDARY_PALETTE[500] : SECONDARY_PALETTE[400];
  const isCustom = value !== undefined && !presets.includes(value);
  const [customMode, setCustomMode] = useState(isCustom);

  return (
    <View className="mb-4">
      <Text className="text-xs font-sans-bold text-content-secondary mb-2">{label}</Text>
      <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
        {presets.map((p) => {
          const selected = value === p;
          return (
            <Pressable
              key={p}
              onPress={() => {
                setCustomMode(false);
                onChange(selected ? undefined : p);
              }}
              testID={`order-sheet-condition-${label}-${p}`}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={p}
              className={`px-3.5 py-2 min-h-[44px] justify-center rounded-full border ${
                selected
                  ? 'border-primary-500 bg-primary-100 dark:bg-primary-900/30'
                  : 'border-secondary-200 dark:border-surface-overlay'
              } active:opacity-80`}
            >
              <Text
                className={`text-sm font-sans-medium ${
                  selected ? 'text-primary-600 dark:text-primary-400' : 'text-content-secondary'
                }`}
              >
                {p}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => {
            setCustomMode(true);
            onChange(undefined);
          }}
          accessibilityRole="radio"
          accessibilityState={{ selected: customMode }}
          accessibilityLabel={`${label} 직접 입력`}
          className={`px-3.5 py-2 min-h-[44px] justify-center rounded-full border ${
            customMode
              ? 'border-primary-500 bg-primary-100 dark:bg-primary-900/30'
              : 'border-secondary-200 dark:border-surface-overlay'
          } active:opacity-80`}
        >
          <Text
            className={`text-sm font-sans-medium ${
              customMode ? 'text-primary-600 dark:text-primary-400' : 'text-content-secondary'
            }`}
          >
            직접 입력
          </Text>
        </Pressable>
      </View>
      {customMode && (
        <TextInput
          value={isCustom ? value : ''}
          onChangeText={(t) => onChange(t.length > 0 ? t : undefined)}
          maxLength={50}
          placeholder={`${label} 직접 입력`}
          placeholderTextColor={placeholderColor}
          testID={`order-sheet-condition-${label}-custom`}
          className="mt-2 rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3 text-content-primary font-sans"
        />
      )}
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
  const [conditions, setConditions] = useState<Conditions>(value);

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      title="조건 (선택)"
      footer={
        <Button
          onPress={() => {
            // 커스텀 직접 입력의 앞뒤 공백을 정규화하고 공백만 입력은 미설정으로 떨군다.
            // (프리셋 값은 trim 무해) — 부모 zod safeText 는 trim 을 하지 않으므로 여기가 권위 지점.
            const norm = (s: string | undefined) => {
              const t = s?.trim();
              return t && t.length > 0 ? t : undefined;
            };
            onConfirm({
              dressCode: norm(conditions.dressCode),
              experience: norm(conditions.experience),
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
          value={conditions.dressCode}
          onChange={(dressCode) => setConditions((c) => ({ ...c, dressCode }))}
        />
        <PresetPicker
          label="경력"
          presets={EXPERIENCE_PRESETS}
          value={conditions.experience}
          onChange={(experience) => setConditions((c) => ({ ...c, experience }))}
        />
      </View>
    </SheetModal>
  );
}

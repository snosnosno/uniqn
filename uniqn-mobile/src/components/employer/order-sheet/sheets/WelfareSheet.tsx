/**
 * WelfareSheet — 복지 시트 (주문서 급여·선택)
 *
 * @description 식사·교통·숙소 3종은 기존 Allowances 시맨틱(-1=제공 체크 / 양수=금액), 보장시간은
 * 시간값(0 이상 숫자)으로 분리한다. 확정 값은 부모(OrderSheetScreen)로 흘려보내고 부모가
 * form.setValue(shouldValidate)로 zod orderSheetAllowancesSchema 경계를 태운다. 단일 SheetModal.
 *
 * ⚠️ 리뷰 CRITICAL: guaranteedHours에 PROVIDED_FLAG(-1)를 쓰면 문서 게이트 min(0)이 reject해
 * 등록 자체가 죽는다 → 키별 분기 필수. '0' 입력이 제공(-1)으로 둔갑하는 시맨틱 플립도 금지.
 */
import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { Button } from '@/components/ui/Button';
import { useThemeStore } from '@/stores/themeStore';
import { SECONDARY_PALETTE } from '@/constants/colors';
import { PROVIDED_FLAG } from '@/utils/settlement';
import type { OrderSheetValues } from '@/schemas/orderSheet.schema';

type Welfare = OrderSheetValues['allowances'];
type WelfareKey = keyof Welfare;

const ITEMS = [
  { key: 'meal', label: '식사' },
  { key: 'transportation', label: '교통' },
  { key: 'guaranteedHours', label: '보장시간' },
  { key: 'accommodation', label: '숙소' },
] as const;

const DEFAULT_GUARANTEED_HOURS = 4;

export interface WelfareSheetProps {
  visible: boolean;
  value: Welfare;
  onConfirm: (next: Welfare) => void;
  onClose: () => void;
}

export function WelfareSheet({ visible, value, onConfirm, onClose }: WelfareSheetProps) {
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const placeholderColor = isDarkMode ? SECONDARY_PALETTE[500] : SECONDARY_PALETTE[400];
  const [welfare, setWelfare] = useState<Welfare>(value);

  const toggle = (key: WelfareKey) =>
    setWelfare((prev) => {
      const next = { ...prev };
      if (next[key] !== undefined) delete next[key];
      // 보장시간은 시간값(기본 4시간), 그 외 3종은 금액 없는 '제공' 체크(PROVIDED_FLAG)
      else next[key] = key === 'guaranteedHours' ? DEFAULT_GUARANTEED_HOURS : PROVIDED_FLAG;
      return next;
    });

  const setAmount = (key: WelfareKey, text: string) =>
    setWelfare((prev) => {
      const parsed = Number.parseInt(text.replace(/[^0-9]/g, ''), 10);
      if (key === 'guaranteedHours') {
        // 시간값: 빈/무효 입력은 기본 4시간, 0 입력은 체크 해제와 동일(키 삭제)
        if (Number.isNaN(parsed)) return { ...prev, guaranteedHours: DEFAULT_GUARANTEED_HOURS };
        if (parsed <= 0) {
          const next = { ...prev };
          delete next.guaranteedHours;
          return next;
        }
        return { ...prev, guaranteedHours: parsed };
      }
      // 금액 3종: 빈/0 입력 = 금액 없는 '제공' 체크(PROVIDED_FLAG)
      return { ...prev, [key]: Number.isNaN(parsed) || parsed <= 0 ? PROVIDED_FLAG : parsed };
    });

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      title="복지 (선택)"
      footer={
        <Button
          onPress={() => {
            onConfirm(welfare);
            onClose();
          }}
        >
          확인
        </Button>
      }
    >
      <View className="px-4 pt-3 pb-2 gap-2">
        {ITEMS.map(({ key, label }) => {
          const v = welfare[key];
          const checked = v !== undefined;
          return (
            <View
              key={key}
              className={`flex-row items-center gap-3 rounded-xl border px-4 py-3 ${
                checked
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                  : 'border-secondary-200 dark:border-surface-overlay bg-surface-card'
              }`}
            >
              <Pressable
                onPress={() => toggle(key)}
                className="flex-row items-center gap-3 flex-1 min-h-[44px] active:opacity-80"
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                accessibilityLabel={label}
                testID={`order-sheet-welfare-${key}`}
              >
                <View
                  className={`w-5 h-5 rounded-md border ${
                    checked
                      ? 'bg-primary-500 border-primary-500'
                      : 'border-secondary-300 dark:border-surface-overlay'
                  }`}
                />
                <Text className="text-sm font-sans-medium text-content-primary">{label}</Text>
              </Pressable>
              {checked && (
                <TextInput
                  value={v !== undefined && v !== PROVIDED_FLAG ? String(v) : ''}
                  onChangeText={(t) => setAmount(key, t)}
                  keyboardType="number-pad"
                  placeholder={key === 'guaranteedHours' ? '시간' : '금액(선택)'}
                  placeholderTextColor={placeholderColor}
                  testID={`order-sheet-welfare-${key}-input`}
                  className="w-24 rounded-lg border border-secondary-200 dark:border-surface-overlay px-2 py-1.5 text-right text-sm text-content-primary font-sans"
                />
              )}
            </View>
          );
        })}
      </View>
    </SheetModal>
  );
}

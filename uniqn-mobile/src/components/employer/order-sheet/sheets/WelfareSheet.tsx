/**
 * WelfareSheet — 복지 시트 (주문서 급여·선택)
 *
 * @description 식사·교통·숙소 3종은 기존 Allowances 시맨틱(-1=제공 체크 / 양수=금액), 보장시간은
 * 시간값(양수)으로 분리한다. 보장시간은 **기본값이 없다** — 체크 여부(boolean)와 입력 문자열을
 * 분리 보관하고 확인 시점에만 숫자로 확정한다(구 구현은 빈 입력을 즉시 기본 4로 복원해
 * 지우고 6·8을 입력하는 것 자체가 불가했다, 2026-07-22). 미입력/0은 미설정으로 확정.
 * 확정 값은 부모(OrderSheetScreen)로 흘려보내고 부모가 form.setValue(shouldValidate)로
 * zod orderSheetAllowancesSchema 경계를 태운다. 단일 SheetModal.
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

/**
 * 금액·현물 복지 3종. 보장시간은 **여기 없다** — 금액 축이 아니라 근무 조건 축이라
 * 아래에서 구분선으로 분리해 렌더한다(SETTLE-2). 섞어 두면 사장·스태프 양쪽이
 * 보장시간을 지급 금액으로 읽는다.
 */
const ITEMS = [
  { key: 'meal', label: '식사' },
  { key: 'transportation', label: '교통' },
  { key: 'accommodation', label: '숙소' },
] as const;

const GUARANTEED_HOURS_KEY = 'guaranteedHours' as const;

/** 보장시간 축 분리 — welfare 상태는 금액 3종만 들고 간다 */
const stripGuaranteedHours = ({ guaranteedHours: _gh, ...rest }: Welfare): Welfare => rest;

export interface WelfareSheetProps {
  visible: boolean;
  value: Welfare;
  onConfirm: (next: Welfare) => void;
  onClose: () => void;
}

export function WelfareSheet({ visible, value, onConfirm, onClose }: WelfareSheetProps) {
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const placeholderColor = isDarkMode ? SECONDARY_PALETTE[500] : SECONDARY_PALETTE[400];
  const [welfare, setWelfare] = useState<Welfare>(() => stripGuaranteedHours(value));
  // 보장시간 — 체크와 입력 문자열을 분리 보관, 확정은 확인 버튼에서만 (기본값 없음)
  const [ghChecked, setGhChecked] = useState(value.guaranteedHours !== undefined);
  const [ghText, setGhText] = useState(
    value.guaranteedHours !== undefined ? String(value.guaranteedHours) : ''
  );

  const toggle = (key: WelfareKey) => {
    if (key === 'guaranteedHours') {
      setGhChecked((prev) => !prev);
      return;
    }
    setWelfare((prev) => {
      const next = { ...prev };
      if (next[key] !== undefined) delete next[key];
      // 금액 3종은 금액 없는 '제공' 체크(PROVIDED_FLAG)
      else next[key] = PROVIDED_FLAG;
      return next;
    });
  };

  const setAmount = (key: WelfareKey, text: string) => {
    const digits = text.replace(/[^0-9]/g, '');
    if (key === 'guaranteedHours') {
      // 입력 중에는 문자열 그대로 유지(빈 값 허용) — 기본값 복원 금지
      setGhText(digits);
      return;
    }
    const parsed = Number.parseInt(digits, 10);
    // 금액 3종: 빈/0 입력 = 금액 없는 '제공' 체크(PROVIDED_FLAG)
    setWelfare((prev) => ({
      ...prev,
      [key]: Number.isNaN(parsed) || parsed <= 0 ? PROVIDED_FLAG : parsed,
    }));
  };

  const confirm = () => {
    const parsed = Number.parseInt(ghText, 10);
    const withHours = ghChecked && Number.isFinite(parsed) && parsed > 0;
    onConfirm(withHours ? { ...welfare, guaranteedHours: parsed } : welfare);
    onClose();
  };

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      title="복지 (선택)"
      footer={<Button onPress={confirm}>확인</Button>}
    >
      <View className="px-4 pt-3 pb-2 gap-2">
        {ITEMS.map(({ key, label }) => {
          const v = welfare[key];
          const checked = v !== undefined;
          const inputValue = v !== undefined && v !== PROVIDED_FLAG ? String(v) : '';
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
                  value={inputValue}
                  onChangeText={(t) => setAmount(key, t)}
                  keyboardType="number-pad"
                  placeholder="금액(선택)"
                  placeholderTextColor={placeholderColor}
                  testID={`order-sheet-welfare-${key}-input`}
                  className="w-24 rounded-lg border border-secondary-200 dark:border-surface-overlay px-2 py-1.5 text-right text-sm text-content-primary dark:text-content-primary font-sans"
                />
              )}
            </View>
          );
        })}

        {/* 근무 조건 축 — 보장시간은 금액이 아니라 근무 조건이라 복지 3종과 구분선으로 분리한다.
            같은 목록에 두면 사장·스태프 양쪽이 지급 금액으로 읽는다(SETTLE-2). */}
        <View className="mt-3 border-t border-secondary-200 pt-3 dark:border-surface-overlay">
          <Text className="mb-2 text-xs text-secondary-500 dark:text-secondary-400 font-sans">
            근무 조건
          </Text>
          <View
            className={`flex-row items-center gap-3 rounded-xl border px-4 py-3 ${
              ghChecked
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                : 'border-secondary-200 dark:border-surface-overlay bg-surface-card'
            }`}
          >
            <Pressable
              onPress={() => toggle(GUARANTEED_HOURS_KEY)}
              className="flex-row items-center gap-3 flex-1 min-h-[44px] active:opacity-80"
              accessibilityRole="checkbox"
              accessibilityState={{ checked: ghChecked }}
              accessibilityLabel="보장시간"
              testID={`order-sheet-welfare-${GUARANTEED_HOURS_KEY}`}
            >
              <View
                className={`w-5 h-5 rounded-md border ${
                  ghChecked
                    ? 'bg-primary-500 border-primary-500'
                    : 'border-secondary-300 dark:border-surface-overlay'
                }`}
              />
              <Text className="text-sm font-sans-medium text-content-primary dark:text-content-primary">
                보장시간
              </Text>
            </Pressable>
            {ghChecked && (
              <TextInput
                value={ghText}
                onChangeText={(t) => setAmount(GUARANTEED_HOURS_KEY, t)}
                keyboardType="number-pad"
                placeholder="시간"
                placeholderTextColor={placeholderColor}
                testID={`order-sheet-welfare-${GUARANTEED_HOURS_KEY}-input`}
                className="w-24 rounded-lg border border-secondary-200 dark:border-surface-overlay px-2 py-1.5 text-right text-sm text-content-primary dark:text-content-primary font-sans"
              />
            )}
          </View>
        </View>
      </View>
    </SheetModal>
  );
}

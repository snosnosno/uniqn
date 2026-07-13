/**
 * ContactSheet — 연락처 시트 (주문서 기본정보)
 *
 * @description 라디오 2개(내 프로필 번호 / 직접 입력). 프로필 번호는 부모(create.tsx)가 profile.phone
 * 으로 전달 — 없으면 직접 입력 모드로 고정. onConfirm 은 확정 번호를 부모로 흘려보내고,
 * 부모가 form.setValue(shouldValidate) 로 zod safeText(XSS·max20) 경계를 태운다. 단일 SheetModal 렌더.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { SheetModal } from '@/components/ui/SheetModal';
import { Button } from '@/components/ui/Button';
import { useThemeStore } from '@/stores/themeStore';
import { SECONDARY_PALETTE } from '@/constants/colors';

export interface ContactSheetProps {
  visible: boolean;
  value: string;
  /** 부모가 전달하는 프로필 번호(profile.phone) — 빈 문자열이면 직접 입력만 노출 */
  myPhone: string;
  onConfirm: (next: string) => void;
  onClose: () => void;
}

type ContactMode = 'profile' | 'custom';

/** 라디오 도트 — 선택 시 primary 채움, 비선택 시 아웃라인 */
function RadioDot({ selected }: { selected: boolean }) {
  return (
    <View
      className={`w-5 h-5 rounded-full border items-center justify-center ${
        selected ? 'border-primary-500' : 'border-secondary-300 dark:border-surface-overlay'
      }`}
    >
      {selected ? <View className="w-2.5 h-2.5 rounded-full bg-primary-500" /> : null}
    </View>
  );
}

export function ContactSheet({ visible, value, myPhone, onConfirm, onClose }: ContactSheetProps) {
  const isDarkMode = useThemeStore((s) => s.isDarkMode);
  const hasProfilePhone = myPhone.trim().length > 0;
  const [mode, setMode] = useState<ContactMode>(hasProfilePhone ? 'profile' : 'custom');
  const [customPhone, setCustomPhone] = useState('');

  // 재오픈 시 현재 값 기준 동기화: 프로필 번호와 같으면 프로필 라디오, 그 외 값이 있으면 직접 입력
  useEffect(() => {
    if (!visible) return;
    if (hasProfilePhone && value === myPhone.trim()) {
      setMode('profile');
      setCustomPhone('');
    } else if (value) {
      setMode('custom');
      setCustomPhone(value);
    } else {
      setMode(hasProfilePhone ? 'profile' : 'custom');
      setCustomPhone('');
    }
  }, [visible, value, myPhone, hasProfilePhone]);

  const resolved = mode === 'profile' ? myPhone.trim() : customPhone.trim();

  return (
    <SheetModal
      visible={visible}
      onClose={onClose}
      title="연락처"
      footer={
        <Button
          onPress={() => {
            onConfirm(resolved);
            onClose();
          }}
          disabled={resolved.length === 0}
        >
          확인
        </Button>
      }
    >
      <View className="gap-2">
        {hasProfilePhone && (
          <Pressable
            onPress={() => setMode('profile')}
            className={`flex-row items-center gap-3 rounded-xl border px-4 py-3 min-h-[44px] ${
              mode === 'profile'
                ? 'border-primary-500 bg-primary-100 dark:bg-primary-900/30'
                : 'border-secondary-200 dark:border-surface-overlay'
            } active:opacity-80`}
            accessibilityRole="radio"
            accessibilityState={{ selected: mode === 'profile' }}
            accessibilityLabel={`내 프로필 번호 ${myPhone.trim()}`}
          >
            <RadioDot selected={mode === 'profile'} />
            <View>
              <Text className="text-sm font-sans-medium text-content-primary">내 프로필 번호</Text>
              <Text className="text-xs text-content-muted font-sans">{myPhone.trim()}</Text>
            </View>
          </Pressable>
        )}

        {hasProfilePhone && (
          <Pressable
            onPress={() => setMode('custom')}
            className={`flex-row items-center gap-3 rounded-xl border px-4 py-3 min-h-[44px] ${
              mode === 'custom'
                ? 'border-primary-500 bg-primary-100 dark:bg-primary-900/30'
                : 'border-secondary-200 dark:border-surface-overlay'
            } active:opacity-80`}
            accessibilityRole="radio"
            accessibilityState={{ selected: mode === 'custom' }}
            accessibilityLabel="직접 입력"
          >
            <RadioDot selected={mode === 'custom'} />
            <Text className="text-sm font-sans-medium text-content-primary">직접 입력</Text>
          </Pressable>
        )}

        {mode === 'custom' && (
          <TextInput
            value={customPhone}
            onChangeText={setCustomPhone}
            maxLength={20}
            keyboardType="phone-pad"
            placeholder="연락처 (예: 010-1234-5678)"
            placeholderTextColor={isDarkMode ? SECONDARY_PALETTE[500] : SECONDARY_PALETTE[400]}
            testID="order-sheet-contact-input"
            className="rounded-xl border border-secondary-200 dark:border-surface-overlay bg-surface-card px-4 py-3 text-content-primary font-sans"
          />
        )}
      </View>
    </SheetModal>
  );
}

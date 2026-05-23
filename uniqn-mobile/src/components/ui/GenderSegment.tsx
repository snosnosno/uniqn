/**
 * UNIQN Mobile - 성별 세그먼티드 컨트롤
 *
 * @description 남성/여성 가로 2칸 선택 UI. PortOne 본인인증에서 gender 가 누락된 사용자가
 *              profile-setup 또는 settings/profile 화면에서 set-once 보완 입력에 사용.
 *
 * @principles impeccable-design.md
 *   - Rule 5: 터치 타깃 44px (min-h-[44px])
 *   - Rule 14: 이모지 사용 금지 — 텍스트 + 골드 active 로 위계 표현
 *   - Rule 21: Pressed 피드백은 라이트 어두워짐 / 다크 밝아짐 (NativeWind `active:` prefix)
 *   - Rule 22: Focus ring Info 블루 #2563EB 2px (focused state 별도 관리)
 */

import React, { useCallback, useState } from 'react';
import { AccessibilityInfo, Pressable, Text, View } from 'react-native';
import type { PressableProps } from 'react-native';

export type GenderValue = 'male' | 'female';

interface GenderSegmentProps {
  value: GenderValue | null | undefined;
  onChange: (next: GenderValue) => void;
  /** disabled = true 면 시각적으로 비활성 + 터치 차단 */
  disabled?: boolean;
  /** 스크린리더 announce 활성화 (필수 입력 안내용) */
  ariaLabel?: string;
  /** 스크린리더 보조 설명 — set-once 안내 등 */
  ariaHint?: string;
  /** 에러 상태 표시 */
  hasError?: boolean;
}

interface SegmentItemProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled: boolean;
  hasError: boolean;
}

const FOCUS_BORDER = '#2563EB';

function SegmentItem({ label, selected, onPress, disabled, hasError }: SegmentItemProps) {
  const [focused, setFocused] = useState(false);

  const handlePress = useCallback(() => {
    if (disabled) return;
    onPress();
    AccessibilityInfo.announceForAccessibility(`${label} 선택됨`);
  }, [disabled, label, onPress]);

  const handleFocus = useCallback<NonNullable<PressableProps['onFocus']>>(
    () => setFocused(true),
    []
  );
  const handleBlur = useCallback<NonNullable<PressableProps['onBlur']>>(
    () => setFocused(false),
    []
  );

  const baseClass = [
    'flex-1 items-center justify-center min-h-[44px] rounded-md border-2',
    selected
      ? 'bg-primary-500 border-primary-500'
      : hasError
        ? 'bg-surface-page dark:bg-surface border-error-500'
        : 'bg-surface-page dark:bg-surface border-divider dark:border-surface-overlay',
    !selected && !disabled ? 'active:bg-secondary-100 dark:active:bg-surface-hover' : '',
    disabled ? 'opacity-50' : '',
  ]
    .filter(Boolean)
    .join(' ');

  // Focus ring 은 NativeWind className 정적 추출 한계로 inline style 로 적용 (impeccable §22).
  const focusStyle = focused && !disabled ? { borderColor: FOCUS_BORDER } : null;

  return (
    <Pressable
      onPress={handlePress}
      onFocus={handleFocus}
      onBlur={handleBlur}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={label}
      className={baseClass}
      style={focusStyle}
    >
      <Text
        className={`font-sans-medium text-base ${
          selected ? 'text-content-onGold' : 'text-content-primary'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function GenderSegment({
  value,
  onChange,
  disabled = false,
  ariaLabel,
  ariaHint,
  hasError = false,
}: GenderSegmentProps) {
  const handleSelectMale = useCallback(() => onChange('male'), [onChange]);
  const handleSelectFemale = useCallback(() => onChange('female'), [onChange]);

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={ariaLabel ?? '성별 선택'}
      accessibilityHint={ariaHint}
      className="flex-row gap-3"
    >
      <SegmentItem
        label="남성"
        selected={value === 'male'}
        onPress={handleSelectMale}
        disabled={disabled}
        hasError={hasError}
      />
      <SegmentItem
        label="여성"
        selected={value === 'female'}
        onPress={handleSelectFemale}
        disabled={disabled}
        hasError={hasError}
      />
    </View>
  );
}

export default GenderSegment;

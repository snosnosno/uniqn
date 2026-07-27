/**
 * SlotTimeField — 배치 시간 입력(추가·편집 시트) 공용 시간 트리거 필드 + 변환 헬퍼.
 *
 * EditSlotSheet(B2)에서 정의하던 트리거 필드/변환 헬퍼를 추출해 AddSlotSheet(B1)과 공유한다.
 * 트리거 필드는 탭 시 상위가 TimeWheelPicker(embedded 오버레이)를 여는 Pressable 이다.
 * 이 화면들은 0~23 표기만 사용(다음날 24+ 미표기) — 익일 판정은 deriveOvernightPreview 가 담당.
 */
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { SECONDARY_PALETTE } from '@/constants/colors';
import { ChevronDownIcon } from '@/components/icons';
import type { TimeValue } from '@/components/ui/TimeWheelPicker';

const TIME_RE = /^(\d{1,2}):(\d{2})$/;

/** 'HH:mm' → TimeValue{hour,minute}. 0~23 표기만 사용(범위 밖/오형식은 0시 0분). */
export function timeStringToValue(time: string): TimeValue {
  const match = time.match(TIME_RE);
  if (!match) return { hour: 0, minute: 0 };
  const hour = Math.min(23, Math.max(0, parseInt(match[1], 10)));
  const minute = parseInt(match[2], 10);
  return { hour, minute };
}

/** TimeValue{hour,minute} → 'HH:mm'(0패딩). */
export function timeValueToString({ hour, minute }: TimeValue): string {
  const h = hour.toString().padStart(2, '0');
  const m = minute.toString().padStart(2, '0');
  return `${h}:${m}`;
}

/** 'HH:mm' → '오전/오후 H:mm'(TimePicker formatTimeDisplay 동등 포맷). */
export function formatTimeDisplay(time: string): string {
  const match = time.match(TIME_RE);
  if (!match) return time || '시간 선택';
  const hour = parseInt(match[1], 10);
  const minutes = match[2];
  const period = hour < 12 ? '오전' : '오후';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${period} ${displayHour}:${minutes}`;
}

/** 시간 트리거 필드 — 탭 시 상위가 휠 피커를 연다(TimePicker 트리거 스타일 동등). */
export function TimeTriggerField({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <View>
      <Text className="mb-2 font-sans-medium text-content-primary dark:text-off-white">
        {label}
      </Text>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label} 시간 선택`}
        accessibilityHint="탭하여 시간을 선택하세요"
        className="flex-row items-center px-4 py-3 rounded-lg border-2 bg-surface-card border-secondary-300 dark:border-surface-overlay"
      >
        <Text className="flex-1 text-base text-content-primary font-sans">
          {formatTimeDisplay(value)}
        </Text>
        <ChevronDownIcon size={20} color={SECONDARY_PALETTE[500]} />
      </Pressable>
    </View>
  );
}

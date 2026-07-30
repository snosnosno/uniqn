/**
 * StartTimeField — 근무표 시간 입력 공용 필드(출근 예정 단일 시각 + '미정' 토글).
 *
 * `time_slot` 정본이 **출근 예정 시각 단일값**(§K)이라, 인원 추가 시트(B1)와 근무 수정 시트(B2)가
 * 같은 필드를 쓴다. 종료·익일 개념은 이 모델에 없다 — 퇴근은 실적(check_out_ts)이라
 * 전용 편집기(WorkTimeEditor)가 담당한다.
 *
 * '미정' UX 는 정산 TimeInputField 의 미정 체크박스 패턴을 그리드 톤에 맞춰 로컬로 미러링한다
 * (cross-domain import 지양). 체크 시 피커 비활성 + '미정' 표시.
 * 값이 비어 있으면 formatTimeDisplay 가 '시간 선택'을 반환한다 — 기본값을 실제 값처럼
 * 보여주지 않기 위한 것이므로 프리필을 되살리지 말 것(결정 4 · §J).
 *
 * 트리거 탭 시 상위가 TimeWheelPicker(embedded 오버레이)를 연다.
 */
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { SECONDARY_PALETTE } from '@/constants/colors';
import { CheckIcon, ChevronDownIcon } from '@/components/icons';
import { formatTimeDisplay } from './SlotTimeField';

export interface StartTimeFieldProps {
  /** 필드 라벨 — a11y 라벨도 여기서 파생한다. 기본값 '출근 시간'. */
  label?: string;
  /** 출근 시각('HH:mm') — 비었으면 '시간 선택', 미정일 때는 표시에 사용하지 않는다 */
  value: string;
  /** 미정 여부 — 체크 시 피커 비활성 + '미정' 표시 */
  isUndefined: boolean;
  /** 미정 토글 */
  onToggleUndefined: (next: boolean) => void;
  /** 피커 열기(미정이면 무시) */
  onPress: () => void;
}

export function StartTimeField({
  label = '출근 시간',
  value,
  isUndefined,
  onToggleUndefined,
  onPress,
}: StartTimeFieldProps) {
  return (
    <View>
      {/* 라벨 + 미정 체크박스 */}
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="font-sans-medium text-content-primary dark:text-off-white">{label}</Text>
        <Pressable
          onPress={() => onToggleUndefined(!isUndefined)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isUndefined }}
          accessibilityLabel={`${label} 미정`}
          className="flex-row items-center active:opacity-80"
        >
          <View
            className={`mr-1.5 h-5 w-5 items-center justify-center rounded border ${
              isUndefined
                ? 'border-primary-600 bg-primary-600'
                : 'border-secondary-300 bg-surface-card dark:border-surface-overlay'
            }`}
          >
            {isUndefined ? <CheckIcon size={14} color="#FFFFFF" /> : null}
          </View>
          <Text className="text-sm text-content-secondary font-sans">미정</Text>
        </Pressable>
      </View>

      {/* 시각 트리거(휠 피커 열기) — 미정이면 비활성 + '미정' 표시 */}
      <Pressable
        onPress={() => {
          if (!isUndefined) onPress();
        }}
        disabled={isUndefined}
        accessibilityRole="button"
        accessibilityLabel={`${label} 선택`}
        accessibilityHint={`탭하여 ${label}을 선택하세요`}
        className={`flex-row items-center rounded-lg border-2 px-4 py-3 ${
          isUndefined
            ? 'border-secondary-200 bg-secondary-100 dark:border-surface-overlay dark:bg-surface-dark'
            : 'border-secondary-300 bg-surface-card dark:border-surface-overlay'
        }`}
      >
        <Text
          className={`flex-1 text-base font-sans ${
            isUndefined ? 'text-content-placeholder' : 'text-content-primary'
          }`}
        >
          {isUndefined ? '미정' : formatTimeDisplay(value)}
        </Text>
        {isUndefined ? null : <ChevronDownIcon size={20} color={SECONDARY_PALETTE[500]} />}
      </Pressable>
    </View>
  );
}

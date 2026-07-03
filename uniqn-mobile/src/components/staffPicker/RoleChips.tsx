/**
 * RoleChips — 스태프 역할 선택 칩 그룹
 *
 * STAFF_ROLES 를 순회해 역할 칩을 렌더하는 순수 표현(presentational) 프리미티브.
 * 그리드 인원 추가 시트(AddSlotSheet)와 스태프 직접추가 모달(AddStaffModal)이 공유한다.
 * 각 칩은 accessibilityRole="button" + accessibilityState.selected 를 노출해
 * 스크린리더에서 현재 선택된 역할을 식별할 수 있다.
 *
 * 라벨("역할")과 시간대/커스텀 역할 입력은 호출부에 남긴다(칩 그룹만 담당).
 */
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { STAFF_ROLES } from '@/constants';

export interface RoleChipsProps {
  /** 현재 선택된 역할 key (STAFF_ROLES.key 또는 미선택 시 빈 문자열) */
  value: string;
  /** 칩 선택 시 해당 역할 key 전달 */
  onChange: (key: string) => void;
}

export function RoleChips({ value, onChange }: RoleChipsProps) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {STAFF_ROLES.map((role) => {
        const isActive = value === role.key;
        return (
          <Pressable
            key={role.key}
            onPress={() => onChange(role.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            // pressed 는 opacity 대신 배경톤 반전(임페커블 룰21)
            className={
              isActive
                ? 'flex-row items-center rounded-full border px-3 py-2 active:bg-secondary-100 dark:active:bg-surface-hover border-primary-500 bg-primary-50 dark:bg-surface-elevated'
                : 'flex-row items-center rounded-full border px-3 py-2 active:bg-secondary-100 dark:active:bg-surface-hover border-secondary-200 bg-surface-card dark:border-surface-overlay dark:bg-surface'
            }
          >
            <Text
              className={
                isActive
                  ? 'text-sm font-sans-medium text-primary-700 dark:text-primary-300'
                  : 'text-sm font-sans-medium text-content-secondary'
              }
            >
              {`${role.icon} ${role.name}`}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default RoleChips;

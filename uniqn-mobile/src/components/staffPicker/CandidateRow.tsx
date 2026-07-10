/**
 * CandidateRow — 스태프 후보(풀/전화 검색 결과) 한 줄
 *
 * Avatar + 이름/닉네임/지역 + 선택 표시로 구성된 순수 표현(presentational) 프리미티브.
 * 그리드 인원 추가 시트(AddSlotSheet)와 스태프 직접추가 모달(AddStaffModal)이 공유한다.
 * 선택 상태는 시각 표시("선택됨")와 접근성 상태(accessibilityState.selected)로 함께 노출한다.
 */
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Avatar } from '@/components/ui/Avatar';

export interface CandidateRowProps {
  name: string;
  nickname?: string;
  region?: string;
  photoURL?: string;
  picked: boolean;
  onPress: () => void;
}

export function CandidateRow({
  name,
  nickname,
  region,
  photoURL,
  picked,
  onPress,
}: CandidateRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: picked }}
      // pressed 는 opacity 대신 배경톤 반전(임페커블 룰21 — 다크모드 opacity 는 텍스트 대비 저하)
      className={
        picked
          ? 'flex-row items-center rounded-md border p-3 active:bg-secondary-100 dark:active:bg-surface-hover border-primary-500 bg-primary-50 dark:border-primary-500 dark:bg-surface-elevated'
          : 'flex-row items-center rounded-md border p-3 active:bg-secondary-100 dark:active:bg-surface-hover border-secondary-200 bg-surface-card dark:border-surface-overlay dark:bg-surface'
      }
    >
      <Avatar source={photoURL} name={name} size="md" />
      <View className="ml-3 flex-1">
        <Text className="text-base font-sans-semibold text-content-primary">
          {name}
          {nickname ? (
            <Text className="text-sm text-content-secondary font-sans">{`  ${nickname}`}</Text>
          ) : null}
        </Text>
        {region ? <Text className="text-xs text-content-secondary font-sans">{region}</Text> : null}
      </View>
      {picked ? (
        <Text className="text-sm font-sans-semibold text-primary-600 dark:text-primary-400">
          선택됨
        </Text>
      ) : null}
    </Pressable>
  );
}

export default CandidateRow;

/**
 * UNIQN Mobile - 구인구직 필터바
 *
 * @description 타입 칩 아래의 필터 pill 행. P1은 지역 pill + 초기화.
 * P2(역할)·P3(급여) pill 이 같은 행에 추가될 예정 — 가로 스크롤 확장 전제.
 */

import { memo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ChevronDownIcon, MapPinIcon, XMarkIcon } from '@/components/icons';
import { SECONDARY_PALETTE } from '@/constants/colors';

export interface FilterBarProps {
  /** 지역 pill 라벨 (예: '지역 전체', '강남구 외 2') */
  regionLabel: string;
  /** 지역 필터 활성 여부 (pill 강조) */
  regionActive: boolean;
  onPressRegion: () => void;
  /** 활성 필터 초기화 — 활성 필터가 없으면 미노출 */
  onReset?: () => void;
}

export const FilterBar = memo(function FilterBar({
  regionLabel,
  regionActive,
  onPressRegion,
  onReset,
}: FilterBarProps) {
  return (
    <View className="pb-2">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="flex-row items-center gap-2 px-4"
      >
        <Pressable
          onPress={onPressRegion}
          className={`min-h-[36px] flex-row items-center gap-1 rounded-full border px-3 py-1.5 active:opacity-70 ${
            regionActive
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
              : 'border-secondary-300 dark:border-surface-overlay'
          }`}
          accessibilityRole="button"
          accessibilityLabel={`지역 필터 선택, 현재 ${regionLabel}`}
          testID="home-region-filter"
        >
          <MapPinIcon
            size={16}
            color={regionActive ? SECONDARY_PALETTE[600] : SECONDARY_PALETTE[400]}
          />
          <Text
            className={`text-sm font-sans-medium ${
              regionActive
                ? 'text-primary-700 dark:text-primary-300'
                : 'text-content-secondary dark:text-secondary-400'
            }`}
          >
            {regionLabel}
          </Text>
          <ChevronDownIcon
            size={16}
            color={regionActive ? SECONDARY_PALETTE[600] : SECONDARY_PALETTE[400]}
          />
        </Pressable>

        {onReset ? (
          <Pressable
            onPress={onReset}
            className="min-h-[36px] flex-row items-center gap-1 rounded-full border border-secondary-300 px-3 py-1.5 active:opacity-70 dark:border-surface-overlay"
            accessibilityRole="button"
            accessibilityLabel="필터 초기화"
            testID="home-filter-reset"
          >
            <XMarkIcon size={14} color={SECONDARY_PALETTE[400]} />
            <Text className="text-sm font-sans-medium text-content-secondary dark:text-secondary-400">
              초기화
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
});

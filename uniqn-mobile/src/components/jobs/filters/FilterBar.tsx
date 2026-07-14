/**
 * UNIQN Mobile - 구인구직 필터바
 *
 * @description 타입 칩 아래의 필터 pill 행 — 지역(P1)·역할(P2)·급여(P3) + 초기화.
 * pill 은 서로 다른 독립 시트를 연다(중첩 Modal 금지 — 동시 오픈 없음은 화면이 보장).
 */

import { memo, type ComponentType } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import {
  BanknotesIcon,
  ChevronDownIcon,
  MapPinIcon,
  UsersIcon,
  XMarkIcon,
} from '@/components/icons';
import { SECONDARY_PALETTE } from '@/constants/colors';

interface FilterPillProps {
  label: string;
  active: boolean;
  onPress: () => void;
  Icon: ComponentType<{ size?: number; color?: string }>;
  accessibilityLabel: string;
  testID: string;
}

function FilterPill({ label, active, onPress, Icon, accessibilityLabel, testID }: FilterPillProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`min-h-[36px] flex-row items-center gap-1 rounded-full border px-3 py-1.5 active:opacity-70 ${
        active
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
          : 'border-secondary-300 dark:border-surface-overlay'
      }`}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <Icon size={16} color={active ? SECONDARY_PALETTE[600] : SECONDARY_PALETTE[400]} />
      <Text
        className={`text-sm font-sans-medium ${
          active
            ? 'text-primary-700 dark:text-primary-300'
            : 'text-content-secondary dark:text-secondary-400'
        }`}
      >
        {label}
      </Text>
      <ChevronDownIcon size={16} color={active ? SECONDARY_PALETTE[600] : SECONDARY_PALETTE[400]} />
    </Pressable>
  );
}

export interface FilterBarProps {
  /** 지역 pill 라벨 (예: '지역 전체', '강남구 외 2') */
  regionLabel: string;
  /** 지역 필터 활성 여부 (pill 강조) */
  regionActive: boolean;
  onPressRegion: () => void;
  /** 역할 pill 라벨 (예: '역할', '딜러 외 1') */
  roleLabel: string;
  roleActive: boolean;
  onPressRole: () => void;
  /** 급여 pill 라벨 (예: '급여', '시급 1.3만+') */
  salaryLabel: string;
  salaryActive: boolean;
  onPressSalary: () => void;
  /** 활성 필터 초기화 — 활성 필터가 없으면 미노출 */
  onReset?: () => void;
}

export const FilterBar = memo(function FilterBar({
  regionLabel,
  regionActive,
  onPressRegion,
  roleLabel,
  roleActive,
  onPressRole,
  salaryLabel,
  salaryActive,
  onPressSalary,
  onReset,
}: FilterBarProps) {
  return (
    <View className="pb-2">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="flex-row items-center gap-2 px-4"
      >
        <FilterPill
          label={regionLabel}
          active={regionActive}
          onPress={onPressRegion}
          Icon={MapPinIcon}
          accessibilityLabel={`지역 필터 선택, 현재 ${regionLabel}`}
          testID="home-region-filter"
        />
        <FilterPill
          label={roleLabel}
          active={roleActive}
          onPress={onPressRole}
          Icon={UsersIcon}
          accessibilityLabel={`역할 필터 선택, 현재 ${roleLabel}`}
          testID="home-role-filter"
        />
        <FilterPill
          label={salaryLabel}
          active={salaryActive}
          onPress={onPressSalary}
          Icon={BanknotesIcon}
          accessibilityLabel={`급여 필터 선택, 현재 ${salaryLabel}`}
          testID="home-salary-filter"
        />

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

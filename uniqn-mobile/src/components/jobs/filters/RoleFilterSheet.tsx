/**
 * UNIQN Mobile - 역할 필터 시트 (브라우즈 멀티선택)
 *
 * @description 표준 역할 5종(딜러/플로어/서빙/매니저/직원) 멀티선택 + 적용.
 * 'other'(커스텀)는 role_keys 가 `other:자유텍스트` 라 overlaps 매칭 불가 — v1 제외(설계 §3).
 * 미리보기 카운트는 적용 중인 지역/급여 필터를 포함해 목록(getList)과 정합을 유지한다.
 */

import { memo, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Modal } from '@/components/ui/Modal';
import { CheckIcon, UsersIcon } from '@/components/icons';
import { PRIMARY_COLORS, SECONDARY_PALETTE } from '@/constants/colors';
import { STAFF_ROLES } from '@/constants';
import { useThemeStore } from '@/stores/themeStore';
import { FILTERABLE_STAFF_ROLES, type StaffRole } from '@/types/role';
import type { SalaryFilter } from '@/stores/jobFilterStore';
import { usePostingTypeCounts } from '@/hooks/usePostingTypeCounts';

export interface RoleFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  /** 현재 적용 중인 역할 — 시트 오픈 시 초기 선택으로 복사 */
  appliedRoles: StaffRole[];
  onApply: (roles: StaffRole[]) => void;
  /** 미리보기 카운트 정합용 — 적용 중인 다른 필터 축 (지역 스코프 slug/접두 / 급여) */
  appliedRegions?: string[];
  appliedRegionPrefixes?: string[];
  appliedSalary?: SalaryFilter | null;
}

type SheetBodyProps = Omit<RoleFilterSheetProps, 'visible'>;

/** 필터 가능한 표준 역할 옵션 (STAFF_ROLES 순서 유지, 'other' 제외) */
const FILTER_ROLE_OPTIONS = STAFF_ROLES.filter((option) =>
  (FILTERABLE_STAFF_ROLES as readonly string[]).includes(option.key)
);

function SheetBody({
  onClose,
  appliedRoles,
  onApply,
  appliedRegions = [],
  appliedRegionPrefixes = [],
  appliedSalary = null,
}: SheetBodyProps) {
  const [pending, setPending] = useState<StaffRole[]>(() => [...appliedRoles]);
  const isDarkMode = useThemeStore((state) => state.isDarkMode);
  const checkColor = isDarkMode ? PRIMARY_COLORS[500] : PRIMARY_COLORS[700];

  // 적용 전 미리보기 카운트 — 목록/칩과 동일 스코프(getTypeCounts + 적용 중 타 필터 포함).
  const { counts, hasCounts } = usePostingTypeCounts({
    regions: appliedRegions,
    regionPrefixes: appliedRegionPrefixes,
    roles: pending,
    salaryType: appliedSalary?.type ?? null,
    salaryMin: appliedSalary?.min ?? null,
    salarySort: appliedSalary?.sort ?? null,
    keepPreviousCounts: true,
  });

  const handleToggle = (role: StaffRole) => {
    setPending((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  };

  const handleApply = () => {
    onApply(pending);
    onClose();
  };

  const applyLabel = hasCounts ? `공고 ${counts?.total ?? 0}건 보기` : '적용';

  const selectedSummary = useMemo(() => {
    if (pending.length === 0) return null;
    return FILTER_ROLE_OPTIONS.filter((o) => pending.includes(o.key))
      .map((o) => o.name)
      .join(' · ');
  }, [pending]);

  return (
    <View className="-mx-5 -mb-5">
      {/* 역할 칩 그리드 (2열) */}
      <View className="flex-row flex-wrap justify-between gap-y-2 px-4 pb-3 pt-1">
        {FILTER_ROLE_OPTIONS.map((option) => {
          const selected = pending.includes(option.key);
          return (
            <Pressable
              key={option.key}
              onPress={() => handleToggle(option.key)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`${option.name} 역할`}
              className={`min-h-[48px] w-[48%] flex-row items-center justify-between rounded-lg border px-3 active:opacity-70 ${
                selected
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                  : 'border-secondary-200 dark:border-surface-overlay'
              }`}
            >
              <View className="flex-row items-center gap-2">
                <Text className="text-base">{option.icon}</Text>
                <Text
                  className={`text-sm font-sans-medium ${
                    selected ? 'text-primary-700 dark:text-primary-300' : 'text-content-primary'
                  }`}
                >
                  {option.name}
                </Text>
              </View>
              {selected ? <CheckIcon size={16} color={checkColor} /> : null}
            </Pressable>
          );
        })}
      </View>

      {/* 확인층: 선택 요약 + 적용 */}
      <View className="gap-2 border-t border-secondary-100 px-4 pb-4 pt-3 dark:border-surface-overlay">
        {selectedSummary ? (
          <View className="flex-row items-center gap-2">
            <Text
              className="flex-1 font-sans-medium text-sm text-primary-700 dark:text-primary-300"
              numberOfLines={1}
            >
              {selectedSummary}
            </Text>
            <Pressable
              onPress={() => setPending([])}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="역할 선택 모두 해제"
            >
              <Text className="font-sans-medium text-sm text-content-secondary underline dark:text-secondary-400">
                초기화
              </Text>
            </Pressable>
          </View>
        ) : (
          <View className="flex-row items-center gap-1">
            <UsersIcon size={14} color={SECONDARY_PALETTE[400]} />
            <Text className="font-sans text-xs text-content-secondary dark:text-secondary-400">
              선택하지 않으면 모든 역할의 공고를 보여드려요
            </Text>
          </View>
        )}
        <Pressable
          onPress={handleApply}
          accessibilityRole="button"
          accessibilityLabel={applyLabel}
          testID="role-filter-apply"
          className="min-h-[48px] items-center justify-center rounded-lg bg-primary-600 active:opacity-80 dark:bg-primary-700"
        >
          <Text className="font-sans-semibold text-base text-content-onGold">{applyLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export const RoleFilterSheet = memo(function RoleFilterSheet({
  visible,
  onClose,
  appliedRoles,
  onApply,
  appliedRegions,
  appliedRegionPrefixes,
  appliedSalary,
}: RoleFilterSheetProps) {
  return (
    <Modal visible={visible} onClose={onClose} title="역할 필터" position="bottom" showCloseButton>
      {/* visible 시에만 마운트 — 오픈마다 적용값으로 초기화 + 닫힘 상태 쿼리 방지 */}
      {visible ? (
        <SheetBody
          onClose={onClose}
          appliedRoles={appliedRoles}
          onApply={onApply}
          appliedRegions={appliedRegions}
          appliedRegionPrefixes={appliedRegionPrefixes}
          appliedSalary={appliedSalary}
        />
      ) : null}
    </Modal>
  );
});

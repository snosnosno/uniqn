/**
 * UNIQN Mobile - 급여 필터 시트 (타입 세그먼트 + 프리셋 칩)
 *
 * @description 시급/일급/월급 세그먼트 + 최소 금액 프리셋 칩(단일선택) + 적용.
 * 매칭 의미론: 해당 타입 급여 행(default+역할별) 최대값 ≥ 기준 — 그 이상 받을 수 있는
 * 역할이 존재하면 노출(설계 §4). 협의(other) 공고는 salary_*_max NULL 이라 제외된다.
 * 미리보기 카운트는 적용 중인 지역/역할 필터를 포함해 목록(getList)과 정합을 유지한다.
 */

import { memo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Modal } from '@/components/ui/Modal';
import { InformationCircleIcon } from '@/components/icons';
import { SECONDARY_PALETTE } from '@/constants/colors';
import { SALARY_TYPE_LABELS } from '@/constants';
import type { FilterableSalaryType } from '@/types/jobPosting';
import type { StaffRole } from '@/types/role';
import type { SalaryFilter } from '@/stores/jobFilterStore';
import { formatManWon } from '@/utils/jobFilterLabels';
import { usePostingTypeCounts } from '@/hooks/usePostingTypeCounts';

export interface SalaryFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  /** 현재 적용 중인 급여 필터 — 시트 오픈 시 초기 선택으로 복사 */
  appliedSalary: SalaryFilter | null;
  onApply: (filter: SalaryFilter | null) => void;
  /** 미리보기 카운트 정합용 — 적용 중인 다른 필터 축 (지역 slug 확장 결과 / 역할) */
  appliedRegions?: string[];
  appliedRoles?: StaffRole[];
}

type SheetBodyProps = Omit<SalaryFilterSheetProps, 'visible'>;

const SALARY_TYPES: readonly FilterableSalaryType[] = ['hourly', 'daily', 'monthly'];

/** 타입별 최소 금액 프리셋(원) — 설계 §4 (월급은 매니저·상주 직무 레인지 기준) */
const SALARY_PRESETS: Record<FilterableSalaryType, number[]> = {
  hourly: [11000, 12000, 13000, 15000, 20000],
  daily: [100000, 120000, 150000, 200000],
  monthly: [2000000, 2500000, 3000000, 4000000],
};

function SheetBody({
  onClose,
  appliedSalary,
  onApply,
  appliedRegions = [],
  appliedRoles = [],
}: SheetBodyProps) {
  const [pendingType, setPendingType] = useState<FilterableSalaryType>(
    () => appliedSalary?.type ?? 'hourly'
  );
  const [pendingMin, setPendingMin] = useState<number | null>(() => appliedSalary?.min ?? null);

  // 적용 전 미리보기 카운트 — 목록/칩과 동일 스코프(getTypeCounts + 적용 중 타 필터 포함).
  const { counts, hasCounts } = usePostingTypeCounts({
    regions: appliedRegions,
    roles: appliedRoles,
    salaryType: pendingMin ? pendingType : null,
    salaryMin: pendingMin,
    keepPreviousCounts: true,
  });

  const handleSelectType = (type: FilterableSalaryType) => {
    if (type === pendingType) return;
    setPendingType(type);
    // 프리셋 레인지가 타입마다 달라 금액 선택은 초기화한다.
    setPendingMin(null);
  };

  const handleApply = () => {
    onApply(pendingMin ? { type: pendingType, min: pendingMin } : null);
    onClose();
  };

  const applyLabel = hasCounts ? `공고 ${counts?.total ?? 0}건 보기` : '적용';

  return (
    <View className="-mx-5 -mb-5">
      <View className="gap-3 px-4 pb-3 pt-1">
        {/* 타입 세그먼트 */}
        <View className="flex-row rounded-lg bg-surface-card p-1 dark:bg-surface-elevated">
          {SALARY_TYPES.map((type) => {
            const selected = type === pendingType;
            return (
              <Pressable
                key={type}
                onPress={() => handleSelectType(type)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={`${SALARY_TYPE_LABELS[type]} 선택`}
                className={`min-h-[40px] flex-1 items-center justify-center rounded-md ${
                  selected ? 'bg-surface-page dark:bg-surface' : ''
                }`}
              >
                <Text
                  className={`text-sm ${
                    selected
                      ? 'font-sans-semibold text-content-primary'
                      : 'font-sans text-content-secondary dark:text-secondary-400'
                  }`}
                >
                  {SALARY_TYPE_LABELS[type]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* 최소 금액 프리셋 칩 (단일선택 — 재탭 시 해제) */}
        <View className="flex-row flex-wrap gap-2">
          {SALARY_PRESETS[pendingType].map((amount) => {
            const selected = pendingMin === amount;
            const label = `${formatManWon(amount)}+`;
            return (
              <Pressable
                key={amount}
                onPress={() => setPendingMin(selected ? null : amount)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`${SALARY_TYPE_LABELS[pendingType]} ${label}`}
                className={`min-h-[40px] flex-row items-center rounded-full border px-4 active:opacity-70 ${
                  selected
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                    : 'border-secondary-200 dark:border-surface-overlay'
                }`}
              >
                <Text
                  className={`text-sm font-sans-medium ${
                    selected ? 'text-primary-700 dark:text-primary-300' : 'text-content-primary'
                  }`}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View className="flex-row items-center gap-1">
          <InformationCircleIcon size={14} color={SECONDARY_PALETTE[400]} />
          <Text className="font-sans text-xs text-content-secondary dark:text-secondary-400">
            급여 협의 공고는 제외돼요
          </Text>
        </View>
      </View>

      {/* 확인층: 선택 요약 + 적용 */}
      <View className="gap-2 border-t border-secondary-100 px-4 pb-4 pt-3 dark:border-surface-overlay">
        {pendingMin ? (
          <View className="flex-row items-center gap-2">
            <Text className="flex-1 font-sans-medium text-sm text-primary-700 dark:text-primary-300">
              {SALARY_TYPE_LABELS[pendingType]} {formatManWon(pendingMin)} 이상
            </Text>
            <Pressable
              onPress={() => setPendingMin(null)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="급여 선택 해제"
            >
              <Text className="font-sans-medium text-sm text-content-secondary underline dark:text-secondary-400">
                초기화
              </Text>
            </Pressable>
          </View>
        ) : (
          <Text className="font-sans text-xs text-content-secondary dark:text-secondary-400">
            선택하지 않으면 급여 조건 없이 전체 공고를 보여드려요
          </Text>
        )}
        <Pressable
          onPress={handleApply}
          accessibilityRole="button"
          accessibilityLabel={applyLabel}
          testID="salary-filter-apply"
          className="min-h-[48px] items-center justify-center rounded-lg bg-primary-600 active:opacity-80 dark:bg-primary-700"
        >
          <Text className="font-sans-semibold text-base text-content-onGold">{applyLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export const SalaryFilterSheet = memo(function SalaryFilterSheet({
  visible,
  onClose,
  appliedSalary,
  onApply,
  appliedRegions,
  appliedRoles,
}: SalaryFilterSheetProps) {
  return (
    <Modal visible={visible} onClose={onClose} title="급여 필터" position="bottom" showCloseButton>
      {/* visible 시에만 마운트 — 오픈마다 적용값으로 초기화 + 닫힘 상태 쿼리 방지 */}
      {visible ? (
        <SheetBody
          onClose={onClose}
          appliedSalary={appliedSalary}
          onApply={onApply}
          appliedRegions={appliedRegions}
          appliedRoles={appliedRoles}
        />
      ) : null}
    </Modal>
  );
});

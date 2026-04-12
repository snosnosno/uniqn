/**
 * UNIQN Mobile - 구인공고 필터 컴포넌트
 *
 * @description 공고 목록 필터링 UI (지역, 날짜, 역할)
 * @version 1.0.0
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, Modal, ScrollView } from 'react-native';
import { FilterIcon, XMarkIcon, CalendarIcon, MapPinIcon, BriefcaseIcon } from '@/components/icons';
import { SEOUL_DISTRICTS, STAFF_ROLES } from '@/constants';
import type { JobPostingFilters, StaffRole } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface JobFiltersProps {
  /** 현재 필터 값 */
  filters: JobPostingFilters;
  /** 필터 변경 콜백 */
  onFiltersChange: (filters: JobPostingFilters) => void;
  /** 활성 필터 개수 표시 */
  showActiveCount?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** 필터용 역할 목록 (STAFF_ROLES에서 생성) */
const FILTER_ROLES: { value: StaffRole; label: string }[] = STAFF_ROLES.filter(
  (r) => r.key !== 'other'
) // 기타 제외
  .map((r) => ({ value: r.key as StaffRole, label: r.name }));

/** 날짜 필터 옵션 */
const DATE_OPTIONS = [
  { value: 'all', label: '전체' },
  { value: 'today', label: '오늘' },
  { value: 'tomorrow', label: '내일' },
  { value: 'week', label: '이번 주' },
  { value: 'month', label: '이번 달' },
] as const;

type DateFilterValue = (typeof DATE_OPTIONS)[number]['value'];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 날짜 필터 옵션에 따른 날짜 범위 계산
 */
function getDateRange(option: DateFilterValue): { start: string; end: string } | undefined {
  const today = new Date();
  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  switch (option) {
    case 'today':
      return { start: formatDate(today), end: formatDate(today) };
    case 'tomorrow': {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return { start: formatDate(tomorrow), end: formatDate(tomorrow) };
    }
    case 'week': {
      const endOfWeek = new Date(today);
      endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
      return { start: formatDate(today), end: formatDate(endOfWeek) };
    }
    case 'month': {
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { start: formatDate(today), end: formatDate(endOfMonth) };
    }
    default:
      return undefined;
  }
}

/**
 * 현재 날짜 범위에 해당하는 옵션 찾기
 */
function getDateOptionFromRange(dateRange?: { start: string; end: string }): DateFilterValue {
  if (!dateRange) return 'all';

  for (const option of DATE_OPTIONS) {
    if (option.value === 'all') continue;
    const range = getDateRange(option.value);
    if (range && range.start === dateRange.start && range.end === dateRange.end) {
      return option.value;
    }
  }
  return 'all';
}

// ============================================================================
// Sub Components
// ============================================================================

interface FilterChipProps {
  label: string;
  isActive: boolean;
  onPress: () => void;
}

function FilterChip({ label, isActive, onPress }: FilterChipProps) {
  return (
    <Pressable
      onPress={onPress}
      className={`
        px-3 py-2 rounded-sm mr-2 mb-2
        ${isActive ? 'bg-primary-600 dark:bg-primary-700' : 'bg-secondary-100 dark:bg-surface'}
      `}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
    >
      <Text
        className={`
          text-sm font-medium
          ${isActive ? 'text-white' : 'text-secondary-700 dark:text-secondary-300'}
        `}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export const JobFilters: React.FC<JobFiltersProps> = React.memo(
  ({ filters, onFiltersChange, showActiveCount = true }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    // 임시 필터 상태 (모달 내에서 사용)
    const [tempFilters, setTempFilters] = useState<JobPostingFilters>(filters);

    // 활성 필터 개수 계산
    const activeFilterCount = useMemo(() => {
      let count = 0;
      if (filters.district) count++;
      if (filters.dateRange) count++;
      if (filters.roles && filters.roles.length > 0) count++;
      if (filters.isUrgent) count++;
      return count;
    }, [filters]);

    // 모달 열기
    const handleOpenModal = useCallback(() => {
      setTempFilters(filters);
      setIsModalOpen(true);
    }, [filters]);

    // 모달 닫기 (취소)
    const handleCloseModal = useCallback(() => {
      setIsModalOpen(false);
    }, []);

    // 필터 적용
    const handleApplyFilters = useCallback(() => {
      onFiltersChange(tempFilters);
      setIsModalOpen(false);
    }, [tempFilters, onFiltersChange]);

    // 필터 초기화
    const handleResetFilters = useCallback(() => {
      setTempFilters({});
    }, []);

    // 지역 선택
    const handleDistrictSelect = useCallback((district: string) => {
      setTempFilters((prev) => ({
        ...prev,
        district: district === '전체' ? undefined : district,
      }));
    }, []);

    // 날짜 선택
    const handleDateSelect = useCallback((option: DateFilterValue) => {
      setTempFilters((prev) => ({
        ...prev,
        dateRange: getDateRange(option),
      }));
    }, []);

    // 역할 토글
    const handleRoleToggle = useCallback((role: StaffRole) => {
      setTempFilters((prev) => {
        const currentRoles = prev.roles || [];
        const hasRole = currentRoles.includes(role);

        return {
          ...prev,
          roles: hasRole ? currentRoles.filter((r) => r !== role) : [...currentRoles, role],
        };
      });
    }, []);

    // 긴급 토글
    const handleUrgentToggle = useCallback(() => {
      setTempFilters((prev) => ({
        ...prev,
        isUrgent: !prev.isUrgent,
      }));
    }, []);

    // 현재 날짜 옵션
    const currentDateOption = getDateOptionFromRange(tempFilters.dateRange);

    return (
      <>
        {/* 필터 버튼 */}
        <Pressable
          onPress={handleOpenModal}
          className="flex-row items-center px-4 py-2 bg-white dark:bg-surface rounded-sm border border-secondary-200 dark:border-surface-overlay"
          accessibilityLabel="필터 열기"
          accessibilityHint="공고 필터링 옵션을 설정합니다"
        >
          <FilterIcon size={18} color="#6366f1" />
          <Text className="ml-2 text-sm font-medium text-secondary-700 dark:text-secondary-300">
            필터
          </Text>
          {showActiveCount && activeFilterCount > 0 && (
            <View className="ml-2 bg-primary-600 rounded-sm px-2 py-0.5 min-w-[20px] items-center">
              <Text className="text-white text-xs font-bold">{activeFilterCount}</Text>
            </View>
          )}
        </Pressable>

        {/* 필터 모달 */}
        <Modal
          visible={isModalOpen}
          transparent
          animationType="slide"
          onRequestClose={handleCloseModal}
        >
          <Pressable className="flex-1 bg-black/50 justify-end" onPress={handleCloseModal}>
            <Pressable
              className="bg-white dark:bg-surface rounded-t-2xl max-h-[85%]"
              onPress={(e) => e.stopPropagation()}
            >
              {/* 헤더 */}
              <View className="flex-row items-center justify-between px-4 py-4 border-b border-secondary-200 dark:border-surface-overlay">
                <Text className="text-lg font-bold text-secondary-900 dark:text-white">필터</Text>
                <View className="flex-row items-center gap-4">
                  <Pressable onPress={handleResetFilters}>
                    <Text className="text-primary-600 dark:text-primary-400 font-medium">
                      초기화
                    </Text>
                  </Pressable>
                  <Pressable onPress={handleCloseModal} className="p-1" accessibilityLabel="닫기">
                    <XMarkIcon size={24} color="#6B7280" />
                  </Pressable>
                </View>
              </View>

              {/* 필터 내용 */}
              <ScrollView className="px-4 py-4">
                {/* 지역 필터 */}
                <View className="mb-6">
                  <View className="flex-row items-center mb-3">
                    <MapPinIcon size={18} color="#6366f1" />
                    <Text className="ml-2 text-base font-semibold text-secondary-900 dark:text-white">
                      지역
                    </Text>
                  </View>
                  <View className="flex-row flex-wrap">
                    {SEOUL_DISTRICTS.map((district) => (
                      <FilterChip
                        key={district}
                        label={district}
                        isActive={
                          district === '전체'
                            ? !tempFilters.district
                            : tempFilters.district === district
                        }
                        onPress={() => handleDistrictSelect(district)}
                      />
                    ))}
                  </View>
                </View>

                {/* 날짜 필터 */}
                <View className="mb-6">
                  <View className="flex-row items-center mb-3">
                    <CalendarIcon size={18} color="#6366f1" />
                    <Text className="ml-2 text-base font-semibold text-secondary-900 dark:text-white">
                      근무일
                    </Text>
                  </View>
                  <View className="flex-row flex-wrap">
                    {DATE_OPTIONS.map((option) => (
                      <FilterChip
                        key={option.value}
                        label={option.label}
                        isActive={currentDateOption === option.value}
                        onPress={() => handleDateSelect(option.value)}
                      />
                    ))}
                  </View>
                </View>

                {/* 역할 필터 */}
                <View className="mb-6">
                  <View className="flex-row items-center mb-3">
                    <BriefcaseIcon size={18} color="#6366f1" />
                    <Text className="ml-2 text-base font-semibold text-secondary-900 dark:text-white">
                      역할
                    </Text>
                  </View>
                  <View className="flex-row flex-wrap">
                    {FILTER_ROLES.map((role) => (
                      <FilterChip
                        key={role.value}
                        label={role.label}
                        isActive={tempFilters.roles?.includes(role.value) || false}
                        onPress={() => handleRoleToggle(role.value)}
                      />
                    ))}
                  </View>
                </View>

                {/* 긴급 필터 */}
                <View className="mb-6">
                  <Pressable
                    onPress={handleUrgentToggle}
                    className={`
                      flex-row items-center justify-between
                      p-4 rounded-md border
                      ${
                        tempFilters.isUrgent
                          ? 'bg-error-50 dark:bg-error-900/20 border-error-200 dark:border-error-800'
                          : 'bg-secondary-50 dark:bg-surface border-secondary-200 dark:border-surface-overlay'
                      }
                    `}
                  >
                    <View className="flex-row items-center">
                      <Text className="font-medium text-secondary-900 dark:text-white">
                        긴급 공고만 보기
                      </Text>
                    </View>
                    <View
                      className={`
                        w-6 h-6 rounded-sm border-2 items-center justify-center
                        ${
                          tempFilters.isUrgent
                            ? 'bg-error-500 border-error-500'
                            : 'bg-white dark:bg-surface border-secondary-300 dark:border-surface-overlay'
                        }
                      `}
                    >
                      {tempFilters.isUrgent && <Text className="text-white text-xs">{''}</Text>}
                    </View>
                  </Pressable>
                </View>

                {/* 하단 여백 */}
                <View className="h-8" />
              </ScrollView>

              {/* 적용 버튼 */}
              <View className="px-4 py-4 border-t border-secondary-200 dark:border-surface-overlay">
                <Pressable
                  onPress={handleApplyFilters}
                  className="bg-primary-600 dark:bg-primary-700 py-4 rounded-md items-center active:opacity-80"
                >
                  <Text className="text-white font-semibold text-base">필터 적용</Text>
                </Pressable>
              </View>

              {/* 하단 안전 영역 */}
              <View className="h-4" />
            </Pressable>
          </Pressable>
        </Modal>
      </>
    );
  }
);

JobFilters.displayName = 'JobFilters';

export default JobFilters;

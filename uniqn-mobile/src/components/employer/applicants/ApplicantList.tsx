/**
 * UNIQN Mobile - 지원자 목록 컴포넌트
 *
 * @description FlashList 기반 지원자 목록 (무한 스크롤)
 * @version 1.1.0
 */

import { SECONDARY_PALETTE } from '@/constants/colors';
import React, { useState, useCallback, useMemo } from 'react';
import { View, Pressable, Text, RefreshControl } from 'react-native';
import { AppFlashList } from '@/components/ui/AppFlashList';
import { ApplicantCard } from './ApplicantCard';
import { ApplicantBulkActions } from './ApplicantBulkActions';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { FilterTabs, type FilterTabOption } from '@/components/ui/FilterTabs';
import { ScreenSkeleton } from '@/components/ui';
import { CheckIcon, FilterIcon } from '@/components/icons';
import { confirmAction } from '@/utils/confirmAction';
import { useApplicantProfiles } from '@/hooks/useApplicantProfiles';
import { useApplicantNoShowCounts } from '@/hooks/useApplicantNoShowCounts';
import { LIST_CONTAINER_STYLES, STATUS } from '@/constants';
import { PTR_REFRESH_PROPS } from '@/constants/ptr';
import type { ApplicantWithDetails } from '@/services';
import type { ApplicationStatus } from '@/types';
import { APPLICATION_STATUS_LABELS } from '@/shared/status';

// ============================================================================
// Types
// ============================================================================

export interface ApplicantListProps {
  applicants: ApplicantWithDetails[];
  isLoading?: boolean;
  error?: Error | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onConfirm?: (applicant: ApplicantWithDetails) => void;
  onReject?: (applicant: ApplicantWithDetails) => void;
  /** 확정 취소 (확정된 지원자 un-confirm) */
  onCancelConfirmation?: (applicant: ApplicantWithDetails) => void;
  /** 프로필 상세보기 */
  onViewProfile?: (applicant: ApplicantWithDetails) => void;
  /** 신규(applied) 지원자 일괄 확정 — 없으면 일괄 선택 UI 미노출 */
  onBulkConfirm?: (applicationIds: string[]) => void;
  /** 일괄 확정 진행 중 여부 */
  isBulkConfirming?: boolean;
  /** 지원자 0명 상태에서 "공고 공유하기" CTA — 없으면 버튼 미노출 */
  onSharePosting?: () => void;
  /**
   * 첫 렌더의 필터. 허브의 통계 숫자("대기중 3")를 눌러 들어온 경우 그 숫자만 담긴
   * 목록으로 도착해야 한다 — 기본 'all' 로 열면 사용자가 필터를 한 번 더 골라야 한다.
   *
   * @remarks 초기값 전용이다. 이후 전환은 사용자가 FilterTabs 로 하며, 이 prop 이 바뀌어도
   *   화면이 되감기지 않는다(사용자가 고른 필터를 부모가 덮어쓰면 안 된다).
   */
  initialFilter?: FilterStatus;
  /**
   * 공고 ID — 노쇼 이력 배치 조회(S3-3)에 필요하다.
   * 미주입 시 조회 자체를 하지 않아 칩이 뜨지 않는다(기존 동작 보존).
   */
  jobPostingId?: string;
}

export type FilterStatus = 'all' | ApplicationStatus;

const APPLICANT_FILTER_VALUES: readonly string[] = ['all', ...Object.values(STATUS.APPLICATION)];

/**
 * 쿼리 파라미터 → 필터. 모르는 값은 조용히 'all' 로 떨어진다.
 *
 * @description 허브의 통계 숫자가 `?filter=applied` 로 넘겨 주는 값을 받는다. 딥링크·수기 URL
 *   로 아무 문자열이나 들어올 수 있으므로 화이트리스트로 좁힌다 — 검증 없이 넘기면
 *   어떤 탭에도 해당하지 않는 필터가 걸려 목록이 영구히 비어 보인다.
 *   expo-router 는 같은 키가 중복되면 배열을 주므로 첫 값만 쓴다.
 */
export function toApplicantFilter(raw: string | string[] | undefined): FilterStatus {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) {
    return 'all';
  }
  return APPLICANT_FILTER_VALUES.includes(value) ? (value as FilterStatus) : 'all';
}

// ============================================================================
// Constants
// ============================================================================

const FILTER_OPTIONS: FilterTabOption<FilterStatus>[] = [
  { value: 'all', label: '전체' },
  { value: STATUS.APPLICATION.APPLIED, label: '신규' },
  { value: STATUS.APPLICATION.CONFIRMED, label: '확정' },
  { value: STATUS.APPLICATION.REJECTED, label: '거절' },
];

// ============================================================================
// Main Component
// ============================================================================

export function ApplicantList({
  applicants,
  isLoading,
  error,
  onRefresh,
  isRefreshing,
  onConfirm,
  onReject,
  onCancelConfirmation,
  onViewProfile,
  onBulkConfirm,
  isBulkConfirming,
  onSharePosting,
  initialFilter = 'all',
  jobPostingId,
}: ApplicantListProps) {
  const [selectedFilter, setSelectedFilter] = useState<FilterStatus>(initialFilter);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  // ==========================================================================
  // N+1 최적화: 지원자 프로필 배치 프리페치
  // ==========================================================================
  const applicantIds = useMemo(
    () => applicants.map((a) => a.applicantId).filter(Boolean),
    [applicants]
  );

  // 배치로 사용자 프로필 조회 (Hook 레이어를 통해 Repository 접근)
  useApplicantProfiles({ applicantIds });

  // 노쇼 이력도 배치로 (S3-3) — 카드마다 개별 조회하면 지원자 20명에 20번 왕복한다.
  const { noShowCounts } = useApplicantNoShowCounts({
    jobPostingId: jobPostingId ?? '',
    applicantIds,
  });

  // 필터링된 지원자 목록
  const filteredApplicants = useMemo(() => {
    if (selectedFilter === 'all') return applicants;
    return applicants.filter((a) => a.status === selectedFilter);
  }, [applicants, selectedFilter]);

  // 필터 옵션 (카운트 포함)
  const filterOptions = useMemo(() => {
    const counts: Partial<Record<FilterStatus, number>> = {
      all: applicants.length,
    };
    applicants.forEach((a) => {
      const status = a.status as ApplicationStatus;
      counts[status] = (counts[status] || 0) + 1;
    });
    return FILTER_OPTIONS.map((option) => ({
      ...option,
      count: counts[option.value] ?? 0,
    }));
  }, [applicants]);

  // 일괄 확정 대상 = 신규(applied) 지원자만
  const selectableApplicants = useMemo(
    () => applicants.filter((a) => a.status === STATUS.APPLICATION.APPLIED),
    [applicants]
  );
  const bulkEnabled = Boolean(onBulkConfirm) && selectableApplicants.length > 0;
  const isAllSelected =
    selectableApplicants.length > 0 && selectedIds.size === selectableApplicants.length;

  const toggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => {
      if (prev) {
        setSelectedIds(new Set());
        setSelectedFilter('all');
      } else {
        // 선택 모드 진입 시 신규 지원자에 포커싱(일괄 확정 대상)
        setSelectedFilter(STATUS.APPLICATION.APPLIED);
      }
      return !prev;
    });
  }, []);

  const toggleSelect = useCallback((applicationId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(applicationId)) {
        next.delete(applicationId);
      } else {
        next.add(applicationId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(selectableApplicants.map((a) => a.id)));
  }, [selectableApplicants]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleBulkConfirm = useCallback(() => {
    if (!onBulkConfirm || selectedIds.size === 0) {
      return;
    }
    const ids = Array.from(selectedIds);
    confirmAction({
      title: '일괄 확정',
      message: `선택한 ${ids.length}명을 확정할까요?\n각 지원자가 신청한 모든 자리가 확정됩니다.`,
      confirmText: '확정',
      onConfirm: () => {
        onBulkConfirm(ids);
        setSelectionMode(false);
        setSelectedIds(new Set());
      },
    });
  }, [onBulkConfirm, selectedIds]);

  // 렌더 아이템
  const renderItem = useCallback(
    ({ item }: { item: ApplicantWithDetails }) => {
      const isApplied = item.status === STATUS.APPLICATION.APPLIED;

      // 선택 모드: 신규 지원자만 체크박스로 선택 가능. 카드 액션은 숨긴다.
      if (selectionMode && isApplied) {
        const isSelected = selectedIds.has(item.id);
        return (
          <View className="px-4 mb-3 flex-row items-center">
            <Pressable
              onPress={() => toggleSelect(item.id)}
              hitSlop={8}
              className="pr-3"
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
              accessibilityLabel={`${item.applicantName ?? '지원자'} 선택`}
            >
              <View
                className={`
                h-6 w-6 rounded border-2 items-center justify-center
                ${
                  isSelected
                    ? 'bg-primary-500 border-primary-500'
                    : 'border-secondary-400 dark:border-surface-overlay'
                }
              `}
              >
                {isSelected && <CheckIcon size={14} color="#fff" />}
              </View>
            </Pressable>
            <View className="flex-1">
              <ApplicantCard applicant={item} showActions={false} />
            </View>
          </View>
        );
      }

      return (
        <View className="px-4 mb-3">
          <ApplicantCard
            applicant={item}
            onConfirm={onConfirm}
            onReject={onReject}
            onCancelConfirmation={onCancelConfirmation}
            onViewProfile={onViewProfile}
            noShowCount={noShowCounts?.get(item.applicantId)}
          />
        </View>
      );
    },
    [
      onConfirm,
      onReject,
      onCancelConfirmation,
      onViewProfile,
      noShowCounts,
      selectionMode,
      selectedIds,
      toggleSelect,
    ]
  );

  const keyExtractor = useCallback((item: ApplicantWithDetails) => item.id, []);

  // 로딩 상태
  if (isLoading && !isRefreshing) {
    return <ScreenSkeleton type="applicantList" count={5} />;
  }

  // 에러 상태
  if (error) {
    return (
      <ErrorState title="지원자 목록을 불러올 수 없습니다" error={error} onRetry={onRefresh} />
    );
  }

  // 빈 상태
  if (!applicants.length) {
    return (
      <EmptyState
        icon={<FilterIcon size={48} color={SECONDARY_PALETTE[400]} />}
        title="지원자가 없습니다"
        description="아직 이 공고에 지원한 사람이 없습니다."
        actionLabel={onSharePosting ? '공고 공유하기' : undefined}
        onAction={onSharePosting}
      />
    );
  }

  return (
    <View className="flex-1 bg-surface-page dark:bg-surface">
      {/* 필터 탭 */}
      <FilterTabs
        options={filterOptions}
        selectedValue={selectedFilter}
        onSelect={setSelectedFilter}
      />

      {/* 일괄 확정 선택 토글 */}
      {bulkEnabled && (
        <View className="px-4 mb-3">
          <Pressable
            onPress={toggleSelectionMode}
            className="flex-row items-center justify-center py-2 rounded-lg bg-surface-card dark:bg-surface"
            accessibilityRole="button"
            accessibilityLabel={selectionMode ? '일괄 확정 선택 취소' : '일괄 확정 선택'}
          >
            <CheckIcon size={16} color={selectionMode ? '#B8962E' : SECONDARY_PALETTE[500]} />
            <Text
              className={`
              ml-2 text-sm font-sans-medium
              ${
                selectionMode
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-secondary-600 dark:text-secondary-400'
              }
            `}
            >
              {selectionMode ? '선택 취소' : '일괄 확정 선택'}
            </Text>
          </Pressable>
        </View>
      )}

      {/* 선택 모드 액션 바 */}
      {selectionMode && (
        <ApplicantBulkActions
          selectedCount={selectedIds.size}
          onSelectAll={handleSelectAll}
          onClearSelection={handleClearSelection}
          onBulkConfirm={handleBulkConfirm}
          isAllSelected={isAllSelected}
          isBulkConfirming={isBulkConfirming}
        />
      )}

      {/* 지원자 목록 */}
      {filteredApplicants.length === 0 ? (
        <EmptyState
          title={`${APPLICATION_STATUS_LABELS[selectedFilter as ApplicationStatus] || '해당'} 상태의 지원자가 없습니다`}
          description="다른 필터를 선택해 보세요."
        />
      ) : (
        <AppFlashList
          data={filteredApplicants}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          estimatedItemSize={180}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={isRefreshing ?? false}
                onRefresh={onRefresh}
                {...PTR_REFRESH_PROPS}
              />
            ) : undefined
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={LIST_CONTAINER_STYLES.paddingBottom100}
        />
      )}
    </View>
  );
}

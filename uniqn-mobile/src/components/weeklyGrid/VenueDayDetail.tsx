/**
 * VenueDayDetail — 선택 날짜의 운영처 배치 상세(unit 6, 읽기 전용)
 *
 * useVenueDaySlots(venueId, date) 로 그 날 venue 스팬 배치 work_log 를 읽어
 * buildVenueDayGroup 으로 ConfirmedStaffGroup 으로 투영 → 기존 ConfirmedStaffList 를
 * showActions={false} 읽기전용으로 재사용. 소형 일별 리스트라 ConfirmedStaffList 의
 * SectionList 로 충분(대형 FlashList 불필요).
 *
 * U4: 그날 0명/로딩/에러는 ConfirmedStaffList 가 처리하되, 0명 안내는 그리드 맥락에 맞게 보강.
 */
import React, { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { EmptyState } from '@/components/ui/EmptyState';
import { UsersIcon } from '@/components/icons';
import { SECONDARY_PALETTE } from '@/constants/colors';
import { ConfirmedStaffList } from '@/components/employer/applicants/ConfirmedStaffList';
import { useVenueDaySlots } from '@/hooks/weeklyGrid';
import type { VenueDaySlot } from '@/repositories/weeklyGrid';
import type { ConfirmedStaff } from '@/types';
import { buildVenueDayGroup } from './venueDayDetailMapping';

export interface VenueDayDetailProps {
  venueId: string | null;
  /** YYYY-MM-DD */
  date: string;
  /**
   * 슬롯 행 탭 콜백(편집 시트 진입). 미제공이면 읽기전용(행 탭 비활성).
   * staff.id(=workLogId)로 원본 VenueDaySlot 을 역해소해 전달한다.
   */
  onSlotPress?: (slot: VenueDaySlot) => void;
}

export function VenueDayDetail({ venueId, date, onSlotPress }: VenueDayDetailProps) {
  const { data, isLoading, error, refetch, isRefetching } = useVenueDaySlots(venueId, date);

  const grouped = useMemo(() => {
    const group = buildVenueDayGroup(data ?? [], date);
    return group ? [group] : [];
  }, [data, date]);

  // workLogId → 원본 슬롯 역인덱스(탭 시 편집 대상 해소). 불변성: 새 Map 생성.
  const slotById = useMemo(() => {
    const map = new Map<string, VenueDaySlot>();
    for (const slot of data ?? []) {
      map.set(slot.workLogId, slot);
    }
    return map;
  }, [data]);

  const handleStaffPress = useCallback(
    (staff: ConfirmedStaff) => {
      const slot = slotById.get(staff.id);
      if (slot) onSlotPress?.(slot);
    },
    [slotById, onSlotPress]
  );

  // U4: 로딩/에러가 아니고 0명일 때는 그리드 맥락 안내(ConfirmedStaffList 기본 카피 대신).
  if (!isLoading && !error && grouped.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-6 py-10">
        <EmptyState
          icon={<UsersIcon size={48} color={SECONDARY_PALETTE[400]} />}
          title="이 날 배치된 인원이 없어요"
          description="그리드에서 다른 날짜를 선택하거나 인원을 배치해보세요."
        />
      </View>
    );
  }

  return (
    <ConfirmedStaffList
      grouped={grouped}
      isLoading={isLoading}
      error={(error as Error | null) ?? null}
      onRefresh={refetch}
      isRefreshing={isRefetching}
      showActions={false}
      onStaffPress={onSlotPress ? handleStaffPress : undefined}
    />
  );
}

export default VenueDayDetail;

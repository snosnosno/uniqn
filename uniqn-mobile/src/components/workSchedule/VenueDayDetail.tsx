/**
 * VenueDayDetail — 선택 날짜의 운영처 배치 상세(unit 6, 읽기 전용)
 *
 * useVenueDaySlots(venueId, date) 로 그 날 venue 스팬 배치 work_log 를 읽어
 * buildVenueDayGroup 으로 ConfirmedStaff 로 투영 → 기존 ConfirmedStaffCard 를 재사용해
 * 직접 렌더한다(P1-3: 가상화 SectionList 제거 — 화면 전체 단일 ScrollView 전제,
 * 중첩 VirtualizedList 금지. 소형 일별 리스트라 map 렌더로 충분).
 * 날짜 섹션 헤더는 패널(dateLabel)이 이미 표시하므로 중복 표기도 함께 제거됐다.
 *
 * U4: 그날 0명/로딩/에러 상태를 자체 처리(0명 안내는 그리드 맥락 카피).
 */
import React, { useCallback, useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Loading } from '@/components/ui/Loading';
import { UsersIcon } from '@/components/icons';
import { SECONDARY_PALETTE } from '@/constants/colors';
import { logger } from '@/utils/logger';
import { ConfirmedStaffCard } from '@/components/employer/applicants/ConfirmedStaffCard';
import { useVenueDaySlots } from '@/hooks/workSchedule';
import type { VenueDaySlot } from '@/repositories/workSchedule';
import type { ConfirmedStaff } from '@/types';
import { buildVenueDayGroup } from './venueDayDetailMapping';
import { loadFailed } from '@/constants/messages';

/**
 * 비가상화 직접 렌더 상한(L4·방어) — P1-3 단일 ScrollView 설계라 FlashList 전환 금지.
 * 하루 슬롯이 이 임계를 넘으면 성능 저하 신호를 logger.warn 으로만 남긴다(렌더/구조는 불변).
 */
const NON_VIRTUALIZED_SLOT_WARN_THRESHOLD = 50;

export interface VenueDayDetailProps {
  venueId: string | null;
  /** YYYY-MM-DD */
  date: string;
  /**
   * 슬롯 행 탭 콜백(편집 시트 진입). 미제공이면 읽기전용(행 탭 비활성).
   * staff.id(=workLogId)로 원본 VenueDaySlot 을 역해소해 전달한다.
   */
  onSlotPress?: (slot: VenueDaySlot) => void;
  /**
   * 배치 빼기(카드 액션). 미제공이면 액션 줄 자체를 렌더하지 않는다.
   *
   * 🔑 빼기가 **시트가 아니라 카드에** 있는 이유: 파괴적 액션은 진입 맥락의 것이고 화면마다
   *    뜻이 다르다(설계 §3-4). 순수 편집기인 통합 시트에 되돌려 넣지 말 것.
   */
  onSlotDelete?: (slot: VenueDaySlot) => void;
  /** 빈 상태 "인원 배치하기" CTA(임페커블 룰9 — 행동 단계). 미제공이면 안내문만. */
  onAddPress?: () => void;
}

export function VenueDayDetail({
  venueId,
  date,
  onSlotPress,
  onSlotDelete,
  onAddPress,
}: VenueDayDetailProps) {
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

  const handleStaffDelete = useCallback(
    (staff: ConfirmedStaff) => {
      const slot = slotById.get(staff.id);
      if (slot) onSlotDelete?.(slot);
    },
    [slotById, onSlotDelete]
  );

  // L4 방어: 비가상화 map 렌더라 슬롯이 과다하면 성능이 저하될 수 있음 — 임계 초과 시 1회 경고만.
  // 구조는 그대로(가상화 전환 금지). (count, date) 변화 시에만 재평가돼 로그 폭주를 막는다.
  const slotCount = data?.length ?? 0;
  useEffect(() => {
    if (slotCount > NON_VIRTUALIZED_SLOT_WARN_THRESHOLD) {
      logger.warn('VenueDayDetail 비가상화 렌더 상한 초과', {
        date,
        count: slotCount,
        threshold: NON_VIRTUALIZED_SLOT_WARN_THRESHOLD,
      });
    }
  }, [slotCount, date]);

  if (isLoading && !isRefetching) {
    return (
      <View className="items-center py-8">
        <Loading size="small" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="px-4 py-2">
        <ErrorState compact title={loadFailed('배치')} error={error as Error} onRetry={refetch} />
      </View>
    );
  }

  // U4: 0명일 때는 그리드 맥락 안내 + 행동 CTA(룰9 인지·가치·행동 3단).
  if (grouped.length === 0) {
    return (
      <View className="items-center justify-center px-6 py-8">
        <EmptyState
          compact
          icon={<UsersIcon size={48} color={SECONDARY_PALETTE[400]} />}
          title="이 날 근무 인원이 없어요"
          description="근무표에서 다른 날짜를 선택하거나 근무를 추가해보세요."
          actionLabel={onAddPress ? '근무 추가하기' : undefined}
          onAction={onAddPress}
        />
      </View>
    );
  }

  // 소형 리스트 직접 렌더(가상화 없음) — 상위 단일 ScrollView 가 스크롤 담당.
  return (
    <View className="pb-4">
      {/* 편집 액션은 카드에 두지 않는다 — 예정·실적·역할·색·메모 입구는 행 탭 → 통합 시트
          하나다(설계 §3-4). 카드에 남는 것은 빼기뿐이고, 그것도 콜백이 있을 때만 그린다. */}
      {grouped[0]!.staff.map((staff) => (
        <View key={staff.id} className="mb-3 px-4">
          <ConfirmedStaffCard
            staff={staff}
            onPress={onSlotPress ? handleStaffPress : undefined}
            onDelete={onSlotDelete ? handleStaffDelete : undefined}
            // 🔴 근무표에는 상태 되돌리기가 없다 — 기본 규칙(출근 전만 빼기)을 그대로 쓰면
            //    QR 오인식으로 출근 처리된 인원을 **앱 어디서도** 뺄 수 없게 된다(컨테이너
            //    직속 배치는 스태프관리 탭 자체가 없다). 폐기된 시트의 조건(staffId 만 봄)을 잇는다.
            allowDeleteAnyStatus={Boolean(onSlotDelete)}
            showActions={Boolean(onSlotDelete)}
          />
        </View>
      ))}
    </View>
  );
}

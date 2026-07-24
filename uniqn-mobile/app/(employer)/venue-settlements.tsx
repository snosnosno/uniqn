/**
 * 지점 정산 — 근무표 직접 배치분 월 단위 정산 (JIT 급여 설계 §D)
 *
 * 폴백(₩15,000) 계산 건은 "기본 단가 적용" 배지로 가시화(조용한 오답 금지 — 정책 2026-07-22),
 * 배지 탭 → RoleSalaryField 시트로 그 역할 단가를 즉시 설정 → 쿼리 invalidate 재계산
 * (정산은 read-time 계산이라 refetch 로 충분). 건별 예외는 기존 공고 정산의 customSalaryInfo 경로.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { format } from 'date-fns';
import { StackHeader } from '@/components/headers';
import { Button, EmptyState, Loading, SheetModal } from '@/components/ui';
import { SettlementCard } from '@/components/employer/settlement/SettlementCard';
import { SettlementDetailModal } from '@/components/employer/settlement/SettlementDetailModal';
import { BanknotesIcon, ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';
import { SECONDARY_PALETTE } from '@/constants/colors';
import { getRoleDisplayName } from '@/types/unified';
import { useVenueSettlement, useSetVenueRoleSalary } from '@/hooks/weeklyGrid';
import { useToastStore } from '@/stores/toastStore';
import { logger } from '@/utils/logger';
import { toError } from '@/errors';
import {
  RoleSalaryField,
  defaultVenueSalaryDraft,
  type VenueSalaryDraft,
} from '@/components/weeklyGrid/RoleSalaryField';
import type { SettlementWorkLog } from '@/services/work/settlement/types';

/** 배지 탭으로 여는 단가 설정 대상(역할 단위) */
interface FixTarget {
  role: string;
  customRole?: string;
}

/** 'YYYY-MM' 에서 delta 개월 이동. date-fns Date 계산은 화면단 표시용이라 로컬 헬퍼로 유지. */
function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return format(d, 'yyyy-MM');
}

/** 'YYYY-MM' → '2026년 7월' — 월 선행 0 을 제거한 표시 라벨. */
function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${y}년 ${m}월`;
}

export default function VenueSettlementsScreen() {
  const params = useLocalSearchParams<{ venueId?: string; month?: string }>();
  const venueId = typeof params.venueId === 'string' ? params.venueId : null;
  const initialMonth =
    typeof params.month === 'string' && /^\d{4}-\d{2}$/.test(params.month)
      ? params.month
      : format(new Date(), 'yyyy-MM');

  const [month, setMonth] = useState(initialMonth);
  const { data: workLogs, isLoading, refetch } = useVenueSettlement(venueId, month);
  const mutation = useSetVenueRoleSalary();
  const { addToast } = useToastStore();

  const [fixTarget, setFixTarget] = useState<FixTarget | null>(null);
  const [fixDraft, setFixDraft] = useState<VenueSalaryDraft | null>(null);

  // 상세보기(#2) — 스태프 카드 탭 시 정산 상세 모달. 읽기 전용(정산 확정/시간 수정은
  // 컨테이너 정산 mutation 미배선이라 노출하지 않는다 — half-wired 파괴 액션 회피).
  // visible 과 workLog 를 분리한다: 닫을 때 workLog 를 즉시 null 로 만들면 모달이 바로 언마운트돼
  // 닫힘 애니메이션이 생략되므로, visible=false 로만 닫고 workLog 는 유지한다.
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailWorkLog, setDetailWorkLog] = useState<SettlementWorkLog | null>(null);

  // 폴백 배지는 컨테이너 직속 배치(jobPostingId===venueId)에만 뜬다. 공고 스팬 행은 공고 컨텍스트로
  // 해소되며 그 'fallback'은 공고 defaultSalary 해소라 지점 단가표와 무관 — 배지를 탭해 지점 단가를
  // 저장해도 그 행은 재계산되지 않으므로(공고 컨텍스트 우선) 거짓 배지가 된다(HIGH-1).
  const fallbackCount = useMemo(
    () =>
      (workLogs ?? []).filter((wl) => wl.salarySource === 'fallback' && wl.jobPostingId === venueId)
        .length,
    [workLogs, venueId]
  );

  const openFix = useCallback((wl: SettlementWorkLog) => {
    const role = wl.role ?? '';
    if (!role) return;
    setFixTarget({ role, customRole: wl.customRole });
    setFixDraft(defaultVenueSalaryDraft(role));
  }, []);

  const saveFix = useCallback(async () => {
    if (!venueId || !fixTarget || !fixDraft) return;
    try {
      await mutation.mutateAsync({ venueId, ...fixTarget, salary: fixDraft });
    } catch {
      addToast({ type: 'error', message: '단가 저장에 실패했어요. 잠시 후 다시 시도해주세요.' });
      return;
    }
    // 저장 성공 후에만 성공 토스트. refetch 실패는 저장 자체의 실패가 아니므로
    // 사용자에게 실패로 알리지 않는다(모순 토스트 방지).
    addToast({ type: 'success', message: '단가를 저장했어요. 정산을 다시 계산합니다.' });
    setFixTarget(null);
    refetch().catch((error) => {
      logger.warn('지점 정산 재조회 실패 — 단가 저장은 완료됨', { cause: toError(error).message });
    });
  }, [venueId, fixTarget, fixDraft, mutation, addToast, refetch]);

  const renderItem = useCallback(
    ({ item }: { item: SettlementWorkLog }) => (
      <View className="mb-2">
        {item.salaryInfo ? (
          <SettlementCard
            workLog={item}
            salaryInfo={item.salaryInfo}
            onPress={() => {
              setDetailWorkLog(item);
              setDetailVisible(true);
            }}
          />
        ) : null}
        {/* 컨테이너 직속 행만 배지 노출 — 공고 스팬 행의 fallback 은 지점 단가표로 못 고친다(HIGH-1). */}
        {item.salarySource === 'fallback' && item.jobPostingId === venueId ? (
          <Pressable
            onPress={() => openFix(item)}
            accessibilityRole="button"
            accessibilityLabel={`${getRoleDisplayName(item.role ?? '', item.customRole)} 기본 단가 적용 — 탭해서 단가 설정`}
            className="mt-1 min-h-[44px] flex-row items-center gap-2 rounded-md bg-warning/10 px-3 py-2"
          >
            <BanknotesIcon size={16} color={SECONDARY_PALETTE[500]} />
            <Text className="flex-1 text-sm text-content-secondary font-sans">
              기본 단가(시급 15,000원)로 계산됐어요 — 탭해서{' '}
              {getRoleDisplayName(item.role ?? '', item.customRole)} 단가를 설정하면 다시 계산돼요.
            </Text>
          </Pressable>
        ) : null}
      </View>
    ),
    [openFix, venueId]
  );

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-surface-page dark:bg-surface">
      <StackHeader title="지점 정산" fallbackHref="/(employer)/weekly-grid" />

      {/* 월 네비게이션 */}
      <View className="flex-row items-center justify-center gap-4 py-3">
        <Pressable
          onPress={() => setMonth((m) => shiftMonth(m, -1))}
          accessibilityRole="button"
          accessibilityLabel="이전 달"
          hitSlop={10}
          className="h-11 w-11 items-center justify-center"
        >
          <ChevronLeftIcon size={20} color={SECONDARY_PALETTE[500]} />
        </Pressable>
        <Text className="text-base font-sans-semibold text-content-primary dark:text-off-white">
          {formatMonthLabel(month)}
        </Text>
        <Pressable
          onPress={() => setMonth((m) => shiftMonth(m, 1))}
          accessibilityRole="button"
          accessibilityLabel="다음 달"
          hitSlop={10}
          className="h-11 w-11 items-center justify-center"
        >
          <ChevronRightIcon size={20} color={SECONDARY_PALETTE[500]} />
        </Pressable>
      </View>

      {fallbackCount > 0 ? (
        <Text className="px-4 pb-2 text-sm text-content-secondary font-sans">
          기본 단가로 계산된 근무 {fallbackCount}건 — 배지를 탭해 단가를 설정하세요.
        </Text>
      ) : null}

      {isLoading ? (
        <View className="items-center py-10">
          <Loading size="small" />
        </View>
      ) : (workLogs ?? []).length === 0 ? (
        <View className="px-4 py-8">
          <EmptyState
            icon={<BanknotesIcon size={40} color={SECONDARY_PALETTE[400]} />}
            title="이 달 정산할 근무가 없어요"
            description="근무표에서 인원을 배치하면 여기서 월별 정산을 확인할 수 있어요."
          />
        </View>
      ) : (
        <FlatList
          data={workLogs}
          keyExtractor={(item) => item.id ?? `${item.staffId}-${item.date}`}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        />
      )}

      {/* 배지 탭 → 단가 설정 시트 (RoleSalaryField 재사용 — 접점 1과 동일 컴포넌트) */}
      <SheetModal
        visible={!!fixTarget}
        onClose={() => setFixTarget(null)}
        title="단가 설정"
        isLoading={mutation.isPending}
        footer={
          <Button variant="primary" onPress={saveFix} loading={mutation.isPending} fullWidth>
            단가 저장하고 다시 계산
          </Button>
        }
      >
        <View className="p-5">
          {fixTarget && fixDraft ? (
            <RoleSalaryField
              roleLabel={getRoleDisplayName(fixTarget.role, fixTarget.customRole)}
              caption={`${getRoleDisplayName(fixTarget.role, fixTarget.customRole)} 단가를 설정하면 이 지점의 같은 역할 정산에 모두 적용돼요.`}
              value={fixDraft}
              onChange={setFixDraft}
            />
          ) : null}
        </View>
      </SheetModal>

      {/* 상세보기(#2) — 카드 탭으로 여는 정산 상세(읽기 전용). */}
      <SettlementDetailModal
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        workLog={detailWorkLog}
        salaryInfo={detailWorkLog?.salaryInfo ?? { type: 'hourly', amount: 0 }}
      />
    </SafeAreaView>
  );
}

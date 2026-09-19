/**
 * 지점 근무 금액 — 근무표 직접 배치분 월 단위 금액 (JIT 급여 설계 §D)
 *
 * 구인자 IA S2 — 지급 완료·일괄 정산·지급 완료 취소를 걷어낸 **읽기 전용** 화면이다.
 * 앱은 돈을 보내지 않는다. 공고 없이 근무표에 직접 배치한 사람의 금액을 볼 곳은 여기뿐이라
 * 화면은 남겼다(라우트 이름 `venue-settlements` 는 딥링크 호환을 위해 그대로 둔다).
 *
 * 폴백(₩15,000) 계산 건은 "기본 단가 적용" 배지로 가시화(조용한 오답 금지 — 정책 2026-07-22),
 * 배지 탭 → RoleSalaryField 시트로 그 역할 단가를 즉시 설정 → 쿼리 invalidate 재계산
 * (금액은 read-time 계산이라 refetch 로 충분). 건별 예외는 공고 [근무] 의 금액 수정 경로.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { format } from 'date-fns';
import { StackHeader } from '@/components/headers';
import { Button, EmptyState, ErrorState, Loading, SheetModal } from '@/components/ui';
import { SettlementCard } from '@/components/employer/settlement/SettlementCard';
import { SettlementDetailModal } from '@/components/employer/settlement/SettlementDetailModal';
import { BanknotesIcon, ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';
import { SECONDARY_PALETTE } from '@/constants/colors';
import { getRoleDisplayName } from '@/types/unified';
import { useVenueSettlement, useSetVenueRoleSalary } from '@/hooks/workSchedule';
import { useToastStore } from '@/stores/toastStore';
import { logger } from '@/utils/logger';
import { toError } from '@/errors';
import { formatCurrency } from '@/utils/settlement';
import { shouldUseFrozenPayrollAmount } from '@/utils/settlementGrouping';
import { STATUS } from '@/constants';
import {
  RoleSalaryField,
  defaultVenueSalaryDraft,
  type VenueSalaryDraft,
} from '@/components/workSchedule/RoleSalaryField';
import type { SettlementWorkLog } from '@/services/work/settlement/types';
import { loadFailed, saveFailed } from '@/constants/messages';

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

/**
 * 퇴근이 기록된 근무를 둘로 가른다 — 아직 보낼 금액 / 과거에 지급 완료로 처리된 금액.
 *
 * 🚨 과거 지급 완료 행을 "지급 예정" 에 더하면 사장이 합계를 그대로 보내 이미 준 돈을 한 번 더 보낸다.
 * 🔑 동결값 판정은 `shouldUseFrozenPayrollAmount` SSOT 를 쓴다(카드·목록과 같은 규칙).
 *    동결값이 없는 레거시 완료 행은 재계산값으로 밝히되, 여전히 "지급 예정" 에는 넣지 않는다.
 */
function splitPayable(workLogs: readonly SettlementWorkLog[]) {
  let payableCount = 0;
  let payableAmount = 0;
  let settledCount = 0;
  let settledAmount = 0;

  for (const wl of workLogs) {
    if (!wl.checkInTime || !wl.checkOutTime) continue;

    const isCompleted = wl.payrollStatus === STATUS.PAYROLL.COMPLETED;
    if (isCompleted) {
      settledCount += 1;
      settledAmount += shouldUseFrozenPayrollAmount(isCompleted, wl.payrollAmount)
        ? wl.payrollAmount
        : (wl.calculatedAmount ?? 0);
    } else {
      payableCount += 1;
      payableAmount += wl.calculatedAmount ?? 0;
    }
  }

  return { payableCount, payableAmount, settledCount, settledAmount };
}

export default function VenueSettlementsScreen() {
  const params = useLocalSearchParams<{ venueId?: string; month?: string }>();
  const venueId = typeof params.venueId === 'string' ? params.venueId : null;
  const initialMonth =
    typeof params.month === 'string' && /^\d{4}-\d{2}$/.test(params.month)
      ? params.month
      : format(new Date(), 'yyyy-MM');

  const [month, setMonth] = useState(initialMonth);
  const { data: workLogs, isLoading, isError, refetch } = useVenueSettlement(venueId, month);
  const mutation = useSetVenueRoleSalary();
  const { addToast } = useToastStore();

  const [fixTarget, setFixTarget] = useState<FixTarget | null>(null);
  const [fixDraft, setFixDraft] = useState<VenueSalaryDraft | null>(null);

  // 계산 근거(#2) — 스태프 카드 탭 시 모달.
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

  // 🔑 지급 예정 합계는 **퇴근이 기록된 근무만** 더한다. 퇴근 전 근무로 추정 금액을 만들면
  //    사장이 그 숫자를 보고 보낸 뒤 실제 금액과 달라진다.
  const payable = useMemo(() => splitPayable(workLogs ?? []), [workLogs]);

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
      addToast({ type: 'error', message: saveFailed('단가', { retry: true }) });
      return;
    }
    // 저장 성공 후에만 성공 토스트. refetch 실패는 저장 자체의 실패가 아니므로
    // 사용자에게 실패로 알리지 않는다(모순 토스트 방지).
    addToast({ type: 'success', message: '단가를 저장했어요. 금액을 다시 계산합니다.' });
    setFixTarget(null);
    refetch().catch((error) => {
      logger.warn('지점 근무 금액 재조회 실패 — 단가 저장은 완료됨', {
        cause: toError(error).message,
      });
    });
  }, [venueId, fixTarget, fixDraft, mutation, addToast, refetch]);

  const renderItem = useCallback(
    ({ item }: { item: SettlementWorkLog }) => (
      <View className="mb-2">
        {item.salaryInfo ? (
          /* calculatedAmount 는 settlementVenueQuery 가 유효 급여·수당·세금을 해소해 만든
             canonical(afterTaxPay)이다. 예전엔 salaryInfo 만 넘겨 카드가 수당·세금 없이
             다시 계산했고, 그래서 같은 근무가 서비스 값과 다른 금액으로 보였다(SETTLE-8). */
          <SettlementCard
            workLog={item}
            salaryInfo={item.salaryInfo}
            calculatedAmount={item.calculatedAmount}
            onPress={() => {
              setDetailWorkLog(item);
              setDetailVisible(true);
            }}
          />
        ) : null}
        {/* 컨테이너 직속 행만 배지 노출 — 공고 스팬 행의 fallback 은 지점 단가표로 못 고친다(HIGH-1).
            배경은 warning-50/100 — 종전 `bg-warning/10` 은 warning 팔레트에 DEFAULT 키가 없어
            무효 클래스였고, 그래서 이 경고 띠의 배경이 아예 그려지지 않았다. */}
        {item.salarySource === 'fallback' && item.jobPostingId === venueId ? (
          <Pressable
            onPress={() => openFix(item)}
            accessibilityRole="button"
            accessibilityLabel={`${getRoleDisplayName(item.role ?? '', item.customRole)} 기본 단가 적용 — 탭해서 단가 설정`}
            className="mt-1 min-h-[44px] flex-row items-center gap-2 rounded-md bg-warning-50 px-3 py-2 dark:bg-warning-100"
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
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-surface-page dark:bg-surface">
      <StackHeader title="지점 근무 금액" fallbackHref="/(employer)/work-schedule" />

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
      ) : isError ? (
        // 금액 화면에서 조회 실패를 "근무가 없어요"로 흘리면 사장이 그 달 금액을
        // 0 으로 오판한다. "없다"와 "못 읽었다"는 반드시 구분한다.
        <View className="px-4 py-8">
          {/* error 를 넘기지 않는 이유: ErrorState 는 error 가 AppError 면 isRetryable 로 재시도
              버튼을 감춘다. 여기 재시도는 부작용 없는 읽기(refetch)라 항상 열려 있어야 하고,
              표시 문구도 message 가 error 보다 우선하므로 error 는 기여하는 바가 없다. */}
          <ErrorState
            title={loadFailed('근무 금액')}
            message="네트워크 상태를 확인하고 다시 시도해주세요. 근무가 없는 게 아니라 목록을 읽지 못한 상태예요."
            onRetry={refetch}
          />
        </View>
      ) : (workLogs ?? []).length === 0 ? (
        <View className="px-4 py-8">
          <EmptyState
            icon={<BanknotesIcon size={40} color={SECONDARY_PALETTE[400]} />}
            title="이 달 근무 기록이 없어요"
            description="근무표에서 인원을 배치하면 여기서 월별 금액을 확인할 수 있어요."
          />
        </View>
      ) : (
        <>
          <FlatList
            data={workLogs}
            keyExtractor={(item) => item.id ?? `${item.staffId}-${item.date}`}
            renderItem={renderItem}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          />

          <View className="border-t border-secondary-200 px-4 py-3 dark:border-surface-overlay">
            <Text className="text-sm text-content-secondary font-sans">
              지급 예정 합계 · 퇴근이 기록된 근무 {payable.payableCount}건
            </Text>
            <Text
              testID="venue-payable-total"
              className="mt-0.5 text-lg font-display text-primary-600 dark:text-primary-400"
            >
              {formatCurrency(payable.payableAmount)}
            </Text>
            {payable.settledCount > 0 ? (
              <Text
                testID="venue-settled-note"
                className="mt-0.5 text-xs text-secondary-500 dark:text-secondary-400 font-sans"
              >
                {`이미 지급 처리된 근무 ${payable.settledCount}건(${formatCurrency(payable.settledAmount)})은 빠져요`}
              </Text>
            ) : null}
            <Text className="mt-0.5 text-micro text-content-placeholder font-sans">
              입금은 앱이 아니라 사장님이 직접 보내요.
            </Text>
          </View>
        </>
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
              caption={`${getRoleDisplayName(fixTarget.role, fixTarget.customRole)} 단가를 설정하면 이 지점의 같은 역할 금액에 모두 적용돼요.`}
              value={fixDraft}
              onChange={setFixDraft}
            />
          ) : null}
        </View>
      </SheetModal>

      {/* 계산 근거(#2) — 카드 탭으로 여는 읽기 전용 상세. */}
      <SettlementDetailModal
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        workLog={detailWorkLog}
        salaryInfo={detailWorkLog?.salaryInfo ?? { type: 'hourly', amount: 0 }}
      />
    </SafeAreaView>
  );
}

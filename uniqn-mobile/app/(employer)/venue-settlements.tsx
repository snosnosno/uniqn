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
import { Button, EmptyState, ErrorState, Loading, SheetModal } from '@/components/ui';
import { SettlementCard } from '@/components/employer/settlement/SettlementCard';
import { SettlementDetailModal } from '@/components/employer/settlement/SettlementDetailModal';
import { SettlementRevertModal } from '@/components/employer/settlement/SettlementRevertModal';
import { BanknotesIcon, ChevronLeftIcon, ChevronRightIcon } from '@/components/icons';
import { SECONDARY_PALETTE } from '@/constants/colors';
import { SHEET_DISMISS_ANIMATION_MS } from '@/constants/animation';
import { getRoleDisplayName } from '@/types/unified';
import { useVenueSettlement, useSetVenueRoleSalary } from '@/hooks/workSchedule';
import {
  useSettleWorkLog,
  useBulkSettlement,
  useUpdateSettlementStatus,
} from '@/hooks/useSettlement';
import { useToastStore } from '@/stores/toastStore';
import { confirmAction } from '@/utils/confirmAction';
import { STATUS } from '@/constants';
import { logger } from '@/utils/logger';
import { toError } from '@/errors';
import {
  RoleSalaryField,
  defaultVenueSalaryDraft,
  type VenueSalaryDraft,
} from '@/components/workSchedule/RoleSalaryField';
import type { SettlementWorkLog } from '@/services/work/settlement/types';
import type { WorkLog } from '@/types';

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
  const { data: workLogs, isLoading, isError, refetch } = useVenueSettlement(venueId, month);
  const mutation = useSetVenueRoleSalary();
  const { addToast } = useToastStore();

  const [fixTarget, setFixTarget] = useState<FixTarget | null>(null);
  const [fixDraft, setFixDraft] = useState<VenueSalaryDraft | null>(null);

  // 정산 확정 — 공고 정산과 **같은 mutation** 을 재사용한다(useSettleWorkLog/useBulkSettlement).
  // 예전엔 "컨테이너 정산 mutation 미배선" 이라 이 화면 전체가 읽기 전용이었다. 배선하면서
  // 쓰기 경로의 canonical 재계산이 컨테이너 단가표를 못 읽던 결함을 함께 고쳤다
  // (domains/settlement/venueSettlementContext.ts) — 안 고치고 배선했다면 화면은 20,000원,
  // 지급 기록은 15,000원이 되는 더 나쁜 half-wired 가 됐을 것이다.
  // 정산 완료 알림은 DB 트리거(notify_on_work_log_update Case 3)가 payroll_status 전이에서
  // 자동 발송한다 — 클라에서 따로 보내면 중복이 된다.
  const settleMutation = useSettleWorkLog();
  const bulkSettleMutation = useBulkSettlement();

  // 상세보기(#2) — 스태프 카드 탭 시 정산 상세 모달.
  // visible 과 workLog 를 분리한다: 닫을 때 workLog 를 즉시 null 로 만들면 모달이 바로 언마운트돼
  // 닫힘 애니메이션이 생략되므로, visible=false 로만 닫고 workLog 는 유지한다.
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailWorkLog, setDetailWorkLog] = useState<SettlementWorkLog | null>(null);

  // 지급 완료 취소(SETTLE-3) — 컨테이너 직속 배치는 공고 정산 화면에 아예 나오지 않으므로
  // 이 화면이 오지급을 정정할 수 있는 **앱 전체의 유일한 진입점**이다. 없으면 확정이 편도 문이 된다
  // (확정 문구는 비가역성을 고지하는데 정정 수단이 없는 반쪽 상태였다).
  // 되돌리기(completed→pending)는 알림 트리거 조건에 걸리지 않는다 —
  // notify_on_work_log_update Case 3 은 completed **전이**에서만 발화하므로 "취소 시 무알림"은 이미 성립한다.
  const revertMutation = useUpdateSettlementStatus();
  const [revertVisible, setRevertVisible] = useState(false);
  const [revertWorkLog, setRevertWorkLog] = useState<SettlementWorkLog | null>(null);

  // 폴백 배지는 컨테이너 직속 배치(jobPostingId===venueId)에만 뜬다. 공고 스팬 행은 공고 컨텍스트로
  // 해소되며 그 'fallback'은 공고 defaultSalary 해소라 지점 단가표와 무관 — 배지를 탭해 지점 단가를
  // 저장해도 그 행은 재계산되지 않으므로(공고 컨텍스트 우선) 거짓 배지가 된다(HIGH-1).
  const fallbackCount = useMemo(
    () =>
      (workLogs ?? []).filter((wl) => wl.salarySource === 'fallback' && wl.jobPostingId === venueId)
        .length,
    [workLogs, venueId]
  );

  // 정산 가능 판정은 **서버 게이트와 같은 축**을 봐야 한다.
  // 서버(settleWorkLogWithTransaction)는 `status ∈ {checked_out, completed}` 를 검사하는데
  // 여기서 시각(checkInTime/checkOutTime)만 보면, 시각은 있는데 status 가 승격되지 않은
  // 레거시 행에서 버튼이 보이고 누르면 "출퇴근이 완료된 근무 기록만 정산할 수 있습니다" 로
  // 실패한다 — "누를 수 있는데 항상 실패하는 버튼" 을 없애려던 목적이 그 지점에서 깨진다.
  // 시각 조건도 함께 유지한다(금액 계산에 실제로 필요한 값이다).
  const settleableWorkLogs = useMemo(
    () =>
      (workLogs ?? []).filter(
        (wl) =>
          (wl.payrollStatus ?? STATUS.PAYROLL.PENDING) === STATUS.PAYROLL.PENDING &&
          (wl.status === STATUS.WORK_LOG.CHECKED_OUT || wl.status === STATUS.WORK_LOG.COMPLETED) &&
          !!wl.checkInTime &&
          !!wl.checkOutTime
      ),
    [workLogs]
  );

  const settleableTotal = useMemo(
    () => settleableWorkLogs.reduce((sum, wl) => sum + (wl.calculatedAmount ?? 0), 0),
    [settleableWorkLogs]
  );

  const isSettling = settleMutation.isPending || bulkSettleMutation.isPending;

  const handleSettle = useCallback(
    (workLog: SettlementWorkLog) => {
      if (!workLog.id || isSettling) return;
      const amount = workLog.calculatedAmount ?? 0;
      confirmAction({
        title: '정산 확정',
        // 금액을 문구에 박아 넣는다 — 확정은 되돌리려면 별도 경로가 필요하고,
        // 스태프에게 지급 완료 알림이 즉시 나간다(회수 불가).
        message: `${workLog.staffName ?? '스태프'}님의 ${workLog.date} 근무를 ${amount.toLocaleString()}원으로 정산할까요? 확정하면 스태프에게 정산 완료 알림이 갑니다.`,
        confirmText: '정산 확정',
        onConfirm: () => {
          settleMutation.mutate({ workLogId: workLog.id as string, amount });
        },
      });
    },
    [settleMutation, isSettling]
  );

  const handleBulkSettle = useCallback(() => {
    if (settleableWorkLogs.length === 0 || isSettling) return;
    const workLogIds = settleableWorkLogs
      .map((wl) => wl.id)
      .filter((id): id is string => Boolean(id));
    if (workLogIds.length === 0) return;

    confirmAction({
      title: '미정산 전체 정산',
      message: `미정산 ${workLogIds.length}건(합계 ${settleableTotal.toLocaleString()}원)을 한 번에 정산할까요? 확정하면 각 스태프에게 정산 완료 알림이 갑니다.`,
      confirmText: `${workLogIds.length}건 정산`,
      onConfirm: () => {
        bulkSettleMutation.mutate({ workLogIds });
      },
    });
  }, [settleableWorkLogs, settleableTotal, bulkSettleMutation, isSettling]);

  // 상세 → 취소 모달 전환. 두 네이티브 Modal 을 겹쳐 present 하면 iOS 터치 라우팅이 깨지므로
  // 상세를 먼저 닫고 기다린 뒤 연다. 대기 값은 `constants/animation.ts` SSOT 를 쓴다(로컬 복제 금지).
  //
  // 🔑 대상은 **모달이 넘겨준 workLog** 를 쓴다(클로저의 detailWorkLog 가 아니라).
  // 상세 모달은 그룹 모드에서 날짜 네비게이션으로 자기 내부 workLog 를 교체할 수 있어서,
  // 클로저를 쓰면 나중에 그룹 모드를 붙이는 순간 "화면에 보이던 행이 아닌 처음 탭한 행" 의
  // 지급 완료가 취소된다. TS 는 인자를 덜 받는 콜백을 허용하므로 tsc 가 침묵하는 종류의 결함이다.
  const handleOpenRevert = useCallback((workLog: WorkLog) => {
    setDetailVisible(false);
    setTimeout(() => {
      setRevertWorkLog(workLog as SettlementWorkLog);
      setRevertVisible(true);
    }, SHEET_DISMISS_ANIMATION_MS);
  }, []);

  const closeRevert = useCallback(() => {
    // 상세 모달과 같은 이유로 workLog 는 유지한다 — 즉시 null 로 만들면 닫힘 애니메이션 중에
    // 이름·금액이 사라져 깜빡인다. 다음 열기에서 덮어쓴다.
    setRevertVisible(false);
  }, []);

  const handleConfirmRevert = useCallback(
    async (reason: string) => {
      const workLogId = revertWorkLog?.id;
      if (!workLogId) return;
      try {
        await revertMutation.mutateAsync({
          workLogId,
          status: STATUS.PAYROLL.PENDING,
          reason,
        });
        closeRevert();
      } catch (error) {
        // 실패 토스트는 뮤테이션 공통 에러 핸들러가 띄운다. 모달은 열어 둬서 사용자가
        // 입력한 사유를 다시 쓰지 않게 한다(성공에서만 닫는다).
        logger.error('지점 정산 지급 완료 취소 실패', toError(error), { workLogId });
      }
    },
    [revertWorkLog?.id, revertMutation, closeRevert]
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
            /* 카드가 미정산 + 출퇴근 기록 완료일 때만 정산 버튼을 그린다(SettlementCard 내부 게이트). */
            onSettle={handleSettle}
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
    [openFix, venueId, handleSettle]
  );

  return (
    // 일괄 정산 바가 화면 최하단에 붙으므로 bottom 인셋도 확보한다 —
    // top 만 두면 iOS 홈 인디케이터가 버튼을 덮는다.
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-surface-page dark:bg-surface">
      <StackHeader title="지점 정산" fallbackHref="/(employer)/work-schedule" />

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
        // 금전 화면에서 조회 실패를 "정산할 근무가 없어요"로 흘리면 사장이 그 달 지급액을
        // 0 으로 오판한다. "없다"와 "못 읽었다"는 반드시 구분한다.
        <View className="px-4 py-8">
          {/* error 를 넘기지 않는 이유: ErrorState 는 error 가 AppError 면 isRetryable 로 재시도
              버튼을 감춘다. 여기 재시도는 부작용 없는 읽기(refetch)라 항상 열려 있어야 하고,
              표시 문구도 message 가 error 보다 우선하므로 error 는 기여하는 바가 없다. */}
          <ErrorState
            title="정산 내역을 불러오지 못했어요"
            message="네트워크 상태를 확인하고 다시 시도해주세요. 정산할 근무가 없는 게 아니라 목록을 읽지 못한 상태예요."
            onRetry={refetch}
          />
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
        <>
          <FlatList
            data={workLogs}
            keyExtractor={(item) => item.id ?? `${item.staffId}-${item.date}`}
            renderItem={renderItem}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          />

          {/* 미정산이 남아 있을 때만 일괄 정산 바를 띄운다. 건수와 합계를 버튼 위에 먼저
              보여주는 이유: 확정은 스태프에게 즉시 알림이 나가고 회수할 수 없다. */}
          {settleableWorkLogs.length > 0 ? (
            <View className="border-t border-secondary-200 px-4 py-3 dark:border-surface-overlay">
              <Text className="mb-2 text-sm text-content-secondary font-sans">
                미정산 {settleableWorkLogs.length}건 · 합계 {settleableTotal.toLocaleString()}원
              </Text>
              <Button
                variant="primary"
                onPress={handleBulkSettle}
                loading={bulkSettleMutation.isPending}
                disabled={isSettling}
                fullWidth
              >
                미정산 전체 정산
              </Button>
            </View>
          ) : null}
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
              caption={`${getRoleDisplayName(fixTarget.role, fixTarget.customRole)} 단가를 설정하면 이 지점의 같은 역할 정산에 모두 적용돼요.`}
              value={fixDraft}
              onChange={setFixDraft}
            />
          ) : null}
        </View>
      </SheetModal>

      {/* 상세보기(#2) — 카드 탭으로 여는 정산 상세. 지급 완료 행에서만 취소 진입점이 뜬다
          (SettlementDetailModal 내부 게이트: payrollStatus === COMPLETED). */}
      <SettlementDetailModal
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        workLog={detailWorkLog}
        salaryInfo={detailWorkLog?.salaryInfo ?? { type: 'hourly', amount: 0 }}
        onRevertSettlement={handleOpenRevert}
      />

      {/* 지급 완료 취소 모달 (SETTLE-3) — 사유는 서버가 필수로 강제한다. */}
      <SettlementRevertModal
        visible={revertVisible}
        onClose={closeRevert}
        staffName={revertWorkLog?.staffName}
        payrollAmount={revertWorkLog?.payrollAmount}
        onConfirm={handleConfirmRevert}
        isSubmitting={revertMutation.isPending}
      />
    </SafeAreaView>
  );
}

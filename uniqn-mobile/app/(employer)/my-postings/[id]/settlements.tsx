/**
 * UNIQN Mobile - 스태프/정산 관리 화면
 * 특정 공고의 스태프 관리 및 정산
 *
 * @description v2.0 - 탭 구조 (스태프 관리 / 정산)
 * @version 2.1.0
 */

import React, { useState, useMemo } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getPostingSettlementContext,
  aggregateRoleFilledFromSubmap,
  selectPostingCapacityGaps,
  toCapacityGapByDate,
} from '@/domains/job-posting';
import { getTodayString } from '@/utils/date';
import { usePostingFilledCounts, extractPostingFilledSubmap } from '@/hooks/usePostingFilledCounts';
import { SettlementList, StaffManagementTab } from '@/components/employer';
import { SettlementModals } from '@/features/employer/settlements/SettlementModals';
import { ErrorState } from '@/components';
import { PostingSurfaceState } from '@/components/jobs';
import { StackHeader } from '@/components/headers';
import { useSettlement } from '@/hooks/useSettlement';
import { useConfirmedStaff } from '@/hooks/useConfirmedStaff';
import { useSettlementModals } from '@/hooks/useSettlementModals';
import { useToastStore } from '@/stores/toastStore';
import { isCanonicalDatedPosting } from '@/utils/jobPostingVisibility';
import {
  deriveSalaryConfig,
  deriveRolesForList,
  selectPendingSettlementCount,
} from '@/features/employer/settlements/settlementCalc';
import { useStaffSettlementsHandlers } from '@/features/employer/settlements/useStaffSettlementsHandlers';
import { TabHeader, type TabType } from '@/features/employer/settlements/TabHeader';
import { TodayOpsStrip } from '@/features/employer/settlements/TodayOpsStrip';
import { HeaderQRAction, JobTitleSuffix, useJobDetailContext } from './_layout';
import { useManualRefresh } from '@/hooks/useManualRefresh';

// ============================================================================
// Main Component
// ============================================================================

export default function StaffSettlementsScreen() {
  const { id: jobPostingId } = useLocalSearchParams<{ id: string }>();
  const { addToast } = useToastStore();
  // 공고 데이터는 레이아웃이 realtime 구독과 함께 한 번만 조회한다 — 화면마다 useJobDetail 을
  // 다시 부르면 같은 id 로 훅 인스턴스가 늘어난다(구독·오프라인 캐시 계산이 인스턴스마다 돈다).
  const { job: posting, isFixed, refresh: refreshJobDetail, handleShowQR } = useJobDetailContext();
  const headerBackHref = `/(employer)/my-postings/${jobPostingId ?? ''}`;
  // 고정 공고는 QR 진입점을 노출하지 않는다 (work_log 행 수명 미해결 — _layout.tsx 주석 참고).
  const headerRightAction = !isFixed ? <HeaderQRAction onPress={handleShowQR} /> : null;

  // 탭 상태 (진입 동기 대부분이 "누가 왔나 확인" — 정산은 근무 종료 후 업무)
  const [activeTab, setActiveTab] = useState<TabType>('staff');

  const headerJobTitle = posting?.title ?? null;
  const headerTitleSuffix = <JobTitleSuffix jobTitle={headerJobTitle} />;
  const postingSettlement = useMemo(
    () => (posting ? getPostingSettlementContext(posting) : undefined),
    [posting]
  );

  // 스태프 관리 훅 — realtime: 스트립·탭 배지가 원격 QR 출근에도 갱신되도록 구독.
  // 자식 StaffManagementTab의 구독과 같은 채널을 공유(createRealtimeSubscription refCount dedup).
  const { stats: staffStats, grouped: staffGrouped } = useConfirmedStaff(jobPostingId || '', {
    realtime: true,
  });

  // 오늘 날짜 그룹 (당일 운영 요약 스트립용)
  const todayGroup = useMemo(() => staffGrouped.find((group) => group.isToday), [staffGrouped]);

  // 정산 관리 훅
  const {
    workLogs,
    isLoading,
    error,
    refresh,
    settleWorkLog,
    bulkSettle,
    updateStatusAsync,
    isUpdatingStatus: isReverting,
    isSettling: _isSettling,
    isBulkSettling: _isBulkSettling,
  } = useSettlement(jobPostingId || '');

  // PTR 스피너는 사용자가 당겼을 때만 — 조회 상태를 그대로 물리면 화면에 들어올 때마다
  // 배경 재조회로 스피너가 뜬다(useManualRefresh 주석 참고).
  const { refreshing: pullRefreshing, onRefresh: onPullRefresh } = useManualRefresh(() =>
    refresh()
  );

  // 모달 상태 관리
  const modals = useSettlementModals();

  // 급여 설정 (v2.0 - 역할별 급여, 수당 포함)
  const salaryConfig = useMemo(() => deriveSalaryConfig(postingSettlement), [postingSettlement]);

  // SettlementList용 역할 목록 (급여 포함)
  const rolesForList = useMemo(() => deriveRolesForList(salaryConfig.roles), [salaryConfig.roles]);

  // 역할별 실확정 인원 (S3) — 통합 편집 시트가 마감 역할에 "(마감)" 을 병기하기 위한 hydrate.
  // 표기만 하고 선택은 막지 않는다(D7). work_logs 기반 배치 조회(H0) → 서브맵 → 역할키별 합산.
  const { data: filledCountsMap } = usePostingFilledCounts(jobPostingId ? [jobPostingId] : []);
  const filledByRole = useMemo(
    () =>
      aggregateRoleFilledFromSubmap(
        extractPostingFilledSubmap(filledCountsMap, jobPostingId || '')
      ),
    [filledCountsMap, jobPostingId]
  );

  // 근무일 D-2/D-1 정원 미달 (S3-1) — 서버 크론이 알림으로 보내는 것과 같은 판정을 화면에서도 한다.
  // 같은 서브맵을 재사용하므로 추가 조회가 없다(날짜 차원만 남기고 접는다).
  // ⚠️ 오늘 날짜를 memo **밖에서** 읽어 의존성에 넣는다. 안에서 부르면 클로저에 굳어
  //    화면을 열어 둔 채 자정을 넘겼을 때 D-오프셋이 어제 기준으로 멈춘다
  //    (D-1 경고가 근무 당일에도 "D-1" 이라고 말한다).
  const todayString = getTodayString();
  const capacityGapByDate = useMemo(() => {
    if (!posting) {
      return undefined;
    }
    return toCapacityGapByDate(
      selectPostingCapacityGaps(
        posting,
        extractPostingFilledSubmap(filledCountsMap, jobPostingId || ''),
        todayString
      )
    );
  }, [posting, filledCountsMap, jobPostingId, todayString]);

  // 핸들러 다발 (클로저 의존은 인자로 주입해 deps 보존)
  const {
    handleReportSubmit,
    handleSettleFromDetail,
    handleSettle,
    handleBulkSettle,
    handleConfirmSettle,
    handleSaveAmountEdit,
    handleSaveSettings,
    handleRevertSettlement,
  } = useStaffSettlementsHandlers({
    jobPostingId,
    modals,
    salaryConfig,
    rolesForList,
    addToast,
    refresh,
    refreshJobDetail,
    settleWorkLog,
    bulkSettle,
    updateStatusAsync,
  });

  // ============================================================================
  // Render
  // ============================================================================

  const stackHeader = (
    <StackHeader
      title="스태프 관리/정산"
      titleSuffix={headerTitleSuffix}
      fallbackHref={headerBackHref}
      rightAction={headerRightAction}
    />
  );

  if (posting && !isCanonicalDatedPosting(posting)) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        {stackHeader}
        <ErrorState
          title="지원하지 않는 화면입니다"
          message="고정공고는 1차 범위에서 정산과 근무 운영을 지원하지 않습니다."
        />
      </SafeAreaView>
    );
  }

  // 로딩 상태
  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        {stackHeader}
        {/* 스켈레톤 통일(S2-9) — 형제 화면과 같은 형상을 쓴다. */}
        <PostingSurfaceState mode="loading" scope="manage" />
      </SafeAreaView>
    );
  }

  // 에러 상태 — 보여줄 근무 기록이 없을 때만 화면을 통째로 뺏는다.
  // 정산 중에 신호가 튀었다고 이미 받아둔 근무 목록을 지우면, 사장은 어디까지 정산했는지
  // 알 수 없게 된다(공고 상세 index.tsx 와 같은 축).
  if (error && workLogs.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        {stackHeader}
        <ErrorState title="데이터를 불러올 수 없습니다" error={error} onRetry={() => refresh()} />
      </SafeAreaView>
    );
  }

  // 카운트 계산 — 정산 대기는 공고 상세 허브도 같은 숫자를 쓰므로 순수 셀렉터 경유.
  const staffCount = staffStats?.total ?? 0;
  const pendingSettlementCount = selectPendingSettlementCount(workLogs, todayString);

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      {stackHeader}

      {/* 목록은 살아 있는데 갱신만 실패한 상태 — 근무 기록을 유지한 채 얇게만 알린다. */}
      {error && workLogs.length > 0 ? (
        <View className="px-4 pt-2">
          <ErrorState compact error={error} onRetry={() => refresh()} />
        </View>
      ) : null}

      {/* 당일 운영 요약 스트립 (M4) — 오늘 근무가 있을 때만 노출 */}
      <TodayOpsStrip
        todayGroup={todayGroup}
        pendingSettlementCount={pendingSettlementCount}
        onPressSettlement={() => setActiveTab('settlement')}
      />

      {/* 탭 헤더 */}
      <TabHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        staffCount={staffCount}
        settlementCount={pendingSettlementCount}
      />

      {/* 탭 컨텐츠 */}
      {activeTab === 'staff' ? (
        <StaffManagementTab
          jobPostingId={jobPostingId || ''}
          jobPosting={posting ?? undefined}
          filledByRole={filledByRole}
          capacityGapByDate={capacityGapByDate}
          onShowReport={modals.openReportModal}
        />
      ) : (
        <SettlementList
          workLogs={workLogs}
          roles={rolesForList}
          defaultSalary={salaryConfig.defaultSalary}
          allowances={salaryConfig.allowances}
          taxSettings={postingSettlement?.taxSettings}
          isLoading={isLoading}
          error={error}
          onRefresh={onPullRefresh}
          isRefreshing={pullRefreshing}
          onWorkLogPress={modals.openDetailModal}
          onSettle={handleSettle}
          onBulkSettle={handleBulkSettle}
          showBulkActions={true}
          onOpenSettings={modals.openSettingsModal}
          enableGrouping={true}
        />
      )}

      {/* 모달들 */}
      <SettlementModals
        modals={modals}
        jobPostingId={jobPostingId || ''}
        posting={posting}
        postingSettlement={postingSettlement}
        rolesForList={rolesForList}
        salaryConfig={salaryConfig}
        filledByRole={filledByRole}
        isReverting={isReverting}
        onRevertSettlement={handleRevertSettlement}
        onReportSubmit={handleReportSubmit}
        onSettleFromDetail={handleSettleFromDetail}
        onConfirmSettle={handleConfirmSettle}
        onSaveAmountEdit={handleSaveAmountEdit}
        onSaveSettings={handleSaveSettings}
      />
    </SafeAreaView>
  );
}

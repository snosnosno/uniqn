/**
 * UNIQN Mobile - [근무] 화면 (옛 스태프 관리/정산)
 * 특정 공고의 날짜별 근무·출퇴근 및 금액
 *
 * @description v2.0 - 탭 구조 (스태프 / 금액)
 *   구인자 IA S1 — 공고 상세의 `취소 요청 관리`·`스태프 공지` 타일을 이 화면으로 흡수했다.
 *   취소 요청은 맨 위 한 줄, 공지는 헤더 `메시지`. 상시 공고는 근무표로 안내한다.
 *   구인자 IA S2 — 정산 **워크플로우**(지급 완료·일괄 정산·지급 완료 취소·정산 대기 배지)를 없앴다.
 *   앱은 돈을 보내지 않는다. 금액 계산·표시만 남긴다.
 * @version 3.0.0
 */

import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { MessageIcon } from '@/components/icons';
import { getLayoutColor } from '@/constants/colors';
import { useApplicantsByJobPosting } from '@/hooks/applicant';
import { useSettlement } from '@/hooks/useSettlement';
import { useConfirmedStaff } from '@/hooks/useConfirmedStaff';
import { useSettlementModals } from '@/hooks/useSettlementModals';
import { useThemeStore } from '@/stores/themeStore';
import { useToastStore } from '@/stores/toastStore';
import { isCanonicalDatedPosting } from '@/utils/jobPostingVisibility';
import {
  deriveSalaryConfig,
  deriveRolesForList,
} from '@/features/employer/settlements/settlementCalc';
import { useStaffSettlementsHandlers } from '@/features/employer/settlements/useStaffSettlementsHandlers';
import { TabHeader, type TabType } from '@/features/employer/settlements/TabHeader';
import { TodayOpsStrip } from '@/features/employer/settlements/TodayOpsStrip';
import { CancellationRequestsBanner } from '@/features/employer/settlements/CancellationRequestsBanner';
import { FixedPostingWorkNotice } from '@/features/employer/settlements/FixedPostingWorkNotice';
import { HeaderQRAction, JobTitleSuffix, useJobDetailContext } from './_layout';
import { useManualRefresh } from '@/hooks/useManualRefresh';
import { loadFailed } from '@/constants/messages';

// ============================================================================
// Main Component
// ============================================================================

export default function StaffSettlementsScreen() {
  const { id: jobPostingId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const isDark = useThemeStore((state) => state.isDarkMode);
  const { addToast } = useToastStore();
  // 공고 데이터는 레이아웃이 realtime 구독과 함께 한 번만 조회한다 — 화면마다 useJobDetail 을
  // 다시 부르면 같은 id 로 훅 인스턴스가 늘어난다(구독·오프라인 캐시 계산이 인스턴스마다 돈다).
  const { job: posting, refresh: refreshJobDetail, handleShowQR } = useJobDetailContext();
  const headerBackHref = `/(employer)/my-postings/${jobPostingId ?? ''}`;

  // 탭 상태 (진입 동기 대부분이 "누가 왔나 확인" — 금액은 근무 종료 후 업무)
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

  // 취소 요청 수 — 공고 상세 허브와 **같은 출처**(지원자 통계)를 쓴다. 숫자가 두 화면에서 어긋나면
  // 사장은 타일 배지 `취소요청 1` 을 보고 들어왔는데 여기서 0건을 보게 된다.
  // 🚨 realtime 을 켜지 않는다. 이 훅은 인스턴스마다 구독을 따로 열고 디듀프가 없다 — 스택 아래에
  //    살아 있는 공고 상세가 이미 같은 공고를 구독 중이라 켜면 채널이 둘이 된다. 그 구독의
  //    onUpdate 가 같은 쿼리 캐시에 쓰므로 여기서는 캐시를 읽기만 해도 갱신을 받는다.
  const { data: applicantData } = useApplicantsByJobPosting(jobPostingId || '');
  const cancellationPendingCount = applicantData?.stats.cancellationPending ?? 0;

  // 오늘 날짜 그룹 (당일 운영 요약 스트립용)
  const todayGroup = useMemo(() => staffGrouped.find((group) => group.isToday), [staffGrouped]);

  // 근무 기록 조회 — 지급 변이(settle/bulkSettle/updateStatus)는 더 이상 쓰지 않는다.
  const { workLogs, isLoading, error, refresh } = useSettlement(jobPostingId || '');

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
  const { handleReportSubmit, handleSaveAmountEdit, handleSaveSettings } =
    useStaffSettlementsHandlers({
      jobPostingId,
      modals,
      salaryConfig,
      rolesForList,
      addToast,
      refresh,
      refreshJobDetail,
    });

  const handleCancellationRequests = useCallback(() => {
    router.push(`/(employer)/my-postings/${jobPostingId ?? ''}/cancellation-requests`);
  }, [jobPostingId, router]);

  /** 확정 스태프 일괄 공지 (S3-2) — 옛 공고 상세 `스태프 공지` 타일 */
  const handleAnnounce = useCallback(() => {
    router.push(`/(employer)/my-postings/${jobPostingId ?? ''}/announce`);
  }, [jobPostingId, router]);

  const handleOpenWorkSchedule = useCallback(() => {
    router.push('/(employer)/work-schedule');
  }, [router]);

  // ============================================================================
  // Render
  // ============================================================================

  const staffCount = staffStats?.total ?? 0;

  const headerRightAction = (
    <View className="flex-row items-center">
      {/* 보낼 대상이 있어야 공지가 의미 있다 — 0명일 때 띄우면 눌러 봐야 빈 화면이다. */}
      {staffCount > 0 ? (
        <Pressable
          onPress={handleAnnounce}
          hitSlop={8}
          className="p-2"
          accessibilityRole="button"
          accessibilityLabel="확정 스태프에게 메시지 보내기"
          testID="work-announce"
        >
          <MessageIcon size={22} color={getLayoutColor(isDark, 'headerTint')} />
        </Pressable>
      ) : null}
      <HeaderQRAction onPress={handleShowQR} />
    </View>
  );

  const stackHeader = (
    <StackHeader
      title="근무"
      titleSuffix={headerTitleSuffix}
      fallbackHref={headerBackHref}
      rightAction={headerRightAction}
    />
  );

  // 상시 공고 — 날짜가 없어 출퇴근·금액이 없다. 막다른 에러 대신 할 일(근무표 배치)을 알려준다.
  if (posting && !isCanonicalDatedPosting(posting)) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        <StackHeader title="근무" titleSuffix={headerTitleSuffix} fallbackHref={headerBackHref} />
        <FixedPostingWorkNotice onOpenWorkSchedule={handleOpenWorkSchedule} />
      </SafeAreaView>
    );
  }

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
  // 신호가 튀었다고 이미 받아둔 근무 목록을 지우면 사장은 금액을 확인할 수 없게 된다
  // (공고 상세 index.tsx 와 같은 축).
  if (error && workLogs.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
        {stackHeader}
        <ErrorState title={loadFailed('데이터')} error={error} onRetry={() => refresh()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-page dark:bg-surface" edges={['top', 'bottom']}>
      {stackHeader}

      {/* 목록은 살아 있는데 갱신만 실패한 상태 — 근무 기록을 유지한 채 얇게만 알린다. */}
      {error && workLogs.length > 0 ? (
        <View className="px-4 pt-2">
          <ErrorState compact error={error} onRetry={() => refresh()} />
        </View>
      ) : null}

      {/* 취소 요청 — "누가 빠지는가" 라서 근무 명단보다 위에 둔다. 0건이면 자리도 없다. */}
      <CancellationRequestsBanner
        count={cancellationPendingCount}
        onPress={handleCancellationRequests}
      />

      {/* 당일 운영 요약 스트립 (M4) — 오늘 근무가 있을 때만 노출 */}
      <TodayOpsStrip todayGroup={todayGroup} />

      <TabHeader activeTab={activeTab} onTabChange={setActiveTab} staffCount={staffCount} />

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
          onOpenSettings={modals.openSettingsModal}
          enableGrouping={true}
        />
      )}

      <SettlementModals
        modals={modals}
        jobPostingId={jobPostingId || ''}
        posting={posting}
        postingSettlement={postingSettlement}
        rolesForList={rolesForList}
        salaryConfig={salaryConfig}
        filledByRole={filledByRole}
        onReportSubmit={handleReportSubmit}
        onSaveAmountEdit={handleSaveAmountEdit}
        onSaveSettings={handleSaveSettings}
      />
    </SafeAreaView>
  );
}
